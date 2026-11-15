# AGENTS.md: luật chung cho mọi AI làm dự án GovVote (Claude Code, Codex)

## 1. Dự án
- GovVote: DAO voting dApp trên EVM. DAO voting on-chain bằng Solidity 0.8.28, Foundry, OpenZeppelin 5.6.1. Frontend (Phase 3) bằng React + wagmi v2 + viem.
- Đặc tả chuẩn: `docs/GovVote_Thiet_ke_v1.1.pdf`. Khi có mâu thuẫn, đặc tả thắng. Muốn đổi đặc tả phải hỏi Mạnh.
- Người học: Lê Tiến Mạnh, đang học Solidity. Mục tiêu là hiểu bản chất, không copy code.

## 2. Cấu trúc thư mục
- `src/`: `GovToken.sol`, `GovVote.sol` (contract nghiệp vụ).
- `test/`: `GovToken.t.sol`, `GovVote.t.sol`, `GovVoteFuzz.t.sol`, `GovVoteInvariant.t.sol`, `mocks/MockVotes.sol`.
- `script/`: `Deploy.s.sol`, `SeedDemo.s.sol` (forge script).
- `scripts/verify/`: script TypeScript đối chiếu event `VoteCast` với storage (Phase 2B).
- `frontend/`: Vite + React + TypeScript + Tailwind (Phase 3); unit test ở `tests/`, E2E ở `e2e/`.
- `docs/`: đặc tả PDF, báo cáo từng phase, `threat-model.md`, `adr.md`, `PROGRESS.md`, `phase3-screenshots/`.
- `lib/`: forge-std và openzeppelin-contracts (git submodule). `.gas-snapshot` ở gốc repo.

## 3. Lệnh build / test / chạy
Contract (ở gốc repo):
- `forge build`, `forge build --sizes`, `forge test -vv`, `forge fmt --check`
- `forge snapshot --check --fuzz-seed 0x1 --threads 1` (so với `.gas-snapshot`; phải cùng seed, số luồng, Foundry 1.7.1 và solc 0.8.28 như CI), `forge coverage --report summary`
- Fuzz chạy song song nên gas phụ thuộc cả seed lẫn số luồng. Chỉ ghim seed và luồng cho bước snapshot; `forge test` vẫn fuzz ngẫu nhiên. Tạo lại baseline bằng `forge snapshot --fuzz-seed 0x1 --threads 1`.

Chain local:
- Deploy bắt buộc `EXPECTED_CHAIN_ID` khớp chain thật; allowlist 31337/11155111 đồng bộ `shared/chains.ts`. Sepolia chỉ mint toàn bộ GOV cho broadcaster thực; SeedDemo chỉ local. Không tự chạy testnet.
- Lệnh local: `EXPECTED_CHAIN_ID=31337 TOKEN_RECIPIENT=<địa chỉ Anvil> forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast --unlocked --sender <địa chỉ Anvil>`; seed thêm `EXPECTED_CHAIN_ID=31337` với các biến demo như README.
- Runbook testnet CHƯA thực hiện: `docs/sepolia-runbook.md`; dry-run không broadcast, kiểm chain/deployer/số dư, chỉ Owner xác nhận mới ký bằng `--account govvote-deployer`.
- `anvil` (mặc định: 127.0.0.1:8545, chainId 31337). Chain mất khi tắt Anvil.
- Deploy, seed, lifecycle: theo đúng lệnh ở `docs/phase1-demo-report.md` mục 5 và 6b, ký bằng `--unlocked --sender/--from`. Bản chạy gần nhất: `docs/phase3-frontend-report.md`, mục "Chuẩn bị chain".

Script verify:
- `cd scripts/verify && npm ci --ignore-scripts`
- `npm test`, `npm run typecheck`
- `GOV_VOTE=<địa chỉ GovVote> npm run verify` (exit 0 = VERIFIED, 1 = MISMATCH, 2 = lỗi cấu hình hoặc RPC)

Frontend:
- `cd frontend && npm ci --ignore-scripts`
- Sau `forge build` thì chạy `npm run sync-abi` (sinh `src/abi/*.ts`).
- `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`, `npm test` (Vitest)
- E2E: `npm run test:e2e` (build rồi chạy Playwright), hoặc `npx vite build && npx playwright test --workers=1`. Cần Anvil đã dựng chain và `frontend/.env.local` đúng địa chỉ. Máy mới cần `npx playwright install chromium` và `sudo npx playwright install-deps chromium`.

## 4. Thứ tự đọc khi bắt đầu phiên
1. `docs/PROGRESS.md`
2. `git log --oneline -10` và `git status`
3. Đặc tả `docs/GovVote_Thiet_ke_v1.1.pdf` (mục liên quan)
4. Báo cáo của phase đang làm (`docs/phase*-*.md`)

## 5. Luật cứng
Chép nguyên văn từ CLAUDE.md cũ:
- Trả lời bằng tiếng Việt. Giữ thuật ngữ tiếng Anh, và giải thích thuật ngữ mới trong ngoặc.
- Mỗi bước theo thứ tự: nêu mục đích và liên hệ thực tế, hiển thị cây thư mục hoặc sơ đồ ngắn, viết code đầy đủ có comment, chạy lệnh kiểm chứng, rồi DỪNG chờ xác nhận.
- Không sửa test để làm test pass. Nếu test fail, giải thích nguyên nhân trước rồi mới đề xuất sửa.
- Không commit, push, hay broadcast lên testnet/mainnet khi chưa được yêu cầu rõ.
- Không ghi private key vào file hay lệnh. Chỉ dùng key công khai của Anvil, và chỉ ở local.
- Không đổi đặc tả: quorum 10% trên tổng cung tại snapshot, quorum đo For + Against, clock là block.number, không execute, không Abstain, không owner, không mint sau deploy.
- Không thêm tính năng ngoài v1.1 (treasury, timelock, execute, indexer, IPFS, Abstain...). Ý tưởng mới thì ghi vào danh sách "để sau".
- Frontend (Phase 3) thuộc v1.1 theo đặc tả, nhưng chỉ làm sau khi Phase 1–2 xong.
- Quyết định bổ sung (đã chốt với người học): `InvalidConfiguration` trong constructor GovVote kiểm tra: `token != address(0)`, `1 <= quorumBps <= 10000`, `votingPeriodBlocks > 0`. Cho phép `votingDelayBlocks = 0`.
- Quyết định bổ sung (đã chốt với người học): Repo dùng git để khóa thư viện bằng submodule, nhưng không commit khi chưa được yêu cầu.
- Lệnh kiểm chứng: `forge build`, `forge test -vv`, `forge fmt --check`, `forge build --sizes`.

Bổ sung (Mạnh đã yêu cầu trong các phase trước):
- Ký giao dịch local bằng `--unlocked --sender/--from`. Khi được yêu cầu deploy testnet: dùng keystore (`cast wallet import ... --interactive`), không dùng `--private-key`.
- Không đụng Sepolia (hay mạng thật nào) khi chưa được yêu cầu rõ.
- Không đổi đặc tả khi chưa được Mạnh xác nhận. Nếu thấy mâu thuẫn với đặc tả: DỪNG và báo.
- Không nới lỏng test, invariant, assertion hay ngưỡng đã đặt trước để làm cho đạt.
- Không dùng `^` hoặc `~` cho phiên bản npm: `npm install --save-exact`. Chọn bản stable phát hành ít nhất 14 ngày (`npm view <gói> time`). Cài với `--ignore-scripts`.
- Không nâng wagmi lên v3 khi Mạnh chưa quyết định (xem PROGRESS.md, mục npm audit).
- Constructor GovVote còn kiểm `votingDelayBlocks + votingPeriodBlocks <= uint48.max` (quyết định trong quá trình review Phase 1, xem `docs/adr.md` ADR 2).
- Không sửa file ngoài phạm vi Mạnh giao cho từng bước.
- Commit, chỉ khi Mạnh yêu cầu rõ: stage đúng từng file (không `git add -A`/`git add .`), ghi message vào file rồi `git commit -F`, không `--amend`, không `--no-verify`, không push. Message kết thúc bằng dòng attribution Mạnh yêu cầu lúc đó. Các commit hiện có dùng:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` và `Claude-Session: <link phiên>`. Codex: chưa có quy ước, hỏi Mạnh trước khi commit.
- Dừng và báo khi: lệnh lỗi hai lần liên tiếp mà không tự sửa được, cần thông tin chỉ Mạnh có, mâu thuẫn với đặc tả, hoặc cần đổi contract. Không tự đổi phạm vi.

## 6. Chuyển tay giữa hai AI
- Khi sắp hết token hoặc xong một bước: cập nhật `docs/PROGRESS.md` (đã làm / đang dở / kế tiếp / lỗi đang gặp), dán kèm output `git status` và `git diff --stat`.
- Khi vào phiên mới: đọc theo thứ tự ở mục 4, đối chiếu PROGRESS.md với `git log` và kết quả test chạy thật, báo lại hiểu biết của mình. CHƯA sửa gì cho tới khi Mạnh xác nhận.
- PROGRESS.md có thể đã cũ. Test và git là sự thật: nếu mâu thuẫn thì tin test/git và sửa PROGRESS.md.
- Scratchpad và output trong chat của một phiên sẽ mất. Bằng chứng cần giữ phải ghi vào `docs/`.

## 7. Định nghĩa "xong"
Một bước chỉ được gọi là xong khi có bằng chứng: số test pass, output lệnh, tx hash, ảnh. Không tự tuyên bố. Phần chưa kiểm được thì ghi "chưa xác minh" và lý do.

## 8. Làm việc với Mạnh
- Tiếng Việt. Giữ thuật ngữ tiếng Anh, giải thích nghĩa bằng tiếng Việt ở lần đầu xuất hiện.
- UI phải responsive: máy tính, máy tính bảng, điện thoại (kiểm 375×812, 768×1024, 1280×800).
