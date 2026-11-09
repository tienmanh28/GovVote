// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {GovToken} from "../src/GovToken.sol";
import {GovVote} from "../src/GovVote.sol";

/// @title GovVoteHandler
/// @notice Foundry gọi ngẫu nhiên các hàm của handler này (propose, delegate, transfer, vote, roll...)
///         thành chuỗi tối đa `depth` lời gọi. Handler:
///         1. bound() đầu vào để mỗi lời gọi là một hành động hợp lệ của người dùng thật;
///         2. tự kiểm tra ĐIỀU KIỆN TRƯỚC theo đặc tả rồi `return` sớm nếu hành động vô nghĩa
///            (ví dụ vote khi proposal không Active);
///         3. KHÔNG bọc lời gọi contract trong try/catch. Nếu điều kiện trước đã thỏa mà contract vẫn
///            revert, đó là lỗi thật. Kết hợp fail-on-revert = true, lời gọi đó làm invariant FAIL;
///         4. ghi ghost state (biến đếm phụ) về những gì THỰC SỰ được chấp nhận, để invariant đối chiếu
///            với storage của GovVote.
contract GovVoteHandler is Test {
    GovToken public immutable token;
    GovVote public immutable gov;
    uint256 public immutable threshold;
    address[] internal actors;

    // ------------------------------- ghost state -------------------------------
    /// @notice Tổng weight của mọi phiếu được chấp nhận (mọi proposal).
    uint256 public ghostTotalWeight;
    /// @notice Weight For / Against được chấp nhận theo từng proposal.
    mapping(uint256 id => uint256) public ghostFor;
    mapping(uint256 id => uint256) public ghostAgainst;
    /// @notice Số phiếu được chấp nhận của từng cặp (proposal, voter). Đúng đặc tả phải luôn <= 1.
    mapping(uint256 id => mapping(address voter => uint256)) public ghostVoteCount;
    /// @notice Số proposal được tạo thành công.
    uint256 public ghostProposalsCreated;
    /// @notice proposalCount lần quan sát trước; nếu có lúc giảm thì bật cờ.
    uint256 public ghostLastProposalCount;
    bool public ghostProposalCountDecreased;
    /// @notice Tally ghi lại ở lần ĐẦU TIÊN quan sát thấy block.number > deadlineBlock.
    mapping(uint256 id => bool) public ghostFinalRecorded;
    mapping(uint256 id => uint256) public ghostFinalFor;
    mapping(uint256 id => uint256) public ghostFinalAgainst;

    // ------------------------- bộ đếm độ phủ (coverage counter) -------------------------
    // Không tham gia invariant; chỉ để đo handler đi được bao nhiêu nhánh thật.
    /// @notice Số lần vote() được gọi.
    uint256 public voteCalled;
    /// @notice vote() return sớm vì không có proposal / proposal không Active.
    uint256 public voteSkipNotActive;
    /// @notice vote() return sớm vì actor đã vote proposal đó.
    uint256 public voteSkipAlreadyVoted;
    /// @notice vote() return sớm vì actor có weight 0 tại snapshot.
    uint256 public voteSkipNoPower;
    /// @notice Số phiếu castVote thành công.
    uint256 public voteAccepted;
    /// @notice Số lần voteRejected() thực sự chạm expectRevert (contract revert đúng error).
    uint256 public rejectChecked;
    /// @notice Số lần proposeBelowThreshold() thực sự chạm expectRevert(BelowThreshold).
    uint256 public belowThresholdChecked;

    constructor(GovToken token_, GovVote gov_, address[] memory actors_) {
        token = token_;
        gov = gov_;
        threshold = gov_.proposalThreshold();
        actors = actors_;
    }

    /// @dev Quan sát trước và sau MỖI hành động: theo dõi proposalCount và chốt tally sau deadline.
    modifier observe() {
        _observe();
        _;
        _observe();
    }

    function _observe() internal {
        uint256 count = gov.proposalCount();
        if (count < ghostLastProposalCount) ghostProposalCountDecreased = true;
        ghostLastProposalCount = count;

        for (uint256 id = 1; id <= count; id++) {
            if (ghostFinalRecorded[id]) continue;
            GovVote.Proposal memory p = gov.getProposal(id);
            if (block.number > p.deadlineBlock) {
                ghostFinalRecorded[id] = true;
                ghostFinalFor[id] = p.forVotes;
                ghostFinalAgainst[id] = p.againstVotes;
            }
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    // ------------------------------- hành động -------------------------------

    /// @notice Tạo proposal nếu actor đủ ngưỡng ở block trước; không đủ thì bỏ qua.
    function propose(uint256 actorSeed) external observe {
        address actor = _actor(actorSeed);
        if (token.getPastVotes(actor, block.number - 1) < threshold) return;

        vm.prank(actor);
        gov.propose("Invariant proposal", "Handler");
        ghostProposalsCreated++;
    }

    /// @notice Hành động bị từ chối: actor dưới ngưỡng cố tạo proposal => phải revert BelowThreshold.
    function proposeBelowThreshold(uint256 actorSeed) external observe {
        address actor = _actor(actorSeed);
        uint256 pastVotes = token.getPastVotes(actor, block.number - 1);
        if (pastVotes >= threshold) return;

        vm.expectRevert(abi.encodeWithSelector(GovVote.BelowThreshold.selector, pastVotes, threshold));
        vm.prank(actor);
        gov.propose("Invariant proposal", "Handler");
        belowThresholdChecked++;
    }

    /// @notice Actor delegate cho chính mình hoặc cho actor khác.
    function delegate(uint256 actorSeed, uint256 delegateeSeed) external observe {
        address actor = _actor(actorSeed);
        address delegatee = _actor(delegateeSeed);
        vm.prank(actor);
        token.delegate(delegatee);
    }

    /// @notice Chuyển một phần số dư (0..toàn bộ) giữa các actor, kể cả trong lúc đang vote.
    function transfer(uint256 fromSeed, uint256 toSeed, uint256 amount) external observe {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        amount = bound(amount, 0, token.balanceOf(from));
        vm.prank(from);
        assertTrue(token.transfer(to, amount));
    }

    /// @notice Vote hợp lệ. Không Active / đã vote / không có quyền thì return (thuộc voteRejected).
    ///         Chỉ chọn id trong số proposal ĐANG Active: chọn ngẫu nhiên trong 1..count phần lớn trúng
    ///         proposal Pending hoặc đã đóng (baseline: 60% lời gọi vote() bị bỏ vì không Active).
    ///         voteRejected() vẫn chọn id ngẫu nhiên vì nhánh đó cần cả proposal không Active.
    function vote(uint256 idSeed, uint256 actorSeed, bool support) external observe {
        voteCalled++;
        uint256 count = gov.proposalCount();

        // Thu thập id đang Active vào mảng trong memory (kích thước tối đa = count).
        uint256[] memory active = new uint256[](count);
        uint256 activeCount;
        for (uint256 i = 1; i <= count; i++) {
            if (gov.state(i) == GovVote.State.Active) active[activeCount++] = i;
        }
        if (activeCount == 0) {
            voteSkipNotActive++;
            return;
        }
        uint256 id = active[bound(idSeed, 0, activeCount - 1)];
        address actor = _actor(actorSeed);

        if (gov.state(id) != GovVote.State.Active) {
            voteSkipNotActive++;
            return;
        }
        if (gov.hasVoted(id, actor)) {
            voteSkipAlreadyVoted++;
            return;
        }
        uint256 weight = gov.getVotingPowerAt(id, actor);
        if (weight == 0) {
            voteSkipNoPower++;
            return;
        }

        vm.prank(actor);
        gov.castVote(id, support);
        voteAccepted++;

        ghostTotalWeight += weight;
        if (support) ghostFor[id] += weight;
        else ghostAgainst[id] += weight;
        ghostVoteCount[id][actor]++;
    }

    /// @notice Vote KHÔNG hợp lệ (Pending/đã đóng, vote lần hai, không có quyền): contract phải revert
    ///         đúng error. Nếu contract chấp nhận, expectRevert thất bại => handler revert => invariant FAIL.
    ///         Đây là nguồn chính để I4 (tally đóng băng sau deadline) và I5 (một phiếu) có ý nghĩa.
    function voteRejected(uint256 idSeed, uint256 actorSeed, bool support) external observe {
        uint256 count = gov.proposalCount();
        if (count == 0) return;
        uint256 id = bound(idSeed, 1, count);
        address actor = _actor(actorSeed);

        GovVote.State current = gov.state(id);
        bytes memory expected;
        if (current != GovVote.State.Active) {
            expected = abi.encodeWithSelector(GovVote.NotActive.selector, id, current);
        } else if (gov.hasVoted(id, actor)) {
            expected = abi.encodeWithSelector(GovVote.AlreadyVoted.selector, id, actor);
        } else if (gov.getVotingPowerAt(id, actor) == 0) {
            expected = abi.encodeWithSelector(GovVote.NoVotingPower.selector, id, actor);
        } else {
            return; // đây là phiếu hợp lệ, thuộc hàm vote()
        }

        vm.expectRevert(expected);
        vm.prank(actor);
        gov.castVote(id, support);
        rejectChecked++;
    }

    /// @notice Tiến 1..12 block (DELAY = 5, PERIOD = 20 nên proposal đi hết vòng đời trong một run).
    function roll(uint256 blocks) external observe {
        vm.roll(block.number + bound(blocks, 1, 12));
    }
}

/// @title GovVoteInvariantTest
/// @notice Bất biến I1–I6 (đặc tả mục 4.3). runs = 256, depth = 50 lấy từ foundry.toml.
///         fail-on-revert = true (inline config): mọi revert ngoài dự kiến trong handler đều làm test FAIL.
contract GovVoteInvariantTest is StdInvariant, Test {
    uint256 internal constant THRESHOLD = 1_000 ether;
    uint256 internal constant QUORUM_BPS = 1_000;
    // Cửa sổ ngắn để trong depth = 50 lời gọi, proposal đi qua đủ Pending -> Active -> kết quả.
    // Bất biến phải đúng với MỌI cấu hình hợp lệ; cấu hình demo (15 / 7200) đã có unit test riêng.
    uint256 internal constant DELAY = 5;
    uint256 internal constant PERIOD = 20;

    GovToken internal token;
    GovVote internal gov;
    GovVoteHandler internal handler;
    address[] internal actors;

    function setUp() public {
        token = new GovToken(address(this));
        gov = new GovVote(IVotes(address(token)), THRESHOLD, QUORUM_BPS, DELAY, PERIOD);

        // 5 actor có GOV và tự delegate, actor thứ 6 không có gì (để có đường "không đủ quyền").
        uint256[5] memory amounts = [uint256(300_000 ether), 250_000 ether, 200_000 ether, 150_000 ether, 100_000 ether];
        for (uint256 i = 0; i < 6; i++) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(a);
            if (i < 5) {
                assertTrue(token.transfer(a, amounts[i]));
                vm.prank(a);
                token.delegate(a);
            }
        }
        assertEq(token.balanceOf(address(this)), 0);

        handler = new GovVoteHandler(token, gov, actors);

        // Chỉ fuzz các hàm hành động của handler (không gọi getter hay hàm của Test).
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = GovVoteHandler.propose.selector;
        selectors[1] = GovVoteHandler.proposeBelowThreshold.selector;
        selectors[2] = GovVoteHandler.delegate.selector;
        selectors[3] = GovVoteHandler.transfer.selector;
        selectors[4] = GovVoteHandler.vote.selector;
        selectors[5] = GovVoteHandler.voteRejected.selector;
        selectors[6] = GovVoteHandler.roll.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    /// I1: forVotes + againstVotes <= getPastTotalSupply(snapshotBlock) với mọi proposal đã qua snapshot.
    ///     Trong Pending (snapshot chưa chốt) tally phải bằng 0.
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I1_TallyWithinSnapshotSupply() public view {
        uint256 count = gov.proposalCount();
        for (uint256 id = 1; id <= count; id++) {
            GovVote.Proposal memory p = gov.getProposal(id);
            uint256 tally = p.forVotes + p.againstVotes;
            if (block.number > p.snapshotBlock) {
                assertLe(tally, token.getPastTotalSupply(p.snapshotBlock), "I1: tally > supply tai snapshot");
            } else {
                assertEq(tally, 0, "I1: co phieu khi con Pending");
            }
        }
    }

    /// I2: tally trong storage == tổng weight các phiếu được chấp nhận (ghost), theo từng proposal và tổng.
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I2_TallyMatchesGhostWeights() public view {
        uint256 count = gov.proposalCount();
        uint256 storageTotal;
        for (uint256 id = 1; id <= count; id++) {
            GovVote.Proposal memory p = gov.getProposal(id);
            assertEq(p.forVotes, handler.ghostFor(id), "I2: forVotes khac ghost");
            assertEq(p.againstVotes, handler.ghostAgainst(id), "I2: againstVotes khac ghost");
            storageTotal += p.forVotes + p.againstVotes;
        }
        assertEq(storageTotal, handler.ghostTotalWeight(), "I2: tong tally khac tong ghost weight");
    }

    /// I3: proposalCount không bao giờ giảm, và bằng đúng số lần propose thành công.
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I3_ProposalCountNeverDecreases() public view {
        assertFalse(handler.ghostProposalCountDecreased(), "I3: proposalCount tung giam");
        assertGe(gov.proposalCount(), handler.ghostLastProposalCount(), "I3: proposalCount < lan quan sat truoc");
        assertEq(gov.proposalCount(), handler.ghostProposalsCreated(), "I3: proposalCount khac so lan propose");
    }

    /// I4: sau deadlineBlock, forVotes và againstVotes giữ nguyên giá trị lúc đầu tiên qua deadline.
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I4_TallyFrozenAfterDeadline() public view {
        uint256 count = gov.proposalCount();
        for (uint256 id = 1; id <= count; id++) {
            if (!handler.ghostFinalRecorded(id)) continue;
            GovVote.Proposal memory p = gov.getProposal(id);
            assertEq(p.forVotes, handler.ghostFinalFor(id), "I4: forVotes doi sau deadline");
            assertEq(p.againstVotes, handler.ghostFinalAgainst(id), "I4: againstVotes doi sau deadline");
        }
    }

    /// I5: mỗi (proposal, voter) có tối đa 1 phiếu được chấp nhận, và hasVoted khớp đúng ghost set.
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I5_OneVotePerVoter() public view {
        uint256 count = gov.proposalCount();
        uint256 n = handler.actorCount();
        for (uint256 id = 1; id <= count; id++) {
            for (uint256 i = 0; i < n; i++) {
                address a = handler.actorAt(i);
                uint256 votes = handler.ghostVoteCount(id, a);
                assertLe(votes, 1, "I5: mot vi co hon 1 phieu");
                assertEq(gov.hasVoted(id, a), votes == 1, "I5: hasVoted khac ghost set");
            }
        }
    }

    /// I6: state == Succeeded => participated >= quorum và For > Against.
    ///     Kiểm tra cả chiều ngược lại sau deadline: đủ hai điều kiện => Succeeded, thiếu => Defeated.
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I6_SucceededImpliesQuorumAndMajority() public view {
        uint256 count = gov.proposalCount();
        for (uint256 id = 1; id <= count; id++) {
            GovVote.Proposal memory p = gov.getProposal(id);
            GovVote.State s = gov.state(id);
            if (block.number <= p.deadlineBlock) {
                assertTrue(s == GovVote.State.Pending || s == GovVote.State.Active, "I6: ket qua truoc deadline");
                continue;
            }
            bool wins = p.forVotes + p.againstVotes >= gov.quorumVotes(id) && p.forVotes > p.againstVotes;
            if (s == GovVote.State.Succeeded) assertTrue(wins, "I6: Succeeded nhung khong du dieu kien");
            assertEq(s == GovVote.State.Succeeded, wins, "I6: du dieu kien nhung khong Succeeded");
            assertTrue(s == GovVote.State.Succeeded || s == GovVote.State.Defeated, "I6: sau deadline van mo");
        }
    }

    /// Kiểm tra nhanh rằng handler THỰC SỰ đi được các nhánh quan trọng (tránh invariant đúng một cách
    /// "rỗng" vì không bao giờ có phiếu hay không bao giờ tới Succeeded).
    function test_HandlerReachesKeyPaths() public {
        handler.roll(1);
        handler.propose(0); // actor0 có 300.000 GOV ở block trước
        assertEq(gov.proposalCount(), 1);

        handler.voteRejected(1, 0, true); // Pending => NotActive(1, Pending)
        handler.roll(DELAY + 1); // tới snapshot + 1
        assertEq(uint256(gov.state(1)), uint256(GovVote.State.Active));

        handler.vote(1, 0, true); // actor0 For 300.000
        handler.vote(1, 1, false); // actor1 Against 250.000
        handler.voteRejected(1, 0, false); // AlreadyVoted
        handler.voteRejected(1, 5, true); // actor5 không có quyền => NoVotingPower
        handler.transfer(0, 2, type(uint256).max); // chuyển hết token sau snapshot (bound về số dư)
        handler.proposeBelowThreshold(5); // actor5 => BelowThreshold(0, 1000 GOV)

        handler.roll(12);
        handler.roll(12); // qua deadline
        assertEq(uint256(gov.state(1)), uint256(GovVote.State.Succeeded));
        handler.voteRejected(1, 2, true); // NotActive(1, Succeeded)

        assertEq(handler.ghostTotalWeight(), 550_000 ether);
        assertTrue(handler.ghostFinalRecorded(1));
        invariant_I1_TallyWithinSnapshotSupply();
        invariant_I2_TallyMatchesGhostWeights();
        invariant_I3_ProposalCountNeverDecreases();
        invariant_I4_TallyFrozenAfterDeadline();
        invariant_I5_OneVotePerVoter();
        invariant_I6_SucceededImpliesQuorumAndMajority();
    }
}
