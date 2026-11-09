// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {GovToken} from "../src/GovToken.sol";
import {GovVote} from "../src/GovVote.sol";

/// @notice Fuzz test GovVote (đặc tả mục 4.3). Số lần chạy lấy từ foundry.toml: [fuzz] runs = 1000.
///
/// Vì sao phải dùng bound() cho đầu vào?
///   Fuzzer sinh uint256 bất kỳ trong [0, 2^256 - 1]. Gần như mọi giá trị đều lớn hơn tổng cung
///   10^24, nên nếu dùng thẳng thì transfer revert vì thiếu số dư: đó là đầu vào VÔ NGHĨA, không phải lỗi
///   của GovVote, và lần chạy đó không kiểm tra được thuộc tính nào cả.
///   - bound(x, min, max) ÁNH XẠ mọi x vào [min, max], nên lần chạy nào cũng là một kịch bản hợp lệ.
///   - vm.assume(điều kiện) thì BỎ lần chạy không thỏa; với khoảng hẹp như [1, 10^24] trong 2^256,
///     gần như mọi lần đều bị bỏ, fuzzer chạm giới hạn max_assume_rejects và dừng test.
///   - bound cũng giữ các giá trị biên quan trọng (min, max) xuất hiện thường xuyên.
contract GovVoteFuzzTest is Test {
    uint256 internal constant SUPPLY = 1_000_000 ether;
    uint256 internal constant THRESHOLD = 1_000 ether;
    uint256 internal constant QUORUM_BPS = 1_000;
    uint256 internal constant DELAY = 15;
    uint256 internal constant PERIOD = 7_200;

    GovToken internal token;
    GovVote internal gov;
    address internal recipient = makeAddr("recipient");

    function setUp() public {
        token = new GovToken(recipient);
        gov = new GovVote(IVotes(address(token)), THRESHOLD, QUORUM_BPS, DELAY, PERIOD);
    }

    /// @dev Chuyển `amount` GOV từ recipient sang `to`; nếu `selfDelegate` thì `to` tự delegate.
    function _fund(address to, uint256 amount, bool selfDelegate) internal {
        vm.prank(recipient);
        assertTrue(token.transfer(to, amount));
        if (selfDelegate) {
            vm.prank(to);
            token.delegate(to);
        }
    }

    /// @dev Proposer có đúng THRESHOLD GOV đã delegate, tạo proposal ở block kế tiếp.
    function _proposeWithFreshProposer() internal returns (uint256 id, uint256 snapshot) {
        address proposer = makeAddr("proposer");
        _fund(proposer, THRESHOLD, true);
        vm.roll(block.number + 1);
        vm.prank(proposer);
        id = gov.propose("Fuzz proposal", "");
        snapshot = block.number + DELAY;
    }

    /// Thuộc tính: weight trong VoteCast luôn = getPastVotes(voter, snapshot), với mọi số dư và lựa chọn,
    /// kể cả khi voter đã chuyển bớt token đi sau snapshot (số dư hiện tại không ảnh hưởng).
    function testFuzz_WeightEqualsPastVotes(uint256 amount, bool support, uint256 movedAfterSnapshot) public {
        // amount >= 1: voter có voting power (amount = 0 là kịch bản NoVotingPower, đã có unit test riêng).
        // amount <= SUPPLY - THRESHOLD: phần còn lại sau khi trích THRESHOLD cho proposer.
        amount = bound(amount, 1, SUPPLY - THRESHOLD);

        address voter = makeAddr("voter");
        _fund(voter, amount, true);
        (uint256 id, uint256 snapshot) = _proposeWithFreshProposer();

        vm.roll(snapshot + 1);
        // Sau snapshot voter chuyển đi một phần ngẫu nhiên (0..toàn bộ) số dư.
        uint256 moved = bound(movedAfterSnapshot, 0, amount);
        vm.prank(voter);
        assertTrue(token.transfer(recipient, moved));

        uint256 expected = token.getPastVotes(voter, snapshot);
        assertEq(expected, amount, "snapshot giu nguyen so du da delegate");
        assertEq(token.getVotes(voter), amount - moved, "voting power hien tai da giam");

        vm.expectEmit(true, true, false, true, address(gov));
        emit GovVote.VoteCast(id, voter, support, expected);
        vm.prank(voter);
        gov.castVote(id, support);

        GovVote.Proposal memory p = gov.getProposal(id);
        assertEq(support ? p.forVotes : p.againstVotes, expected);
        assertEq(support ? p.againstVotes : p.forVotes, 0);
    }

    /// Thuộc tính: propose thành công KHI VÀ CHỈ KHI voting power tại block trước >= proposalThreshold.
    /// @param nearBoundary true: dồn đầu vào vào ±3 wei quanh ngưỡng, để chắc chắn chạm biên chính xác
    ///        (THRESHOLD - 1, THRESHOLD, THRESHOLD + 1). Nếu chỉ bound trên [0, SUPPLY] thì xác suất
    ///        rơi đúng vào biên là khoảng 7 / 10^24, gần như không bao giờ.
    function testFuzz_ThresholdBoundary(uint256 amount, bool nearBoundary) public {
        amount = nearBoundary ? bound(amount, THRESHOLD - 3, THRESHOLD + 3) : bound(amount, 0, SUPPLY);

        address proposer = makeAddr("proposer");
        _fund(proposer, amount, true);
        vm.roll(block.number + 1);
        assertEq(token.getPastVotes(proposer, block.number - 1), amount);

        vm.prank(proposer);
        if (amount >= THRESHOLD) {
            assertEq(gov.propose("Fuzz proposal", ""), 1);
            assertEq(gov.proposalCount(), 1);
        } else {
            vm.expectRevert(abi.encodeWithSelector(GovVote.BelowThreshold.selector, amount, THRESHOLD));
            gov.propose("Fuzz proposal", "");
            assertEq(gov.proposalCount(), 0);
        }
    }

    /// Thuộc tính: với nhiều voter, delegate ngẫu nhiên, lựa chọn ngẫu nhiên, và token được chuyền tay
    /// SAU snapshot để thử dùng lại, tổng forVotes + againstVotes luôn <= getPastTotalSupply(snapshot),
    /// và đúng bằng tổng weight của các phiếu được chấp nhận.
    function testFuzz_TallyNeverExceedsSupply(uint256 seed, uint256 voterCount) public {
        // 1..20 voter: đủ đa dạng, mà mỗi lần chạy vẫn nhanh (1000 runs).
        uint256 n = bound(voterCount, 1, 20);
        address[] memory voters = new address[](n);

        (uint256 id, uint256 snapshot) = (0, 0);
        uint256 remaining = SUPPLY - THRESHOLD; // THRESHOLD để dành cho proposer

        // Phân phối: mỗi voter nhận >= 1 wei, những voter sau vẫn còn ít nhất 1 wei mỗi người.
        for (uint256 i = 0; i < n; i++) {
            voters[i] = makeAddr(string.concat("voter", vm.toString(i)));
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            uint256 amount = bound(r, 1, remaining - (n - 1 - i));
            remaining -= amount;
            _fund(voters[i], amount, false);
        }
        // Delegate ngẫu nhiên: tự delegate, hoặc giao cho voter khác (gom quyền), trước snapshot.
        for (uint256 i = 0; i < n; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, "delegate", i)));
            address delegatee = (r % 3 == 0) ? voters[r % n] : voters[i];
            vm.prank(voters[i]);
            token.delegate(delegatee);
        }

        (id, snapshot) = _proposeWithFreshProposer();
        vm.roll(snapshot + 1);

        uint256 accepted;
        for (uint256 i = 0; i < n; i++) {
            uint256 weight = token.getPastVotes(voters[i], snapshot);
            bool support = uint256(keccak256(abi.encode(seed, "support", i))) % 2 == 0;

            vm.prank(voters[i]);
            if (weight == 0) {
                // Đã giao hết quyền cho người khác: phải bị từ chối, không được cộng 0 vào tally.
                vm.expectRevert(abi.encodeWithSelector(GovVote.NoVotingPower.selector, id, voters[i]));
                gov.castVote(id, support);
            } else {
                gov.castVote(id, support);
                accepted += weight;
            }

            // Thử dùng lại token: chuyển toàn bộ số dư cho voter kế tiếp (người đó chưa vote).
            if (i + 1 < n) {
                uint256 bal = token.balanceOf(voters[i]);
                vm.prank(voters[i]);
                assertTrue(token.transfer(voters[i + 1], bal));
            }
        }

        GovVote.Proposal memory p = gov.getProposal(id);
        uint256 tally = p.forVotes + p.againstVotes;
        assertLe(tally, token.getPastTotalSupply(snapshot), "tally vuot tong cung tai snapshot");
        assertEq(tally, accepted, "tally khac tong weight duoc chap nhan");
        // Mọi voter đều đã delegate (cho mình hoặc người khác trong nhóm) nên toàn bộ phần đã phân phối được đếm.
        assertEq(tally, SUPPLY - THRESHOLD - remaining);
    }
}
