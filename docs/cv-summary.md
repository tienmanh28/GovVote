# GovVote — tóm tắt có bằng chứng cho CV

## Tiếng Việt

Dự án học tập dApp bỏ phiếu DAO on-chain theo đặc tả v1.1: GovToken ERC-20Votes cung cố định 1.000.000 GOV và GovVote dùng quyền lịch sử tại snapshot; quorum dựa tổng cung lịch sử, chỉ For/Against, không có execute. Contract Solidity 0.8.28/Foundry/OpenZeppelin; frontend React/TypeScript/Vite/wagmi/viem, chỉ injected MetaMask. Không tuyên bố production-ready, đã audit hoặc DAO phi tập trung.

### Số liệu từ CI mới nhất trên main tại lúc soạn

Nguồn: [run 43708528573](https://github.com/tienmanh28/GovVote/actions/runs/43708528573), ngày 15/11/2026 UTC, main **022a3aa7fc44b0c323993e4d961f375487ca665e**, bốn job SUCCESS. Đã đọc log từng bộ; không dùng số của PR chưa merge (#6/#7), không cộng lượt snapshot thành test mới.

| Job                                         | Thời gian job | Test thực tế                                                   |
| ------------------------------------------- | ------------- | -------------------------------------------------------------- |
| contracts (forge)                           | 49s           | 54 pass, 0 fail/skip; snapshot check riêng cũng 54 pass        |
| frontend (typecheck, format, Vitest, build) | 37s           | Vitest 177 pass / 13 files                                     |
| verify-cli (scripts/verify)                 | 28s           | 37 pass                                                        |
| e2e (Anvil + Playwright)                    | 3m54s         | 66 pass = validation 34 + reliability 12 + final UI 3 + E2E 17 |

- **Fuzz / invariant:** [foundry.toml](../foundry.toml) cấu hình 1.000 runs mỗi fuzz test, invariant 256 runs × depth 50; [báo cáo Phase 2A](phase2a-invariant-report.md) ghi 3 fuzz test và 6 invariant I1–I6. Độ sâu hữu hạn, không phải chứng minh hình thức.
- **Mutation thủ công:** [báo cáo Phase 2B](phase2b-verify-report.md), mục Mutation test: tạm bỏ dedupe `continue`, ca trùng log thất bại (tally lệch 800.000 GOV); khôi phục hash file và 9/9 test giai đoạn đó xanh. Đây là một ca mutation lịch sử của verifier, không phải mutation score toàn repo hoặc bước CI hiện hành.
- **Verify module dùng chung CLI/browser:** [shared/verification](../shared/verification) đối chiếu event/storage/state/quorum tại anchor H; EIP-1898 ghim blockHash, bounded HTTP body mặc định 5 MiB trước parse; thiếu bằng chứng không được VERIFIED. [Threat model](threat-model.md) nêu RPC có thể nói dối nhất quán và fork sau anchor chưa theo dõi.
- **Guard chain:** [Deploy.s.sol](../script/Deploy.s.sol) kiểm EXPECTED_CHAIN_ID/allowlist trước broadcast; [shared/chains.ts](../shared/chains.ts) chỉ 31337 và 11155111, mainnet bị chặn. Có guard không đồng nghĩa đã deploy Sepolia.
- **CSP:** [frontend/public/_headers](../frontend/public/_headers) và [test CSP](../frontend/tests/securityPolicy.test.ts) kiểm chính sách phục vụ hosting; không cho unsafe-eval/script unsafe-inline, không wildcard connect-src. Chuẩn bị hosting chưa đồng nghĩa Cloudflare thực tế đã áp header.

## English CV bullets

- Built a Solidity DAO voting dApp with fixed-supply ERC-20Votes, historical voting power, snapshot-based quorum, and a React/TypeScript frontend.
- Validated the main branch with four passing CI jobs: 54 Foundry, 177 Vitest, 37 CLI, and 66 Playwright tests on local Anvil.
- Added fuzz and stateful invariant coverage; documented a manual mutation experiment that detected duplicate-log tally inflation.
- Implemented shared CLI/browser verification of events against on-chain storage and state, with block-hash-pinned reads and bounded HTTP response parsing.
- Added deployment chain guards, explicit local/Sepolia chain profiles, and a tested CSP for hosting preparation; documented RPC trust limitations.

## Chờ D2/D3/F1 — chưa được ghi thành thành tích đã hoàn tất

- **D2:** chưa deploy GovToken/GovVote lên Sepolia; chưa có địa chỉ/tx Sepolia để dẫn.
- **D3:** chưa source-verify Etherscan; hosting prep không phải deployment Cloudflare.
- **F1:** chưa nghiệm thu MetaMask thật hoặc điện thoại thật. Browser CI dùng mock EIP-1193; [checklist Owner](acceptance-metamask.md) chưa điền kết quả.
- PR-D #6 (wagmi v3/audit) và PR-E #7 (gate block trước) đang OPEN tại lúc soạn; không đưa chúng vào thành tích main. Không tuyên bố npm audit main = 0.
