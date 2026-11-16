# PROJECT_STATE: trạng thái GovVote

> Quy tắc làm việc: `AGENTS.md`. Nhật ký chi tiết từng bước: `docs/PROGRESS.md` (dài, các mục số 1–6 ở cuối đã cũ từ 14/11).
> File này chỉ giữ Snapshot ngắn và Timeline. Test và git là sự thật; nếu lệch, tin git/CI rồi sửa file này.

## Snapshot (đo ngày 17/11/2026, tối đa 40 dòng)

- main = origin/main = `29f02ee` (merge PR #8). Kiểm bằng `git rev-parse main origin/main`.
- CI trên main: run [43745990411](https://github.com/tienmanh28/GovVote/actions/runs/43745990411) tại `29f02ee`, conclusion success (`gh run list --branch main`).
- Số test gần nhất có log CI (run 43744115832 tại `2cc3477`, ghi trong PROGRESS mục PR-F): Forge 54, Vitest 177, CLI 37, browser 67. Chưa chạy lại local trong phiên 17/11.
- Contract: Phase 1–2 Verified local; chưa deploy testnet nào (Not proven trên Sepolia).
- Frontend: Verified local + CI; chưa deploy Cloudflare (Not proven).
- PR mở: #6 `feat/p4-wagmi-v3` (nâng wagmi v3, npm audit) ở `2593b36`. Hai run CI (push 43746291319, pull_request 43746295944) đều success. Chờ Owner merge.
- Đang dở, chưa kết luận: SeedDemo treo trong bước dựng chain CI. Owner ghi việc điều tra ở nhánh `fix/p4-ci-setup-hang`; ngày 17/11 nhánh này chưa có trên local lẫn origin.
  - Bằng chứng (run 43740310900, pull_request tại `c0bd781`, artifact `anvil-diagnostics`): SeedDemo gửi 4 giao dịch, Anvil chỉ đào 2 (block 2 và 3). Có 1.426 lần gọi `eth_getTransactionReceipt` (17:20:00 tới 17:22:57 UTC) cho tới khi guard `timeout 180s` trong `ci.yml` dừng bước.
  - Run 43740268031 (push, cùng `c0bd781`) xanh, log ghi `END forge script SeedDemo elapsed=1s`. Nguyên nhân gốc chưa xác minh.
- Ruleset main 27262992 chỉ có `non_fast_forward` và `deletion`; chưa có required status checks (đọc API 17/11).

### Bước tiếp theo (theo thứ tự đề xuất, mỗi bước cần Owner duyệt)

1. Owner quyết PR #6 (wagmi v3): merge hay đóng. AGENTS.md cấm tự nâng.
2. Owner quyết đề xuất ruleset required status checks (lệnh mẫu trong PROGRESS mục PR-F); AI không tự PUT.
3. Chạy F1 local theo `docs/acceptance-metamask.md` trên Anvil cổng riêng (không 8545), lưu bằng chứng vào `docs/`.
4. D2/D3 Sepolia theo `docs/sepolia-runbook.md`: chỉ Owner ký bằng keystore `govvote-deployer`.
5. Deploy Cloudflare Pages theo `docs/hosting-cloudflare.md` sau D2/D3.
6. Dọn: worktree `/tmp/govvote-pr-f` (prunable), nhánh local `chore/p4-r-n-handoff`, `chore/p4-r-review-handoff` (mỗi nhánh 1 commit chưa vào main), nhánh remote của PR đã merge. Hỏi Owner trước khi xóa.

### Blocker

- D2/D3 và Cloudflare: cần keystore, ETH Sepolia, RPC, API key của Owner. AI không có và không được dùng.
- F1: cần MetaMask thật do Owner thao tác.

### Quyền cần hỏi lại mỗi phiên

- Ký/gửi giao dịch, deploy, push, merge, đổi ruleset: luôn cần Owner xác nhận lại.

## Timeline

> Dựng lại từ git log ngày 17/11/2026 (`git log --first-parent main`, `gh pr list --state all`).
> Ngày commit theo giờ máy; ngày merge PR theo UTC từ GitHub. Chỉ ghi điều có commit/PR/log làm bằng chứng.

| Ngày       | Sự kiện                                                                                                           | Bằng chứng                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2026-11-09 | Phase 1: GovToken, GovVote, deploy và lifecycle trên Anvil                                                        | `738636b`                       |
| 2026-11-09 | Phase 2A: fuzz và invariant I1–I6                                                                                 | `35c1265`                       |
| 2026-11-09 | Phase 2B: script đối chiếu VoteCast với storage                                                                   | `9fe23a7`                       |
| 2026-11-12 | Phase 2C: gas snapshot, threat model, ADR                                                                         | `c9240a5`                       |
| 2026-11-14 | Phase 3: frontend React và verification dùng chung                                                                | `1013cbf`, log rerun `080a279`  |
| 2026-11-14 | AGENTS.md, CLAUDE.md, PROGRESS.md cho luân phiên Claude/Codex                                                     | `fb57293`                       |
| 2026-11-14 | P4-A2 Prettier; P4-A3 README EN + VI                                                                              | `b85364e`, `f3650ad`            |
| 2026-11-14 | P4-C1/C2: GitHub Actions 4 job và LICENSE MIT                                                                     | `603c97f`                       |
| 2026-11-14 | Ghim `--fuzz-seed 0x1` rồi `--threads 1` cho snapshot check; CI xanh                                              | `492d268`, `fb0231e`, `97f5bf5` |
| 2026-11-15 | PR #1 merged: siết verifier, ổn định dựng chain CI                                                                | merge `aaf77fa`                 |
| 2026-11-15 | PR #2 merged: profile chain dùng chung CLI/frontend                                                               | merge `1e8b944`                 |
| 2026-11-15 | PR #3 merged: chặn deploy sai chain, runbook Sepolia (chưa chạy)                                                  | merge `ed403e2`                 |
| 2026-11-15 | PR #4 merged: rà backlog, README, spike wagmi v3                                                                  | merge `5f22761`                 |
| 2026-11-15 | PR #5 merged: chuẩn bị Cloudflare Pages và CSP, chưa deploy                                                       | merge `022a3aa`                 |
| 2026-11-15 | PR #6 mở: wagmi v3 + npm audit, chưa merge; run pull_request tại `c0bd781` fail ở bước dựng chain (SeedDemo treo) | head `2593b36`                  |
| 2026-11-15 | PR #7 merged: gate tạo proposal theo quyền tại block trước (B4)                                                   | merge `2cc3477`, CI 43744115832 |
| 2026-11-15 | PR #8 merged: checklist MetaMask, CV, đề xuất ruleset                                                             | merge `29f02ee`, CI 43745990411 |
| 2026-11-17 | Bộ file bàn giao AI: `.claude/settings.json`, file này, chỉnh AGENTS.md và CLAUDE.md                              | nhánh `docs/ai-handoff`, xem PR |
| 2026-11-17 | Ignore output solidity-auditor trong `.gitignore`                                                                 | nhánh `docs/ai-handoff`, xem PR |
