// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GovToken} from "../src/GovToken.sol";

/// @title SeedDemo
/// @notice Phân phối GOV demo cho 4 ví theo bảng mục 2.1: Alice 40%, Bob 25%, Charlie 20%, David 15%.
///         Tách khỏi Deploy để dễ kiểm tra, dễ dừng, tránh phát token ngoài ý muốn (mục 4.1).
///
///         Script KHÔNG delegate: delegate phải do chính chủ ví ký (từ giao diện sau này). Sau seed,
///         mọi ví có balanceOf > 0 nhưng getVotes = 0 cho tới khi tự delegate.
///
/// Người gửi: ví đang giữ 1.000.000 GOV (TOKEN_RECIPIENT lúc deploy), truyền qua --sender khi chạy.
///
/// Biến môi trường (đều bắt buộc):
///   GOV_TOKEN     Địa chỉ GovToken đã deploy (lấy từ log Deploy.s.sol).
///   DEMO_ALICE    Ví nhận 400.000 GOV.
///   DEMO_BOB      Ví nhận 250.000 GOV.
///   DEMO_CHARLIE  Ví nhận 200.000 GOV.
///   DEMO_DAVID    Ví nhận 150.000 GOV.
contract SeedDemo is Script {
    uint256 internal constant ANVIL_CHAIN_ID = 31_337;

    uint256 internal constant ALICE_AMOUNT = 400_000 ether;
    uint256 internal constant BOB_AMOUNT = 250_000 ether;
    uint256 internal constant CHARLIE_AMOUNT = 200_000 ether;
    uint256 internal constant DAVID_AMOUNT = 150_000 ether;
    uint256 internal constant SEED_TOTAL = ALICE_AMOUNT + BOB_AMOUNT + CHARLIE_AMOUNT + DAVID_AMOUNT; // 1.000.000

    /// @notice SeedDemo chỉ dùng local; Sepolia phải chuyển từng giao dịch có Owner kiểm địa chỉ.
    error LocalDemoOnly(uint256 actual);
    /// @notice GOV_TOKEN không có bytecode trên chain này (sai địa chỉ hoặc sai mạng).
    error TokenNotDeployed(address token);
    /// @notice Ví demo không hợp lệ: address(0), trùng ví demo khác, hoặc trùng người gửi.
    error InvalidDemoWallet(string name, address wallet);
    /// @notice Người gửi không đủ GOV cho toàn bộ đợt seed.
    error NotEnoughBalance(address sender, uint256 balance, uint256 required);
    /// @notice transfer trả false (GovToken của OpenZeppelin không làm vậy, nhưng vẫn kiểm tra).
    error TransferFailed(address to, uint256 amount);
    /// @notice Số dư đọc lại sau chuyển không đúng kỳ vọng.
    error BalanceMismatch(address account, uint256 expected, uint256 actual);

    function run() external {
        // ---- 1. Không seed tự động trên public testnet; chặn trước env, đọc token và broadcast. ----
        if (block.chainid != ANVIL_CHAIN_ID) {
            revert LocalDemoOnly(block.chainid);
        }

        // ---- 2. Đọc cấu hình ----
        GovToken token = GovToken(vm.envAddress("GOV_TOKEN"));
        address alice = vm.envAddress("DEMO_ALICE");
        address bob = vm.envAddress("DEMO_BOB");
        address charlie = vm.envAddress("DEMO_CHARLIE");
        address david = vm.envAddress("DEMO_DAVID");
        address sender = msg.sender;

        // ---- 3. Preflight ----
        if (address(token).code.length == 0) revert TokenNotDeployed(address(token));
        _checkWallets(sender, alice, bob, charlie, david);

        uint256 senderBalance = token.balanceOf(sender);
        if (senderBalance < SEED_TOTAL) revert NotEnoughBalance(sender, senderBalance, SEED_TOTAL);

        console.log("=== SeedDemo: preflight ===");
        console.log("chainId      :", block.chainid);
        console.log("GOV_TOKEN    :", address(token));
        console.log("sender       :", sender);
        console.log("sender GOV   :", senderBalance / 1 ether);
        console.log("Alice   +GOV :", alice, ALICE_AMOUNT / 1 ether);
        console.log("Bob     +GOV :", bob, BOB_AMOUNT / 1 ether);
        console.log("Charlie +GOV :", charlie, CHARLIE_AMOUNT / 1 ether);
        console.log("David   +GOV :", david, DAVID_AMOUNT / 1 ether);

        // ---- 4. Chuyển và đọc lại số dư sau MỖI lần chuyển ----
        vm.startBroadcast(sender);
        _transferChecked(token, sender, alice, ALICE_AMOUNT);
        _transferChecked(token, sender, bob, BOB_AMOUNT);
        _transferChecked(token, sender, charlie, CHARLIE_AMOUNT);
        _transferChecked(token, sender, david, DAVID_AMOUNT);
        vm.stopBroadcast();

        // ---- 5. Hậu kiểm tổng thể ----
        if (token.totalSupply() != token.TOTAL_SUPPLY()) {
            revert BalanceMismatch(address(token), token.TOTAL_SUPPLY(), token.totalSupply());
        }
        console.log("=== Seeded. sender GOV con lai:", token.balanceOf(sender) / 1 ether);
    }

    /// @dev Chuyển `amount` từ sender sang `to`, rồi đọc lại số dư của CẢ HAI bên.
    function _transferChecked(GovToken token, address sender, address to, uint256 amount) internal {
        uint256 senderBefore = token.balanceOf(sender);
        uint256 toBefore = token.balanceOf(to);

        if (!token.transfer(to, amount)) revert TransferFailed(to, amount);

        uint256 senderAfter = token.balanceOf(sender);
        uint256 toAfter = token.balanceOf(to);
        if (toAfter != toBefore + amount) revert BalanceMismatch(to, toBefore + amount, toAfter);
        if (senderAfter != senderBefore - amount) revert BalanceMismatch(sender, senderBefore - amount, senderAfter);
    }

    /// @dev 4 ví demo phải khác 0, khác nhau, và khác người gửi; nếu trùng thì các phép đọc lại số dư
    ///      sẽ sai, và phân phối 40/25/20/15 không còn đúng.
    function _checkWallets(address sender, address alice, address bob, address charlie, address david) internal pure {
        address[4] memory wallets = [alice, bob, charlie, david];
        string[4] memory names = ["DEMO_ALICE", "DEMO_BOB", "DEMO_CHARLIE", "DEMO_DAVID"];
        for (uint256 i = 0; i < 4; i++) {
            if (wallets[i] == address(0) || wallets[i] == sender) revert InvalidDemoWallet(names[i], wallets[i]);
            for (uint256 j = 0; j < i; j++) {
                if (wallets[i] == wallets[j]) revert InvalidDemoWallet(names[i], wallets[i]);
            }
        }
    }
}
