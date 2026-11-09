// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {GovToken} from "../src/GovToken.sol";
import {GovVote} from "../src/GovVote.sol";
import {MockVotesToken} from "./mocks/MockVotes.sol";

/// @notice Test GovVote. Bước 3: nhóm Proposal (constructor + propose).
///         Nhóm Timing/Vote/Quorum được bổ sung ở Bước 4 (cần state() và castVote()).
contract GovVoteTest is Test {
    // Cấu hình demo theo bảng "Quyết định đã chốt" của đặc tả.
    uint256 internal constant THRESHOLD = 1_000 ether; // 1.000 GOV
    uint256 internal constant QUORUM_BPS = 1_000; // 10%
    uint256 internal constant DELAY = 15; // block
    uint256 internal constant PERIOD = 7_200; // block

    uint256 internal constant PROPOSER_AMOUNT = 2_000 ether;

    GovToken internal token;
    GovVote internal gov;

    address internal recipient = makeAddr("recipient");
    address internal proposer = makeAddr("proposer");

    string internal constant TITLE = "Tai tro chu de Zero-Knowledge?";
    string internal constant DESCRIPTION = "Cong dong chon de tai hackathon.";

    function setUp() public {
        token = new GovToken(recipient);
        gov = new GovVote(IVotes(address(token)), THRESHOLD, QUORUM_BPS, DELAY, PERIOD);

        // Proposer nhận 2.000 GOV (> ngưỡng 1.000) và tự delegate.
        vm.prank(recipient);
        assertTrue(token.transfer(proposer, PROPOSER_AMOUNT));
        vm.prank(proposer);
        token.delegate(proposer);

        // Sang block kế tiếp để checkpoint delegate thuộc "block trước" khi propose.
        vm.roll(block.number + 1);
    }

    // =========================================================================
    //                                  HELPERS
    // =========================================================================

    /// @dev Lặp chuỗi `s` n lần (dùng để tạo title/description có độ dài byte chính xác).
    function _repeat(string memory s, uint256 n) internal pure returns (string memory out) {
        for (uint256 i = 0; i < n; i++) {
            out = string.concat(out, s);
        }
    }

    /// @dev Tạo ví mới có `amount` GOV, tự delegate, rồi sang block kế tiếp.
    function _fundAndDelegate(string memory name, uint256 amount) internal returns (address account) {
        account = makeAddr(name);
        vm.prank(recipient);
        assertTrue(token.transfer(account, amount));
        vm.prank(account);
        token.delegate(account);
        vm.roll(block.number + 1);
    }

    // =========================================================================
    //                            CONSTRUCTOR / CẤU HÌNH
    // =========================================================================

    /// Cấu hình sai phải revert InvalidConfiguration (quyết định đã chốt trong CLAUDE.md).
    function test_RevertWhenInvalidParameters() public {
        IVotes t = IVotes(address(token));

        // token = address(0)
        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(IVotes(address(0)), THRESHOLD, QUORUM_BPS, DELAY, PERIOD);

        // quorumBps = 0
        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(t, THRESHOLD, 0, DELAY, PERIOD);

        // quorumBps = 10001 (> 100%)
        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(t, THRESHOLD, 10_001, DELAY, PERIOD);

        // votingPeriodBlocks = 0
        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(t, THRESHOLD, QUORUM_BPS, DELAY, 0);
    }

    /// [Thêm] Giá trị biên hợp lệ phải deploy được: quorumBps = 1 và 10000, votingDelayBlocks = 0.
    function test_ConstructorAcceptsBoundaryValues() public {
        IVotes t = IVotes(address(token));

        GovVote minQuorum = new GovVote(t, THRESHOLD, 1, DELAY, PERIOD);
        assertEq(minQuorum.quorumBps(), 1);

        GovVote maxQuorum = new GovVote(t, THRESHOLD, 10_000, DELAY, PERIOD);
        assertEq(maxQuorum.quorumBps(), 10_000);

        GovVote noDelay = new GovVote(t, THRESHOLD, QUORUM_BPS, 0, PERIOD);
        assertEq(noDelay.votingDelayBlocks(), 0);

        // Cấu hình của gov trong setUp được lưu đúng.
        assertEq(address(gov.token()), address(token));
        assertEq(gov.proposalThreshold(), THRESHOLD);
        assertEq(gov.quorumBps(), QUORUM_BPS);
        assertEq(gov.votingDelayBlocks(), DELAY);
        assertEq(gov.votingPeriodBlocks(), PERIOD);
        assertEq(gov.proposalCount(), 0);
    }

    // =========================================================================
    //                                   PROPOSAL
    // =========================================================================

    /// 999 GOV đã delegate (thiếu 1 GOV so với ngưỡng) => BelowThreshold.
    function test_RevertWhenBelowThreshold() public {
        address small = _fundAndDelegate("small", 999 ether);

        vm.prank(small);
        vm.expectRevert(abi.encodeWithSelector(GovVote.BelowThreshold.selector, 999 ether, THRESHOLD));
        gov.propose(TITLE, DESCRIPTION);

        // Đúng bằng ngưỡng (1.000 GOV) thì được tạo: điều kiện là >=.
        address exact = _fundAndDelegate("exact", 1_000 ether);
        vm.prank(exact);
        assertEq(gov.propose(TITLE, DESCRIPTION), 1);
    }

    /// [Thêm] "Test phỏng vấn" mục 3.4: giữ 10.000 GOV nhưng chưa delegate => getPastVotes = 0 => revert.
    function test_RevertWhenBalanceButNoDelegation() public {
        address holder = makeAddr("holder");
        vm.prank(recipient);
        assertTrue(token.transfer(holder, 10_000 ether));
        vm.roll(block.number + 1);

        assertEq(token.balanceOf(holder), 10_000 ether);
        assertEq(token.getPastVotes(holder, block.number - 1), 0);

        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(GovVote.BelowThreshold.selector, 0, THRESHOLD));
        gov.propose(TITLE, DESCRIPTION);
    }

    /// [Thêm] Ngưỡng đọc ở block.number - 1: delegate rồi propose trong CÙNG block thì chưa được tính.
    function test_ThresholdReadsPreviousBlock() public {
        address late = makeAddr("late");
        vm.prank(recipient);
        assertTrue(token.transfer(late, 5_000 ether));

        // Cùng block: delegate xong, getVotes đã có 5.000 nhưng block trước vẫn là 0.
        vm.prank(late);
        token.delegate(late);
        assertEq(token.getVotes(late), 5_000 ether);

        vm.prank(late);
        vm.expectRevert(abi.encodeWithSelector(GovVote.BelowThreshold.selector, 0, THRESHOLD));
        gov.propose(TITLE, DESCRIPTION);

        // Sang block sau: checkpoint delegate đã thuộc quá khứ => tạo được.
        vm.roll(block.number + 1);
        vm.prank(late);
        assertEq(gov.propose(TITLE, DESCRIPTION), 1);
    }

    /// Title rỗng / quá 100 bytes bị chặn; đúng 100 bytes thì được.
    function test_RevertWhenTitleInvalid() public {
        vm.startPrank(proposer);

        vm.expectRevert(GovVote.EmptyTitle.selector);
        gov.propose("", DESCRIPTION);

        vm.expectRevert(abi.encodeWithSelector(GovVote.TitleTooLong.selector, 101));
        gov.propose(_repeat("a", 101), DESCRIPTION);

        // Giới hạn tính theo BYTES UTF-8: "ệ" = 3 bytes, 34 ký tự = 102 bytes > 100.
        string memory vietnamese = _repeat(unicode"ệ", 34);
        assertEq(bytes(vietnamese).length, 102);
        vm.expectRevert(abi.encodeWithSelector(GovVote.TitleTooLong.selector, 102));
        gov.propose(vietnamese, DESCRIPTION);

        // Biên hợp lệ: đúng 100 bytes.
        assertEq(gov.propose(_repeat("a", 100), DESCRIPTION), 1);
        // Biên hợp lệ: 1 byte.
        assertEq(gov.propose("a", DESCRIPTION), 2);

        vm.stopPrank();
    }

    /// Description quá 1000 bytes bị chặn; đúng 1000 bytes và rỗng thì được.
    function test_RevertWhenDescriptionTooLong() public {
        vm.startPrank(proposer);

        vm.expectRevert(abi.encodeWithSelector(GovVote.DescriptionTooLong.selector, 1_001));
        gov.propose(TITLE, _repeat("d", 1_001));

        assertEq(gov.propose(TITLE, _repeat("d", 1_000)), 1);
        assertEq(gov.propose(TITLE, ""), 2);

        vm.stopPrank();
    }

    /// [Thêm] Thứ tự kiểm tra đã chốt: title rỗng -> title dài -> description dài -> threshold.
    ///        Ví không có voting power gửi dữ liệu sai thì nhận lỗi dữ liệu trước, không phải BelowThreshold.
    function test_ValidationOrder() public {
        address nobody = makeAddr("nobody");
        string memory longTitle = _repeat("a", 101);
        string memory longDescription = _repeat("d", 1_001);

        vm.startPrank(nobody);

        vm.expectRevert(GovVote.EmptyTitle.selector);
        gov.propose("", longDescription);

        vm.expectRevert(abi.encodeWithSelector(GovVote.TitleTooLong.selector, 101));
        gov.propose(longTitle, longDescription);

        vm.expectRevert(abi.encodeWithSelector(GovVote.DescriptionTooLong.selector, 1_001));
        gov.propose(TITLE, longDescription);

        vm.expectRevert(abi.encodeWithSelector(GovVote.BelowThreshold.selector, 0, THRESHOLD));
        gov.propose(TITLE, DESCRIPTION);

        vm.stopPrank();
    }

    /// ProposalCreated phát đúng id, proposer, snapshotBlock = B + 15, deadlineBlock = snapshot + 7200.
    function test_ProposalCreatedEmitsSnapshotAndDeadline() public {
        uint256 b = block.number;
        uint256 expectedSnapshot = b + DELAY;
        uint256 expectedDeadline = expectedSnapshot + PERIOD;

        // Kiểm tra cả 2 topic indexed (id, proposer) và toàn bộ data (snapshot, deadline, title).
        vm.expectEmit(true, true, false, true, address(gov));
        emit GovVote.ProposalCreated(1, proposer, expectedSnapshot, expectedDeadline, TITLE);

        vm.prank(proposer);
        uint256 id = gov.propose(TITLE, DESCRIPTION);

        assertEq(id, 1);
        assertEq(gov.proposalCount(), 1);

        // Proposal thứ hai ở block sau: id tăng liên tục, mốc block tính lại theo block mới.
        vm.roll(b + 1);
        vm.expectEmit(true, true, false, true, address(gov));
        emit GovVote.ProposalCreated(2, proposer, b + 1 + DELAY, b + 1 + DELAY + PERIOD, "Second");

        vm.prank(proposer);
        assertEq(gov.propose("Second", ""), 2);
        assertEq(gov.proposalCount(), 2);
    }

    // =========================================================================
    //                          CẤU HÌNH: GIỚI HẠN uint48
    // =========================================================================

    /// votingDelayBlocks + votingPeriodBlocks phải <= uint48.max; kiểm tra không được tràn số.
    function test_RevertWhenVotingWindowExceedsUint48() public {
        IVotes t = IVotes(address(token));
        uint256 max48 = type(uint48).max;

        // Biên hợp lệ: tổng đúng bằng uint48.max.
        GovVote atLimit = new GovVote(t, THRESHOLD, QUORUM_BPS, max48 - PERIOD, PERIOD);
        assertEq(atLimit.votingDelayBlocks() + atLimit.votingPeriodBlocks(), max48);
        GovVote periodOnly = new GovVote(t, THRESHOLD, QUORUM_BPS, 0, max48);
        assertEq(periodOnly.votingPeriodBlocks(), max48);

        // Vượt 1 block => revert.
        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(t, THRESHOLD, QUORUM_BPS, max48 - PERIOD + 1, PERIOD);

        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(t, THRESHOLD, QUORUM_BPS, 1, max48);

        // period > uint48.max: phải là InvalidConfiguration, KHÔNG phải Panic 0x11 do underflow
        // ở phép (uint48.max - period).
        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(t, THRESHOLD, QUORUM_BPS, 0, max48 + 1);

        // delay cực lớn (uint256.max): nếu viết delay + period sẽ tràn; cách viết bằng phép trừ thì không.
        vm.expectRevert(GovVote.InvalidConfiguration.selector);
        new GovVote(t, THRESHOLD, QUORUM_BPS, type(uint256).max, PERIOD);
    }

    // =========================================================================
    //                         TIMING: state() THEO block.number
    // =========================================================================

    /// @dev Proposer tạo proposal ở block hiện tại; trả về id và hai mốc block mong đợi.
    function _propose() internal returns (uint256 id, uint256 snapshot, uint256 deadline) {
        vm.prank(proposer);
        id = gov.propose(TITLE, DESCRIPTION);
        snapshot = block.number + DELAY;
        deadline = snapshot + PERIOD;
    }

    /// Ngay tại snapshotBlock vẫn Pending (block đó chưa kết thúc, voting power chưa chốt).
    function test_PendingAtSnapshotBlock() public {
        (uint256 id, uint256 snapshot,) = _propose();

        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Pending), "ngay khi tao");

        vm.roll(snapshot - 1);
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Pending), "snapshot - 1");

        vm.roll(snapshot);
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Pending), "dung tai snapshot");
    }

    /// Từ snapshotBlock + 1 mới Active.
    function test_ActiveAfterSnapshotBlock() public {
        (uint256 id, uint256 snapshot,) = _propose();

        vm.roll(snapshot + 1);
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Active));
    }

    /// Block deadline vẫn Active (vẫn nhận phiếu).
    function test_ActiveAtDeadlineBlock() public {
        (uint256 id,, uint256 deadline) = _propose();

        vm.roll(deadline);
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Active));
    }

    /// Qua deadline mà không có phiếu nào: 0 < quorum => Defeated (không revert).
    function test_DefeatedAfterDeadlineWithoutVotes() public {
        (uint256 id,, uint256 deadline) = _propose();

        vm.roll(deadline + 1);
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Defeated));

        // Quorum đã đọc được: 10% của 1.000.000 GOV = 100.000 GOV; tally vẫn 0.
        assertEq(gov.quorumVotes(id), 100_000 ether);
        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes + p.againstVotes, 0);

        // Kết quả cuối cùng: rất lâu sau vẫn Defeated.
        vm.roll(deadline + 1_000_000);
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Defeated));
    }

    /// quorumVotes revert SnapshotNotFinalized(id, snapshotBlock) trong suốt Pending, kể cả tại snapshotBlock.
    function test_QuorumVotesRevertsWhilePending() public {
        (uint256 id, uint256 snapshot,) = _propose();
        bytes memory notFinalized = abi.encodeWithSelector(GovVote.SnapshotNotFinalized.selector, id, snapshot);

        vm.expectRevert(notFinalized);
        gov.quorumVotes(id);

        vm.roll(snapshot);
        vm.expectRevert(notFinalized);
        gov.quorumVotes(id);

        // state() trong Pending KHÔNG revert vì không đọc quorum ở nhánh Pending/Active.
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Pending));

        // Block ngay sau snapshot: tổng cung tại snapshot đã chốt => đọc được.
        vm.roll(snapshot + 1);
        assertEq(gov.quorumVotes(id), 100_000 ether);
    }

    /// id không tồn tại (0, hoặc > proposalCount) => ProposalNotFound(id) ở mọi hàm đọc.
    function test_RevertWhenProposalNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(GovVote.ProposalNotFound.selector, 1));
        gov.state(1);

        vm.expectRevert(abi.encodeWithSelector(GovVote.ProposalNotFound.selector, 0));
        gov.state(0);

        vm.expectRevert(abi.encodeWithSelector(GovVote.ProposalNotFound.selector, 1));
        gov.getProposal(1);

        vm.expectRevert(abi.encodeWithSelector(GovVote.ProposalNotFound.selector, 1));
        gov.quorumVotes(1);

        // Sau khi tạo proposal 1: id 1 hợp lệ, id 2 vẫn không tồn tại.
        (uint256 id,,) = _propose();
        assertEq(uint256(gov.state(id)), uint256(GovVote.State.Pending));

        vm.expectRevert(abi.encodeWithSelector(GovVote.ProposalNotFound.selector, 2));
        gov.state(2);
    }

    /// getProposal trả đúng mọi trường đã lưu khi propose.
    function test_GetProposalStoresFields() public {
        uint256 b = block.number;
        (uint256 id, uint256 snapshot, uint256 deadline) = _propose();

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.proposer, proposer);
        assertEq(p.title, TITLE);
        assertEq(p.description, DESCRIPTION);
        assertEq(p.createdBlock, b);
        assertEq(p.snapshotBlock, snapshot);
        assertEq(p.snapshotBlock, b + DELAY);
        assertEq(p.deadlineBlock, deadline);
        assertEq(p.deadlineBlock, b + DELAY + PERIOD);
        assertEq(p.forVotes, 0);
        assertEq(p.againstVotes, 0);
    }

    // =========================================================================
    //                              HELPERS CHO VOTE
    // =========================================================================

    /// @dev Tạo ví có `amount` GOV và tự delegate trong block hiện tại (KHÔNG roll).
    ///      Gọi trước _propose() thì checkpoint chắc chắn nằm trước snapshot.
    function _voter(string memory name, uint256 amount) internal returns (address v) {
        v = makeAddr(name);
        vm.prank(recipient);
        assertTrue(token.transfer(v, amount));
        vm.prank(v);
        token.delegate(v);
    }

    function _vote(address voter, uint256 id, bool support) internal {
        vm.prank(voter);
        gov.castVote(id, support);
    }

    function _assertState(uint256 id, GovVote.State expected) internal view {
        assertEq(uint256(gov.state(id)), uint256(expected));
    }

    /// @dev Kịch bản quorum: một ví For, một ví Against (nếu > 0), vote khi Active, rồi sang deadline + 1.
    function _runTally(uint256 forAmount, uint256 againstAmount) internal returns (uint256 id) {
        address yes = _voter("yes", forAmount);
        address no = againstAmount > 0 ? _voter("no", againstAmount) : address(0);

        uint256 snapshot;
        uint256 deadline;
        (id, snapshot, deadline) = _propose();

        vm.roll(snapshot + 1);
        _vote(yes, id, true);
        if (againstAmount > 0) _vote(no, id, false);

        vm.roll(deadline + 1);
    }

    // =========================================================================
    //                              VOTE: TRẠNG THÁI
    // =========================================================================

    /// Qua deadline thì không thêm phiếu được; error báo đúng trạng thái cuối (Defeated hoặc Succeeded).
    function test_RevertAfterDeadlineBlock() public {
        address alice = _voter("alice", 400_000 ether);
        (uint256 id,, uint256 deadline) = _propose();

        vm.roll(deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(GovVote.NotActive.selector, id, GovVote.State.Defeated));
        _vote(alice, id, true);

        // Proposal thứ hai Succeeded: vote muộn cũng bị chặn, error mang trạng thái Succeeded.
        (uint256 id2, uint256 snapshot2, uint256 deadline2) = _propose();
        vm.roll(snapshot2 + 1);
        _vote(alice, id2, true);
        vm.roll(deadline2 + 1);
        _assertState(id2, GovVote.State.Succeeded);

        vm.expectRevert(abi.encodeWithSelector(GovVote.NotActive.selector, id2, GovVote.State.Succeeded));
        _vote(proposer, id2, false);

        // Tally không đổi sau lần vote bị từ chối.
        assertEq(gov.getProposal(id2).againstVotes, 0);
    }

    /// [Thêm] Trong Pending (kể cả đúng tại snapshotBlock) không vote được: NotActive(id, Pending).
    function test_RevertWhenVotingWhilePending() public {
        address alice = _voter("alice", 400_000 ether);
        (uint256 id, uint256 snapshot,) = _propose();

        vm.expectRevert(abi.encodeWithSelector(GovVote.NotActive.selector, id, GovVote.State.Pending));
        _vote(alice, id, true);

        vm.roll(snapshot);
        vm.expectRevert(abi.encodeWithSelector(GovVote.NotActive.selector, id, GovVote.State.Pending));
        _vote(alice, id, true);
    }

    /// [Thêm] castVote với id không tồn tại => ProposalNotFound(id).
    function test_CastVoteRevertsWhenProposalNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(GovVote.ProposalNotFound.selector, 1));
        _vote(proposer, 1, true);
    }

    // =========================================================================
    //                              VOTE: TRỌNG SỐ
    // =========================================================================

    /// Cùng một ví không vote lần hai (cả cùng lựa chọn lẫn đổi lựa chọn).
    function test_RevertWhenAlreadyVoted() public {
        address alice = _voter("alice", 400_000 ether);
        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        _vote(alice, id, true);

        bytes memory already = abi.encodeWithSelector(GovVote.AlreadyVoted.selector, id, alice);
        vm.expectRevert(already);
        _vote(alice, id, true);

        vm.expectRevert(already);
        _vote(alice, id, false);

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes, 400_000 ether);
        assertEq(p.againstVotes, 0);
    }

    /// Weight trong VoteCast = getPastVotes(voter, snapshot); tally và hasVoted cập nhật đúng.
    function test_VoteWeightMatchesPastVotes() public {
        address alice = _voter("alice", 400_000 ether);
        address bob = _voter("bob", 250_000 ether);
        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        uint256 aliceWeight = token.getPastVotes(alice, snapshot);
        assertEq(aliceWeight, 400_000 ether);
        assertFalse(gov.hasVoted(id, alice));

        vm.expectEmit(true, true, false, true, address(gov));
        emit GovVote.VoteCast(id, alice, true, aliceWeight);
        _vote(alice, id, true);

        vm.expectEmit(true, true, false, true, address(gov));
        emit GovVote.VoteCast(id, bob, false, 250_000 ether);
        _vote(bob, id, false);

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes, aliceWeight);
        assertEq(p.againstVotes, token.getPastVotes(bob, snapshot));
        assertTrue(gov.hasVoted(id, alice));
        assertTrue(gov.hasVoted(id, bob));
        assertFalse(gov.hasVoted(id, proposer));
    }

    /// Hai ví khác nhau vote trong cùng một block: cả hai đều được cộng đúng.
    function test_TwoVotesInSameBlockBothCount() public {
        address alice = _voter("alice", 400_000 ether);
        address bob = _voter("bob", 250_000 ether);
        address carol = _voter("carol", 200_000 ether);
        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        uint256 voteBlock = block.number;
        _vote(alice, id, true);
        _vote(bob, id, true);
        _vote(carol, id, false);
        assertEq(block.number, voteBlock, "ca ba phieu trong cung mot block");

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes, 650_000 ether);
        assertEq(p.againstVotes, 200_000 ether);
    }

    /// Chuyển token sau snapshot: người gửi giữ trọng số đã chốt, người nhận không có thêm phiếu.
    function test_TransferAfterSnapshotDoesNotChangeTally() public {
        address alice = _voter("alice", 400_000 ether);
        address bob = _voter("bob", 250_000 ether);
        address carol = _voter("carol", 100_000 ether);
        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        // Alice vote xong rồi chuyển HẾT token cho Carol: tally For không đổi.
        _vote(alice, id, true);
        vm.prank(alice);
        assertTrue(token.transfer(carol, 400_000 ether));
        assertEq(token.balanceOf(alice), 0);
        assertEq(gov.getProposal(id).forVotes, 400_000 ether);

        // Bob chuyển hết cho Carol TRƯỚC khi vote: vẫn vote được với trọng số tại snapshot.
        vm.prank(bob);
        assertTrue(token.transfer(carol, 250_000 ether));
        assertEq(token.getVotes(bob), 0);
        _vote(bob, id, false);

        // Carol hiện có 750.000 voting power, nhưng phiếu chỉ được tính 100.000 (giá trị tại snapshot).
        assertEq(token.getVotes(carol), 750_000 ether);
        _vote(carol, id, false);

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes, 400_000 ether);
        assertEq(p.againstVotes, 250_000 ether + 100_000 ether);
    }

    // =========================================================================
    //                         VOTE: DELEGATE VÀ SNAPSHOT
    // =========================================================================

    /// Delegate trước khi snapshot kết thúc (kể cả ngay trong snapshotBlock) thì được tính.
    function test_DelegateBeforeSnapshotCounts() public {
        address holder = makeAddr("holder");
        vm.prank(recipient);
        assertTrue(token.transfer(holder, 50_000 ether));

        (uint256 id, uint256 snapshot,) = _propose();

        // Block cuối cùng của Pending: getPastVotes(snapshot) đọc giá trị CUỐI block snapshot,
        // nên delegate trong chính block này vẫn được tính.
        vm.roll(snapshot);
        vm.prank(holder);
        token.delegate(holder);

        vm.roll(snapshot + 1);
        assertEq(gov.getVotingPowerAt(id, holder), 50_000 ether);

        vm.expectEmit(true, true, false, true, address(gov));
        emit GovVote.VoteCast(id, holder, true, 50_000 ether);
        _vote(holder, id, true);
    }

    /// Delegate sau snapshot thì không có trọng số cho proposal này.
    function test_DelegateAfterSnapshotDoesNotCount() public {
        address holder = makeAddr("holder");
        vm.prank(recipient);
        assertTrue(token.transfer(holder, 50_000 ether));

        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        vm.prank(holder);
        token.delegate(holder);
        assertEq(token.getVotes(holder), 50_000 ether, "voting power hien tai da co");
        assertEq(gov.getVotingPowerAt(id, holder), 0, "nhung tai snapshot = 0");

        vm.expectRevert(abi.encodeWithSelector(GovVote.NoVotingPower.selector, id, holder));
        _vote(holder, id, true);
    }

    /// Giữ 10.000 GOV nhưng chưa từng delegate => NoVotingPower.
    function test_RevertWhenNotDelegated() public {
        address holder = makeAddr("holder");
        vm.prank(recipient);
        assertTrue(token.transfer(holder, 10_000 ether));

        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        assertEq(token.balanceOf(holder), 10_000 ether);
        vm.expectRevert(abi.encodeWithSelector(GovVote.NoVotingPower.selector, id, holder));
        _vote(holder, id, true);
    }

    /// Token "vay" đến SAU snapshot, delegate rồi vote ngay => NoVotingPower.
    /// Giới hạn (mục 2.4): test này KHÔNG chứng minh chống mọi flash-loan. Token vay/mua TRƯỚC snapshot
    /// và delegate kịp trước khi snapshot kết thúc vẫn được tính (xem test_DelegateBeforeSnapshotCounts).
    function test_FlashLoanVoteDoesNotCount() public {
        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        // Mô phỏng khoản vay trong một block: nhận 300.000 GOV, delegate, vote, trả lại.
        address borrower = makeAddr("borrower");
        vm.prank(recipient);
        assertTrue(token.transfer(borrower, 300_000 ether));
        vm.prank(borrower);
        token.delegate(borrower);
        assertEq(token.getVotes(borrower), 300_000 ether);

        vm.expectRevert(abi.encodeWithSelector(GovVote.NoVotingPower.selector, id, borrower));
        _vote(borrower, id, true);

        vm.prank(borrower);
        assertTrue(token.transfer(recipient, 300_000 ether));

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes + p.againstVotes, 0);
    }

    /// getVotingPowerAt revert SnapshotNotFinalized(id, snapshot) trong Pending, kể cả tại snapshotBlock.
    function test_GetVotingPowerAtRevertsWhilePending() public {
        address alice = _voter("alice", 400_000 ether);
        (uint256 id, uint256 snapshot,) = _propose();
        bytes memory notFinalized = abi.encodeWithSelector(GovVote.SnapshotNotFinalized.selector, id, snapshot);

        vm.expectRevert(notFinalized);
        gov.getVotingPowerAt(id, alice);

        vm.roll(snapshot);
        vm.expectRevert(notFinalized);
        gov.getVotingPowerAt(id, alice);

        vm.expectRevert(abi.encodeWithSelector(GovVote.ProposalNotFound.selector, 2));
        gov.getVotingPowerAt(2, alice);

        vm.roll(snapshot + 1);
        assertEq(gov.getVotingPowerAt(id, alice), 400_000 ether);
    }

    /// getVotingPowerAt trả voting power tại snapshot (gồm cả phần được người khác delegate tới),
    /// không đổi khi token di chuyển sau snapshot, và bằng đúng weight khi vote.
    function test_GetVotingPowerAtReturnsSnapshotPower() public {
        address alice = _voter("alice", 400_000 ether);
        address bob = _voter("bob", 250_000 ether);
        vm.prank(bob);
        token.delegate(alice); // Bob giao quyền cho Alice, Bob vẫn giữ token.

        (uint256 id, uint256 snapshot,) = _propose();
        vm.roll(snapshot + 1);

        assertEq(gov.getVotingPowerAt(id, alice), 650_000 ether);
        assertEq(gov.getVotingPowerAt(id, bob), 0);
        assertEq(gov.getVotingPowerAt(id, makeAddr("stranger")), 0);

        // Sau snapshot Alice chuyển 100.000 GOV đi: hiện tại giảm, tại snapshot giữ nguyên.
        vm.prank(alice);
        assertTrue(token.transfer(recipient, 100_000 ether));
        assertEq(token.getVotes(alice), 550_000 ether);
        assertEq(gov.getVotingPowerAt(id, alice), 650_000 ether);

        _vote(alice, id, true);
        assertEq(gov.getProposal(id).forVotes, gov.getVotingPowerAt(id, alice));

        // Bob không tự vote được: voting power của Bob đã giao cho Alice.
        vm.expectRevert(abi.encodeWithSelector(GovVote.NoVotingPower.selector, id, bob));
        _vote(bob, id, false);
    }

    // =========================================================================
    //                    QUORUM: 10% TỔNG CUNG = 100.000 GOV, ĐO FOR + AGAINST
    // =========================================================================

    /// 11 For / 10 Against: For thắng nhưng 21 GOV < 100.000 GOV quorum => Defeated.
    function test_DefeatedWhenQuorumNotMet() public {
        uint256 id = _runTally(11 ether, 10 ether);

        assertEq(gov.quorumVotes(id), 100_000 ether);
        GovVote.Proposal memory p = gov.getProposal(id);
        assertGt(p.forVotes, p.againstVotes);
        _assertState(id, GovVote.State.Defeated);
    }

    /// 60.000 For / 40.000 Against: tham gia = 100.000 = quorum (điều kiện >=) và For thắng => Succeeded.
    function test_SucceedsWhenQuorumMet() public {
        uint256 id = _runTally(60_000 ether, 40_000 ether);

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes + p.againstVotes, gov.quorumVotes(id));
        _assertState(id, GovVote.State.Succeeded);
    }

    /// 60.000 For / 0 Against: For thắng tuyệt đối nhưng 60.000 < 100.000 => Defeated.
    /// Trade-off có chủ đích (mục 2.5): nếu thêm 40.000 Against thì lại đạt quorum và Succeeded.
    function test_DefeatedWhenForOnlyBelowQuorum() public {
        uint256 id = _runTally(60_000 ether, 0);

        assertEq(gov.getProposal(id).againstVotes, 0);
        _assertState(id, GovVote.State.Defeated);
    }

    /// 50.000 / 50.000: đạt quorum nhưng hòa => Defeated (cần For > Against, không phải >=).
    function test_DefeatedOnTie() public {
        uint256 id = _runTally(50_000 ether, 50_000 ether);

        GovVote.Proposal memory p = gov.getProposal(id);
        assertGe(p.forVotes + p.againstVotes, gov.quorumVotes(id));
        _assertState(id, GovVote.State.Defeated);
    }

    /// [Thêm] 49.999 For / 50.001 Against: đạt quorum nhưng Against thắng => Defeated (bảng mục 2.5).
    function test_DefeatedWhenAgainstWins() public {
        uint256 id = _runTally(49_999 ether, 50_001 ether);
        _assertState(id, GovVote.State.Defeated);
    }

    /// 60.000 For / 39.999 Against: thiếu 1 GOV so với quorum => Defeated.
    /// Quorum tính trên TOÀN BỘ tổng cung tại snapshot, kể cả GOV chưa delegate (phần lớn đang nằm ở
    /// recipient và không có voting power), nên GOV không delegate làm ngưỡng khó đạt hơn.
    function test_UndelegatedSupplyRaisesQuorumBar() public {
        uint256 id = _runTally(60_000 ether, 39_999 ether);
        uint256 snapshot = gov.getProposal(id).snapshotBlock;

        // Tổng cung tại snapshot là 1.000.000 GOV, nhưng recipient giữ phần lớn mà không delegate.
        assertEq(token.getPastTotalSupply(snapshot), 1_000_000 ether);
        assertGt(token.balanceOf(recipient), 800_000 ether);
        assertEq(token.getPastVotes(recipient, snapshot), 0);
        // Ngưỡng vẫn là 10% của 1.000.000, không phải 10% của phần đã delegate.
        assertEq(gov.quorumVotes(id), 100_000 ether);

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.forVotes + p.againstVotes, 99_999 ether);
        _assertState(id, GovVote.State.Defeated);
    }

    // =========================================================================
    //                                 INTEGRATION
    // =========================================================================

    /// Delegate -> propose -> Pending -> Active -> vote (cả ở block deadline) -> deadline + 1 -> Succeeded.
    function test_FullLifecycle() public {
        // 1. Phân phối và delegate (Bob giao quyền cho Alice).
        address alice = _voter("alice", 400_000 ether);
        address bob = makeAddr("bob");
        vm.prank(recipient);
        assertTrue(token.transfer(bob, 250_000 ether));
        vm.prank(bob);
        token.delegate(alice);
        address charlie = _voter("charlie", 200_000 ether);
        address david = _voter("david", 100_000 ether);
        vm.roll(block.number + 1); // để checkpoint delegate thuộc "block trước" khi Alice propose.

        // 2. Alice tạo proposal.
        uint256 created = block.number;
        vm.prank(alice);
        uint256 id = gov.propose(TITLE, DESCRIPTION);
        uint256 snapshot = created + DELAY;
        uint256 deadline = snapshot + PERIOD;

        // 3. Pending: chưa vote được, quorum chưa chốt.
        _assertState(id, GovVote.State.Pending);
        vm.expectRevert(abi.encodeWithSelector(GovVote.NotActive.selector, id, GovVote.State.Pending));
        _vote(alice, id, true);
        vm.expectRevert(abi.encodeWithSelector(GovVote.SnapshotNotFinalized.selector, id, snapshot));
        gov.quorumVotes(id);

        // 4. Active: Alice (650.000 gồm phần Bob giao) vote For, David vote Against.
        vm.roll(snapshot + 1);
        _assertState(id, GovVote.State.Active);
        assertEq(gov.quorumVotes(id), 100_000 ether);
        _vote(alice, id, true);
        _vote(david, id, false);

        // 5. Đúng block deadline vẫn nhận phiếu: Charlie vote For.
        vm.roll(deadline);
        _assertState(id, GovVote.State.Active);
        _vote(charlie, id, true);

        // 6. Qua deadline: kết quả cuối cùng.
        vm.roll(deadline + 1);
        _assertState(id, GovVote.State.Succeeded);
        vm.expectRevert(abi.encodeWithSelector(GovVote.NotActive.selector, id, GovVote.State.Succeeded));
        _vote(proposer, id, false);

        // 7. Đối chiếu storage.
        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(p.proposer, alice);
        assertEq(p.title, TITLE);
        assertEq(p.description, DESCRIPTION);
        assertEq(p.createdBlock, created);
        assertEq(p.snapshotBlock, snapshot);
        assertEq(p.deadlineBlock, deadline);
        assertEq(p.forVotes, 650_000 ether + 200_000 ether);
        assertEq(p.againstVotes, 100_000 ether);
        assertTrue(gov.hasVoted(id, alice));
        assertTrue(gov.hasVoted(id, charlie));
        assertTrue(gov.hasVoted(id, david));
        assertFalse(gov.hasVoted(id, bob));
    }

    // =========================================================================
    //                  QUORUM VỚI MOCK (tổng cung thay đổi được)
    // =========================================================================
    // GovToken có tổng cung cố định nên không phân biệt được "tổng cung tại snapshot" với
    // "tổng cung hiện tại". Hai test dưới dùng MockVotesToken (chỉ có trong test/) để làm điều đó.

    /// Quorum = 10% tổng cung TẠI SNAPSHOT; mint/burn sau snapshot không làm đổi ngưỡng.
    function test_QuorumUsesSnapshotSupply() public {
        MockVotesToken mock = new MockVotesToken();
        address deployer = makeAddr("deployer");

        // Tổng cung trước snapshot: 2.000 (proposer) + 1.000.000 (deployer) = 1.002.000 GOV.
        mock.mint(proposer, 2_000 ether);
        mock.mint(deployer, 1_000_000 ether);
        vm.prank(proposer);
        mock.delegate(proposer);
        vm.roll(block.number + 1); // checkpoint delegate thuộc block trước khi propose.

        GovVote mockGov = new GovVote(IVotes(address(mock)), THRESHOLD, QUORUM_BPS, DELAY, PERIOD);
        vm.prank(proposer);
        uint256 id = mockGov.propose(TITLE, DESCRIPTION);
        uint256 snapshot = block.number + DELAY;

        // Sau snapshot: mint thêm 1.000.000 GOV => tổng cung hiện tại 2.002.000 GOV.
        vm.roll(snapshot + 1);
        mock.mint(deployer, 1_000_000 ether);
        assertEq(mock.totalSupply(), 2_002_000 ether);
        assertEq(mock.getPastTotalSupply(snapshot), 1_002_000 ether);

        // 10% của 1.002.000 = 100.200 GOV (nếu dùng tổng cung hiện tại sẽ là 200.200 GOV).
        assertEq(mockGov.quorumVotes(id), 100_200 ether);

        // Chiều ngược lại: burn sau snapshot cũng không hạ ngưỡng.
        vm.roll(snapshot + 2);
        mock.burn(deployer, 1_500_000 ether);
        assertEq(mock.totalSupply(), 502_000 ether);
        assertEq(mockGov.quorumVotes(id), 100_200 ether);
    }

    /// Quorum làm tròn LÊN: tổng cung 999 đơn vị => ceil(99,9) = 100, không phải 99.
    ///
    /// Vì sao đây là bằng chứng cho nhánh Math.Rounding.Ceil mà Bước 4 chưa kiểm chứng?
    ///   Với GovToken, tổng cung 10^24 nhân bất kỳ quorumBps nào cũng chia hết cho 10^4, nên Floor và Ceil
    ///   cho CÙNG kết quả; mọi test ở Bước 4 vẫn pass nếu ai đó lỡ đổi sang Floor. Chỉ khi
    ///   supply * bps không chia hết cho 10^4 (999 * 1000 = 999.000, dư 9.000) thì hai cách mới khác nhau.
    ///   Test này cũng chứng minh hệ quả về hành vi: 99 phiếu For (9,9% tổng cung) KHÔNG đạt quorum 10%,
    ///   trong khi nếu làm tròn xuống thì proposal đó sẽ Succeeded.
    function test_QuorumRoundsUp() public {
        MockVotesToken mock = new MockVotesToken();
        address small = makeAddr("small");
        address rest = makeAddr("rest");

        // Tổng cung đúng 999 đơn vị (wei): small 99, rest 900. Chỉ small delegate.
        mock.mint(small, 99);
        mock.mint(rest, 900);
        vm.prank(small);
        mock.delegate(small);

        // proposalThreshold = 0 chỉ để test dễ dựng số (ai cũng propose được).
        GovVote mockGov = new GovVote(IVotes(address(mock)), 0, 1_000, DELAY, PERIOD);
        vm.prank(small);
        uint256 id = mockGov.propose(TITLE, DESCRIPTION);
        uint256 snapshot = block.number + DELAY;
        uint256 deadline = snapshot + PERIOD;

        vm.roll(snapshot + 1);
        assertEq(mock.getPastTotalSupply(snapshot), 999);
        assertEq(uint256(999 * 1_000) / 10_000, 99, "chia nguyen thuong lam tron xuong");
        assertEq(mockGov.quorumVotes(id), 100, "Ceil: 99,9 -> 100");

        // Hệ quả: 99 phiếu For (= 9,9%) < 100 => Defeated. Với Floor (99) proposal này sẽ Succeeded.
        vm.prank(small);
        mockGov.castVote(id, true);
        vm.roll(deadline + 1);
        assertEq(uint256(mockGov.state(id)), uint256(GovVote.State.Defeated));

        // Biên không lẻ: mint thêm 1 => tổng cung 1000, proposal mới có quorum đúng 100 (chia hết).
        mock.mint(rest, 1);
        vm.prank(small);
        uint256 id2 = mockGov.propose(TITLE, DESCRIPTION);
        uint256 snapshot2 = block.number + DELAY;
        vm.roll(snapshot2 + 1);
        assertEq(mock.getPastTotalSupply(snapshot2), 1_000);
        assertEq(mockGov.quorumVotes(id2), 100);

        // Proposal cũ vẫn giữ quorum theo snapshot của nó (supply 999).
        assertEq(mockGov.quorumVotes(id), 100);
        assertEq(mock.getPastTotalSupply(snapshot), 999);
    }
}
