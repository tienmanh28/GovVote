# GovVote: hướng dẫn cho Claude Code

## Dự án
- DAO voting on-chain bằng Solidity 0.8.28, Foundry, OpenZeppelin 5.6.1.
- Đặc tả chuẩn: `docs/GovVote_Thiet_ke_v1.1.pdf`. Khi có mâu thuẫn, đặc tả thắng.
- Người học: Lê Tiến Mạnh, đang học Solidity. Mục tiêu là hiểu bản chất, không copy code.

## Cách làm việc
- Trả lời bằng tiếng Việt. Giữ thuật ngữ tiếng Anh, và giải thích thuật ngữ mới trong ngoặc.
- Mỗi bước theo thứ tự: nêu mục đích và liên hệ thực tế, hiển thị cây thư mục hoặc sơ đồ ngắn, viết code đầy đủ có comment, chạy lệnh kiểm chứng, rồi DỪNG chờ xác nhận.
- Không sửa test để làm test pass. Nếu test fail, giải thích nguyên nhân trước rồi mới đề xuất sửa.

## Ràng buộc (bắt buộc)
- Không commit, push, hay broadcast lên testnet/mainnet khi chưa được yêu cầu rõ.
- Không ghi private key vào file hay lệnh. Chỉ dùng key công khai của Anvil, và chỉ ở local.
- Không đổi đặc tả: quorum 10% trên tổng cung tại snapshot, quorum đo For + Against, clock là block.number, không execute, không Abstain, không owner, không mint sau deploy.
- Không thêm tính năng ngoài v1.1 (treasury, timelock, execute, indexer, IPFS, Abstain...). Ý tưởng mới thì ghi vào danh sách "để sau".
- Frontend (Phase 3) thuộc v1.1 theo đặc tả, nhưng chỉ làm sau khi Phase 1–2 xong.

## Quyết định bổ sung (đã chốt với người học)
- `InvalidConfiguration` trong constructor GovVote kiểm tra: `token != address(0)`, `1 <= quorumBps <= 10000`, `votingPeriodBlocks > 0`. Cho phép `votingDelayBlocks = 0`.
- Repo dùng git để khóa thư viện bằng submodule, nhưng không commit khi chưa được yêu cầu.

## Lệnh kiểm chứng
- `forge build`, `forge test -vv`, `forge fmt --check`, `forge build --sizes`
