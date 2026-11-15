// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {GovToken} from "../src/GovToken.sol";
import {GovVote} from "../src/GovVote.sol";

/// @title Deploy
/// @notice Deploy GovToken rồi GovVote với cấu hình đọc từ biến môi trường (đặc tả mục 4.1 bước 4, 6.1).
///         Script chỉ TẠO contract; local dùng SeedDemo, Sepolia do Owner phân phối từng giao dịch.
///
/// Biến môi trường:
///   EXPECTED_CHAIN_ID     (BẮT BUỘC) Chain dự định: 31337 hoặc 11155111; không suy ra từ RPC.
///   TOKEN_RECIPIENT       (BẮT BUỘC) Địa chỉ nhận toàn bộ 1.000.000 GOV khi deploy. Phải ghi rõ, script
///                         không tự suy ra từ msg.sender. Thiếu biến này thì script dừng ngay.
///   PROPOSAL_THRESHOLD_GOV Ngưỡng tạo proposal tính bằng GOV NGUYÊN (ví dụ 1000 = 1.000 GOV).
///                         Script tự nhân với 10^18 (1 ether) để ra đơn vị nhỏ nhất lưu on-chain.
///                         Mặc định 1000. Log preflight in cả GOV lẫn wei để đối chiếu.
///                         Biến cũ PROPOSAL_THRESHOLD (đơn vị wei) đã bỏ: nếu còn đặt, script dừng ngay
///                         để không lặng lẽ dùng một giá trị khác với ý người chạy.
///   QUORUM_BPS            Quorum theo basis point, 1..10000. Mặc định 1000 (= 10%).
///   VOTING_DELAY_BLOCKS   Số block từ lúc tạo proposal tới snapshot. Mặc định 15.
///   VOTING_PERIOD_BLOCKS  Số block nhận phiếu sau snapshot. Mặc định 7200 (ước tính ~1 ngày nếu 12 giây/block).
///
/// GovVote tự kiểm tra QUORUM_BPS, VOTING_PERIOD_BLOCKS và giới hạn uint48 trong constructor
/// (revert InvalidConfiguration), nên script không lặp lại các kiểm tra đó.
contract Deploy is Script {
    // Đồng bộ allowlist với shared/chains.ts; Solidity không import được module TypeScript.
    uint256 internal constant ANVIL_CHAIN_ID = 31_337;
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    error ExpectedChainIdRequired();
    error UnsupportedExpectedChainId(uint256 expected);
    error DeploymentChainMismatch(uint256 expected, uint256 actual);
    error SepoliaRecipientMismatch(address recipient, address deployer);

    /// @dev Đơn vị GOV nguyên; nhân 1 ether (10^18) khi deploy.
    uint256 internal constant DEFAULT_PROPOSAL_THRESHOLD_GOV = 1_000;
    uint256 internal constant DEFAULT_QUORUM_BPS = 1_000;
    uint256 internal constant DEFAULT_VOTING_DELAY_BLOCKS = 15;
    uint256 internal constant DEFAULT_VOTING_PERIOD_BLOCKS = 7_200;

    /// @notice TOKEN_RECIPIENT = address(0): token sẽ không có chủ, dừng trước khi gửi giao dịch.
    error InvalidRecipient();
    /// @notice Kết quả sau deploy không khớp cấu hình (kiểm tra hậu kiểm).
    error PostDeployCheckFailed(string what);
    /// @notice Vẫn còn đặt biến cũ PROPOSAL_THRESHOLD (wei); phải đổi sang PROPOSAL_THRESHOLD_GOV.
    error DeprecatedEnvVar(string name);

    function run() external returns (GovToken token, GovVote gov) {
        // Chặn sai mạng trước broadcast; thiếu/không đọc được env phải lỗi, không có mặc định ngầm.
        uint256 expected;
        try vm.envUint("EXPECTED_CHAIN_ID") returns (uint256 value) {
            expected = value;
        } catch {
            revert ExpectedChainIdRequired();
        }
        if (expected != ANVIL_CHAIN_ID && expected != SEPOLIA_CHAIN_ID) {
            revert UnsupportedExpectedChainId(expected);
        }
        if (block.chainid != expected) revert DeploymentChainMismatch(expected, block.chainid);

        // ---- 1. Đọc cấu hình ----
        // vm.envAddress revert nếu biến không tồn tại => TOKEN_RECIPIENT là bắt buộc.
        address recipient = vm.envAddress("TOKEN_RECIPIENT");
        // Chặn biến cũ (đơn vị wei) để không ai tưởng nó còn tác dụng.
        if (vm.envExists("PROPOSAL_THRESHOLD")) revert DeprecatedEnvVar("PROPOSAL_THRESHOLD");

        // vm.envOr trả giá trị mặc định khi biến không được đặt.
        uint256 proposalThresholdGov = vm.envOr("PROPOSAL_THRESHOLD_GOV", DEFAULT_PROPOSAL_THRESHOLD_GOV);
        // Đổi GOV -> wei. Solidity 0.8 tự revert nếu phép nhân tràn (giá trị GOV vô lý).
        uint256 proposalThreshold = proposalThresholdGov * 1 ether;
        uint256 quorumBps = vm.envOr("QUORUM_BPS", DEFAULT_QUORUM_BPS);
        uint256 votingDelayBlocks = vm.envOr("VOTING_DELAY_BLOCKS", DEFAULT_VOTING_DELAY_BLOCKS);
        uint256 votingPeriodBlocks = vm.envOr("VOTING_PERIOD_BLOCKS", DEFAULT_VOTING_PERIOD_BLOCKS);

        if (recipient == address(0)) revert InvalidRecipient();

        // Broadcast context cho biết signer thật khi dùng --account/--sender; msg.sender có thể là script caller.
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        // Sepolia chỉ mint cho signer; Owner phân phối từng giao dịch sau khi kiểm địa chỉ nhận.
        if (expected == SEPOLIA_CHAIN_ID && recipient != deployer) {
            revert SepoliaRecipientMismatch(recipient, deployer);
        }

        // ---- 2. Preflight: in toàn bộ tham số TRƯỚC khi broadcast để người chạy đối chiếu ----
        console2.log("=== GovVote Deploy: preflight ===");
        console2.log("chainId               :", block.chainid);
        console2.log("broadcaster (sender)  :", deployer);
        console2.log("network              :", expected == ANVIL_CHAIN_ID ? "Anvil local" : "Sepolia");
        console2.log("TOKEN_RECIPIENT       :", recipient);
        console2.log("PROPOSAL_THRESHOLD GOV:", proposalThresholdGov);
        console2.log("PROPOSAL_THRESHOLD wei:", proposalThreshold);
        console2.log("QUORUM_BPS            :", quorumBps);
        console2.log("VOTING_DELAY_BLOCKS   :", votingDelayBlocks);
        console2.log("VOTING_PERIOD_BLOCKS  :", votingPeriodBlocks);
        if (recipient != deployer) {
            console2.log("NOTE: recipient khac broadcaster; SeedDemo phai chay tu vi recipient.");
        }

        // ---- 3. Deploy (2 giao dịch) ----
        token = new GovToken(recipient);
        gov = new GovVote(IVotes(address(token)), proposalThreshold, quorumBps, votingDelayBlocks, votingPeriodBlocks);
        vm.stopBroadcast();

        // ---- 4. Hậu kiểm: đọc lại từ contract vừa tạo ----
        // Kiểm lại toàn bộ cung ở signer Sepolia, không chỉ dựa vào log hoặc địa chỉ người gọi script.
        if (
            expected == SEPOLIA_CHAIN_ID
                && (token.totalSupply() != 1_000_000 ether || token.balanceOf(deployer) != token.totalSupply())
        ) {
            revert PostDeployCheckFailed("Sepolia deployer supply");
        }
        if (token.totalSupply() != token.TOTAL_SUPPLY()) revert PostDeployCheckFailed("totalSupply");
        if (token.balanceOf(recipient) != token.TOTAL_SUPPLY()) revert PostDeployCheckFailed("recipient balance");
        if (address(gov.token()) != address(token)) revert PostDeployCheckFailed("gov.token");
        if (gov.proposalThreshold() != proposalThreshold) revert PostDeployCheckFailed("proposalThreshold");
        if (gov.quorumBps() != quorumBps) revert PostDeployCheckFailed("quorumBps");
        if (gov.votingDelayBlocks() != votingDelayBlocks) revert PostDeployCheckFailed("votingDelayBlocks");
        if (gov.votingPeriodBlocks() != votingPeriodBlocks) revert PostDeployCheckFailed("votingPeriodBlocks");

        console2.log("=== Deployed ===");
        console2.log("GovToken :", address(token));
        console2.log("GovVote  :", address(gov));
    }
}
