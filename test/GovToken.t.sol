// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {GovToken} from "../src/GovToken.sol";
import {Votes} from "@openzeppelin/contracts/governance/utils/Votes.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @notice Test nhóm Token (đặc tả mục 4.2): tổng cung cố định, transfer, delegation, checkpoint.
contract GovTokenTest is Test {
    GovToken internal token;

    // makeAddr tạo địa chỉ giả có nhãn, giúp trace dễ đọc. Không có private key thật nào ở đây.
    address internal recipient = makeAddr("recipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ALICE_AMOUNT = 400_000 ether;
    uint256 internal constant BOB_AMOUNT = 250_000 ether;

    function setUp() public {
        // Foundry bắt đầu test ở block 1. Token được deploy (và mint) ở block này.
        token = new GovToken(recipient);

        // Phân phối giống phân bổ demo (mục 2.1) cho hai ví, CHƯA delegate.
        vm.startPrank(recipient);
        assertTrue(token.transfer(alice, ALICE_AMOUNT));
        assertTrue(token.transfer(bob, BOB_AMOUNT));
        vm.stopPrank();
    }

    /// Kiểm tra: tổng cung = 1.000.000 GOV, mint đúng một lần cho recipient,
    /// không có hàm mint công khai, và transfer không làm thay đổi tổng cung.
    function test_TotalSupplyFixed() public {
        assertEq(token.TOTAL_SUPPLY(), 1_000_000 ether);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
        assertEq(token.decimals(), 18);
        assertEq(token.name(), "GovVote Token");
        assertEq(token.symbol(), "GOV");

        // Toàn bộ cung nằm ở recipient + 2 ví đã nhận, không có token nào khác.
        assertEq(token.balanceOf(recipient) + token.balanceOf(alice) + token.balanceOf(bob), token.TOTAL_SUPPLY());

        // Không có hàm mint(address,uint256): gọi low-level sẽ thất bại vì contract không có
        // hàm đó và cũng không có fallback.
        (bool ok,) = address(token).call(abi.encodeWithSignature("mint(address,uint256)", alice, 1 ether));
        assertFalse(ok, "mint() khong duoc ton tai");

        // Chuyển qua lại không làm đổi tổng cung.
        vm.prank(alice);
        assertTrue(token.transfer(bob, 1 ether));
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    /// Kiểm tra: có token (balanceOf) KHÔNG đồng nghĩa có voting power (getVotes).
    /// Voting power chỉ xuất hiện sau delegate().
    function test_TransferDoesNotCreateVotes() public {
        // Bob đã nhận 250.000 GOV nhưng chưa delegate.
        assertEq(token.balanceOf(bob), BOB_AMOUNT);
        assertEq(token.getVotes(bob), 0);
        assertEq(token.delegates(bob), address(0));

        // Recipient vẫn giữ 350.000 GOV nhưng cũng chưa delegate nên voting power = 0.
        assertEq(token.getVotes(recipient), 0);

        // Bob tự delegate: checkpoint bắt đầu ghi voting power bằng số dư hiện tại.
        vm.prank(bob);
        token.delegate(bob);
        assertEq(token.getVotes(bob), BOB_AMOUNT);

        // Alice (chưa delegate) chuyển cho Bob (đã delegate): Bob nhận thêm voting power,
        // vì chiều nhận có delegatee. Chiều gửi không có delegatee nên không bị trừ gì.
        vm.prank(alice);
        assertTrue(token.transfer(bob, 1_000 ether));
        assertEq(token.getVotes(bob), BOB_AMOUNT + 1_000 ether);

        // Bob (đã delegate) chuyển cho Alice (chưa delegate): Bob mất voting power,
        // nhưng Alice KHÔNG nhận được voting power nào, vì Alice chưa delegate.
        vm.prank(bob);
        assertTrue(token.transfer(alice, 2_000 ether));
        assertEq(token.balanceOf(alice), ALICE_AMOUNT - 1_000 ether + 2_000 ether);
        assertEq(token.getVotes(alice), 0);
        assertEq(token.getVotes(bob), BOB_AMOUNT + 1_000 ether - 2_000 ether);
    }

    /// Kiểm tra: delegate cho chính mình và delegate cho người khác; delegate không chuyển token.
    function test_DelegateSelfAndOther() public {
        // Alice tự delegate.
        vm.prank(alice);
        token.delegate(alice);
        assertEq(token.delegates(alice), alice);
        assertEq(token.getVotes(alice), ALICE_AMOUNT);

        // Bob delegate cho Alice: Alice có voting power của cả hai, Bob = 0,
        // nhưng Bob vẫn giữ nguyên số token.
        vm.expectEmit(true, true, true, true, address(token));
        emit IVotes.DelegateChanged(bob, address(0), alice);
        vm.prank(bob);
        token.delegate(alice);

        assertEq(token.delegates(bob), alice);
        assertEq(token.getVotes(alice), ALICE_AMOUNT + BOB_AMOUNT);
        assertEq(token.getVotes(bob), 0);
        assertEq(token.balanceOf(bob), BOB_AMOUNT);
        assertEq(token.balanceOf(alice), ALICE_AMOUNT);

        // Bob đổi ý, delegate lại cho chính mình: voting power chuyển về Bob.
        vm.prank(bob);
        token.delegate(bob);
        assertEq(token.getVotes(alice), ALICE_AMOUNT);
        assertEq(token.getVotes(bob), BOB_AMOUNT);
    }

    /// Kiểm tra: checkpoint ghi theo block.number; getPastVotes đọc được giá trị cuối mỗi block đã qua,
    /// và KHÔNG đọc được block hiện tại (lý do Active chỉ bắt đầu sau snapshotBlock).
    function test_PastVotesRecordedByBlock() public {
        // Clock của token là block.number (không override).
        assertEq(token.clock(), block.number);
        assertEq(token.CLOCK_MODE(), "mode=blocknumber&from=default");

        // Block 10: Alice tự delegate (400.000 GOV).
        vm.roll(10);
        vm.prank(alice);
        token.delegate(alice);

        // Block 11: Alice chuyển 100.000 GOV cho Bob (chưa delegate).
        vm.roll(11);
        vm.prank(alice);
        assertTrue(token.transfer(bob, 100_000 ether));

        // Block 12: đọc lại lịch sử.
        vm.roll(12);
        assertEq(token.getPastVotes(alice, 9), 0, "truoc khi delegate");
        assertEq(token.getPastVotes(alice, 10), ALICE_AMOUNT, "cuoi block 10");
        assertEq(token.getPastVotes(alice, 11), ALICE_AMOUNT - 100_000 ether, "cuoi block 11");
        assertEq(token.getPastVotes(bob, 11), 0, "Bob nhan token nhung chua delegate");

        // Voting power hiện tại (getVotes) bằng checkpoint mới nhất.
        assertEq(token.getVotes(alice), ALICE_AMOUNT - 100_000 ether);

        // Tổng cung lịch sử luôn là 1.000.000 GOV (kể cả phần chưa delegate).
        assertEq(token.getPastTotalSupply(1), token.TOTAL_SUPPLY());
        assertEq(token.getPastTotalSupply(11), token.TOTAL_SUPPLY());

        // Không được hỏi block hiện tại (12): block này chưa kết thúc nên giá trị chưa chốt.
        vm.expectRevert(abi.encodeWithSelector(Votes.ERC5805FutureLookup.selector, 12, uint48(12)));
        token.getPastVotes(alice, 12);
    }
}

