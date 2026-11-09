// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {GovToken} from "../src/GovToken.sol";
import {GovVote} from "../src/GovVote.sol";

/// @title Deploy
/// @notice Deploy GovToken rồi GovVote với cấu hình đọc từ biến môi trường (đặc tả mục 4.1 bước 4, 6.1).
///         Script chỉ TẠO contract; việc phân phối GOV là bước riêng (SeedDemo.s.sol).
///
/// Biến môi trường:
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

        // ---- 2. Preflight: in toàn bộ tham số TRƯỚC khi broadcast để người chạy đối chiếu ----
        console.log("=== GovVote Deploy: preflight ===");
        console.log("chainId               :", block.chainid);
        console.log("broadcaster (sender)  :", msg.sender);
        console.log("TOKEN_RECIPIENT       :", recipient);
        console.log("PROPOSAL_THRESHOLD GOV:", proposalThresholdGov);
        console.log("PROPOSAL_THRESHOLD wei:", proposalThreshold);
        console.log("QUORUM_BPS            :", quorumBps);
        console.log("VOTING_DELAY_BLOCKS   :", votingDelayBlocks);
        console.log("VOTING_PERIOD_BLOCKS  :", votingPeriodBlocks);
        if (recipient != msg.sender) {
            console.log("NOTE: recipient khac broadcaster; SeedDemo phai chay tu vi recipient.");
        }

        // ---- 3. Deploy (2 giao dịch) ----
        vm.startBroadcast();
        token = new GovToken(recipient);
        gov = new GovVote(IVotes(address(token)), proposalThreshold, quorumBps, votingDelayBlocks, votingPeriodBlocks);
        vm.stopBroadcast();

        // ---- 4. Hậu kiểm: đọc lại từ contract vừa tạo ----
        if (token.totalSupply() != token.TOTAL_SUPPLY()) revert PostDeployCheckFailed("totalSupply");
        if (token.balanceOf(recipient) != token.TOTAL_SUPPLY()) revert PostDeployCheckFailed("recipient balance");
        if (address(gov.token()) != address(token)) revert PostDeployCheckFailed("gov.token");
        if (gov.proposalThreshold() != proposalThreshold) revert PostDeployCheckFailed("proposalThreshold");
        if (gov.quorumBps() != quorumBps) revert PostDeployCheckFailed("quorumBps");
        if (gov.votingDelayBlocks() != votingDelayBlocks) revert PostDeployCheckFailed("votingDelayBlocks");
        if (gov.votingPeriodBlocks() != votingPeriodBlocks) revert PostDeployCheckFailed("votingPeriodBlocks");

        console.log("=== Deployed ===");
        console.log("GovToken :", address(token));
        console.log("GovVote  :", address(gov));
    }
}
