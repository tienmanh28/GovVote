# PROGRESS: tiến độ GovVote (bộ nhớ chung giữa các phiên AI)

## P4-A2 — format TypeScript bằng Prettier, 14/11/2026, Claude

- HEAD sau P4-A2: `b85364ed80a8fe6c615423d2e2ea2e95700d19f9` (`style: format TypeScript bằng Prettier (không đổi hành vi)`). Commit docs chứa checkpoint này có hash riêng.
- Đã xong: Prettier **3.9.10** ghim chính xác (devDependency `frontend/`). Không dùng 3.10.1 vì mới phát hành 12/11/2026, chưa đủ 14 ngày theo AGENTS.md. `.prettierrc` (printWidth 100, tabWidth 2, nháy kép, có chấm phẩy) và `.prettierignore` ở gốc repo; mẫu ignore neo gốc (`/lib`, `/out`, `/cache`, `/broadcast`, `/docs`) để không loại nhầm `frontend/src/lib`; bỏ qua `frontend/src/abi` (file sinh bởi `sync-abi`).
- Script `npm run format` / `format:check` (trong `frontend/`) nhắm `frontend/{src,e2e,tests,validation}`, `shared/`, `scripts/verify/{src,test}`. 61 file mã nguồn đổi; `format:check` xanh.
- Bằng chứng: typecheck xanh; Vitest 137/137; CLI verify 17/17 (trước và sau như nhau); browser 61/61 PASS sau format (validation 34, reliability 12, final UI 3, E2E gốc 12) trên bản sao + Anvil cô lập 8546, Anvil 8545 không bị đụng (block 7261).
- Bundle `dist/assets` **khác hash** so với trước format, Owner chấp nhận (hướng a): Prettier tách khoảng trắng JSX thành `{" "}` (cùng chữ hiển thị, khác số text node); Tailwind không còn sinh lớp thừa `.block!` (bắt nhầm từ `info.block!==` trong code dồn một dòng); `ccip-*.js` chỉ khác tên chunk import.
- Ghi chú: `docs/phase3-final-manifest.json` mô tả byte TRƯỚC format (commit `1013cbf`); KHÔNG sửa manifest. 31 file còn dòng >100 ký tự đều là chuỗi/template literal (Prettier không cắt chuỗi), chấp nhận.
- Kế tiếp: P4-A3 README, sau đó C1/C2 CI. Chỉ làm khi Owner giao.

## Owner xác nhận commit — checkpoint 14/11/2026

- HEAD tại thời điểm cập nhật: `080a279d97414a361d7ee7e43c689e66dcad4b94` (commit A2; commit B chứa checkpoint này sẽ có hash riêng).
- Trạng thái Phase 3: **ĐÃ COMMIT**. Commit A: `1013cbf7c3deeba47e6f23bb8926a4b691f99071`; commit A2 bằng chứng: `080a279d97414a361d7ee7e43c689e66dcad4b94`. Không push; không Sepolia; Phase 4 chưa bắt đầu.
- Untracked hiện tại trước stage B: **4** file (AGENTS.md, docs/PROGRESS.md, README.md, .github/workflows/test.yml). Sau commit B dự kiến còn2template C. CLAUDE.md đang modified, thuộc B.
- Bằng chứng đã PASS, không chạy lại trong bước commit: forge **53/53**, Vitest **137/137**, CLI **17/17**, browser **61/61** (34+12+3+12).
- Pre-commit A: index166file,170hash manifest khớp; sau A kiểm10mẫu SHA-256 trong HEAD khớp. A2 chỉ thêm2file bằng chứng, log61test từ scratchpad được quét bí mật. Không sửa file nhómA sau A. Manifest giữ nguyên như bằng chứng trước commit, không tự cập nhật hash workflow B sau khi Owner yêu cầu chỉnh PROGRESS.

### Quyết định của Owner

- Commit A rồi B theo manifest; thêm A2 bằng chứng nằm giữa A và B theo phê duyệt lần này. Không stage README.md hoặc .github/workflows/test.yml.
- Giữ nguyên **76 ảnh**. Dọn ảnh trùng p3-final-original/ và p3-final-original-current/ sau, kiểm bằng hash trước khi quyết định, không xóa ở phiên này.
- Format TypeScript bằng Prettier ghim phiên bản chính xác trong commit riêng **SAU A**; không format trong ba commit được phép hiện tại.
- npm audit: spike wagmi v3 trên nhánh riêng; CI chỉ cảnh báo cho tới khi Owner quyết định. Không tự nâng dependency ở phiên này.
- Hosting: Cloudflare Pages. RPC Sepolia chọn ở P4-E1; không chọn hoặc tương tác Sepolia trong phiên này.
- Attribution Codex bằng một dòng chữ trong thân commit, không tạo trailer Codex. Riêng chỉ thị cụ thể cho A2/B yêu cầu Co-Authored-By theo model; dùng GPT-6 trong trailer, dòng Codex nằm ở thân commit.

### Backlog đã ghi nhận, chưa triển khai

- `frontend/e2e/01-wallet-states.spec.ts:57`: hardcode cổng8545; nên đọc từ biến môi trường. Regression trên bản sao xử lý cổng8546, repository chính giữ nguyên.
- **F1:** TS nén ở core.ts, runner.ts và validation spec; có dòng dài400–886ký tự; format riêng bằng Prettier ghim chính xác.
- **F2:** chain ID31337 hardcode; thiết kế chain profile.
- **F3:** eth_call chưa ghim bằng `{blockHash}`.
- **F4:** response.json() chưa giới hạn kích thước body trước parse.
- CI template: actions chưa ghim SHA và chạy mọi push.
- README template còn ví dụ --private-key.

### Thứ tự Phase 4 đề xuất — chưa được phép thực hiện

A2-format → A3 README → C1/C2 CI → B2 verifier → D0 chain profile → D1 guard deploy. Các bước ký **D2, D3, E2, F1** chờ Owner duyệt từng bước. Nhãn A2-format của kế hoạch Phase4 khác commit A2 bằng chứng Phase3 ở trên. F1 bước ký của kế hoạch khác F1 backlog format; cần dùng đầy đủ ngữ cảnh khi giao nhiệm vụ.

DỪNG sau commit B và báo cáo. Không bắt đầu Phase4.


## P3-FINAL-01 — checkpoint hiện hành 14/11/2026, Codex

**READY_FOR_COMMIT_REVIEW (local Phase3), chờ Owner/ChatGPT quyết định.** Theo chỉ thị nhiệm vụ: FIX01 ACCEPTED; FIX02/03B/04 ACCEPTED WITH LIMITATIONS. Phase3 chưa commit; Phase4 chưa bắt đầu. Các checkpoint dưới đây là lịch sử, không phải trạng thái mới nhất.

- Preflight main, HEAD `c9240a57bf6ba8bcb8152b41a0909d7a99dab188`;108 untracked+3 tracked modified, index rỗng, đúng checkpoint. Không sửa Solidity, dependency/lockfile, .env.local, templates hoặc chain8545.
- Regression cuối: Foundry53/53; Vitest137/137 (9file); CLI17/17 (9legacy+8strict); browser validation34/34, reliability12/12, final UI3/3, Original E2E12/12. Tổng61 browser tests; typecheck frontend/CLI, production build, forge build/sizes/fmt/snapshot PASS. Không nới assertion/bỏ test. Cảnh báo chunk>500kB còn tồn tại.
- Phát hiện và sửa2lỗi: normal fallback thiếu continuity history (Medium) → pin/check block hash anchor; decoded read revert bị lặp/bọc generic retry (Low) → dedupe, hiện một lần đúng lỗi contract. Original lần đầu11/12 fail lỗi thứ2; sau sửa12/12. Setup đầu timeout mine đã sửa riêng fixture, không đổi HTTP timeout app.
- Thêm4browser tests:1khác lịch sử cùng chain/contract,3RPCerror/wrongchain responsive375/768/1280. Không thêm Vitest. Xem tên chính xác và requirement matrix tại mục P3-FINAL-01 trong phase3-frontend-report.
- Original transaction E2E chỉ dùng Anvil mới loopback8546/chain31337, unlocked public test accounts, project copy ở/tmp, preview4175; instance mới được terminate. 8545 chỉ đọc block trước/sau, giữ7261. Không seed/reset/write8545, không Sepolia. EIP-1193 mock, chưa MetaMask thật.
- Strict read-only CLI trên8545 proposal1: VERIFIED/H7249/C12/18requests; For600.000/Against250.000GOV, quorum100.000, stateSucceeded. Bằng chứng mới: docs/phase3-final-evidence/strict-anvil.json; evidence03B cũ giữ nguyên.
- Frontend audit27 (16high/11moderate/0critical), gồm direct wagmi bị lan truyền; vulnerable nested viem2.23.2 trong WalletConnect, không phải direct2.57.13. CLI audit0. Emitted-module review hiện chỉ injected: các node advisory gốc không có trong bundle; đây là reachability evidence, không chứng nhận an toàn/đã sửa. High dependency findings vẫn cần Owner quyết định trước public release, không tự nângv3.
- Rủi ro giữ nguyên: wallet popup/provider event timing; trust RPC và fork sau anchor; log/storage cùng sai; không weight proof/getPastVotes từng voter; JSON payload memory trước budget; multiendpoint thật chưa xác minh; filter trong trang; local không explorer/Etherscan; exit137 cũ chưa biết nguyên nhân. HTTP8s có retry/multiple reads nên tổng có thể dài hơn8s đáng kể.
- Scope và SHA256 từng file ở docs/phase3-final-manifest.json: GroupA Phase3 (frontend/shared/CLI migration+evidence), B AGENTS/CLAUDE/PROGRESS, C README/.github template để ngoài commitPhase3, D ignored runtime/env/temp/secrets. ABI khớp Foundry artifact; đã rà cả untracked UTF8/whitespace/secrets, không chỉ gitdiff. Chưa phát hiện secret thật trong commit scope.
- Tài liệu đầy đủ A–M, matrix PASS/PARTIAL/NOT VERIFIED và evidence paths ở docs/phase3-frontend-report.md, mục P3-FINAL-01. Các ảnh mới dùng thư mục p3-final-* riêng, không ghi đè bằng chứng cũ.
- Kế tiếp: Owner/ChatGPT review kết quả và manifest; quyết định commit scope/attribution Codex và rủi ro dependency. Chỉ stage từng file/commit khi Owner yêu cầu riêng. Trước Phase4 cần duyệt config/provenance/explorer, real-wallet/multiendpoint test và quyền deploy riêng. Không tự triển khai Phase4.


## P3-FIX-04 — checkpoint 14/11/2026, Codex

**PASS_CANDIDATE, chờ Mạnh/ChatGPT nghiệm thu.** P3-FIX-03B đã được Owner ACCEPTED local với giới hạn. Phase3 chưa commit, Phase4 chưa bắt đầu.

- Đã có RPC fallback opt-in qua VITE_RPC_FALLBACK_URLS (tối đa2, mặc định trống). Primary ưu tiên, probe chain/code/token trước khi dùng; failover hữu hạn, đổi provider/cache/session theo endpoint/epoch, manual retry primary. Không điền endpoint thật thay Owner.
- Browser verification failover chỉ ở adapter frontend; mỗi source chạy lại toàn bộ pipeline03B, ngân sách dùng chung qua attempts, không trộn evidence. MISMATCH không bị che bằng fallback. Shared core/CLI giữ nguyên.
- Thêm freshness từ query dataUpdatedAt thực sự thành công, block và nhãn loading/refreshing/stale-error/ready; không tiến timestamp khi lỗi hoặc đồng hồ chạy; reset theo context. Guard chặn trang thì timestamp bị ẩn, không giả mới.
- Pending hiển thị getVotes tại block đọc, nhãn dự kiến/chưa chốt; qua snapshot dùng historical như trước. Không dùng balance hoặc expected power để bypass vote guard.
- Spec5.1 không bắt buộc filter toàn lịch sử: giữ filter trong trang10ID, nhãn giới hạn như02.
- Bằng chứng: typecheck/build PASS; Vitest137/137 (127cũ+10mới); CLI17/17; Playwright34/34cũ và11/11mới, responsive cuối3/3; Foundry53/53, fmt/sizes PASS. Không lỗi test còn fail hoặc assertion bị nới.
- 3ảnh mock Pending/fallback/freshness ở docs/phase3-screenshots/p3-fix-04-pending-{375,768,1280}.png; đã mở xem. Chi tiết source/policy/test commands/limitations ở cuối docs/phase3-frontend-report.md.
- Chưa xác minh fallback RPC thật vì Owner chưa cung cấp; .env.local giữ nguyên, .env.example có biến trống. Build653,19kB vẫn warning>500kB; audit cũ và giới hạn verifier03B còn nguyên. Không test Anvil/live trong04; chỉ mocked RPC và EVM Foundry cô lập.
- Không sửa Solidity/dependency/shared/CLI/tests cũ; không commit/push/deploy/broadcast/Sepolia. Kế tiếp: Owner/ChatGPT review, không tự đóng Phase3/chuyển Phase4.


### Git cuối P3-FIX-04

Branch main; HEAD c9240a57bf6ba8bcb8152b41a0909d7a99dab188. 108untracked (97→108:8source/test frontend+3PNG mới),3tracked modified có từ checkpoint03B. Diffstat không phản ánh source frontend/tài liệu untracked.

```text
 M CLAUDE.md
 M docs/phase2b-verify-report.md
 M scripts/verify/src/main.ts
?? .github/
?? AGENTS.md
?? README.md
?? docs/PROGRESS.md
?? docs/phase3-frontend-report.md
?? docs/phase3-screenshots/
?? docs/phase3-verification-evidence.json
?? frontend/
?? scripts/verify/src/adapter.ts
?? scripts/verify/src/legacy-main.ts
?? scripts/verify/test/rpcFixture.ts
?? scripts/verify/test/strict.test.ts
?? shared/
```

```text
 CLAUDE.md                     |  26 +-------
 docs/phase2b-verify-report.md |  66 +++++++++++++++++++
 scripts/verify/src/main.ts    | 148 ++++++++----------------------------------
 3 files changed, 95 insertions(+), 145 deletions(-)
```

---


## P3-FIX-03B — checkpoint 14/11/2026, Codex

**PASS_CANDIDATE, chờ Mạnh/ChatGPT nghiệm thu.** Owner đã duyệt scope verification đầy đủ mục4.5 trong Phase3, local provenance, C mặc định12. P3-FIX-01 ACCEPTED; P3-FIX-02 ACCEPTED WITH DOCUMENTED LIMITATIONS. Phase3 chưa commit; Phase4 chưa bắt đầu.

- Đã hoàn thành core TypeScript thuần, shared bounded runner/HTTP read-only, CLI/browser codecs dùng ABI generated, strict CLI một proposal, legacy banner, UI #/verify/:id và tests.
- Core kiểm ProposalCreated, metadata, vote scope/order/dedupe/voter uniqueness, event/storage tally, historical supply/quorum/state cùng H và hash anchor. Không default missing bằng0. Status VERIFIED/MISMATCH/INCOMPLETE/RPC_ERROR/INVALID_INPUT, UI IDLE/RUNNING.
- UI không cần ví; có progress/retry/H/hash/time/C/evidence/state và hướng dẫn CLI. Kết quả gắn context, hủy request cũ. Không Etherscan link giả/source-verified claim.
- Kiểm chứng: frontend Vitest127/127 (60mới +67cũ), CLI17/17 (8strict +9legacy), typecheck cả hai PASS, build PASS, Foundry53/53 PASS, fmt/sizes PASS. Full Playwright34/34, Verification UI chạy lại16/16 sau hardening. Responsive3kích thước PASS, đã xem ảnh.
- Anvil CLI read-only#1: VERIFIED tại H7249/hash0x5d47b51cfd5f8dc19b9d41a1d2555016ee3f01ff61c2236321131ffd12dce90d, For600.000/Against250.000 GOV, quorum100.000 GOV, stateSucceeded; latest trước/sau7261. UI Chromium thật trên Anvil cũng VERIFIED; network whitelist read-only, không giao dịch. Full evidence docs/phase3-verification-evidence.json;4ảnh mới p3-fix-03-* ở docs/phase3-screenshots (3mock+1live).
- CLI: từ scripts/verify, GOV_VOTE=<GovVote> GOV_TOKEN=<expectedToken> GOV_PROPOSAL_ID=1 GOV_CONFIRMATIONS=12 npm run verify. Không có GOV_PROPOSAL_ID thì legacy tally-only, không strict. Exit strict0=VERIFIED,1=MISMATCH,3=INCOMPLETE,2=RPC_ERROR/INVALID_INPUT. Hướng dẫn/budget chi tiết ở đầu docs/phase2b-verify-report.md.
- Budget default200requests/50000logs/60s/range10000/retry1/timeout8s. Quá giới hạn=>INCOMPLETE. Không liên tục reverify mỗi block.
- Giới hạn: cùng RPC có thể sai nhất quán; không đối chiếu từng weight/getPastVotes; không source-verified/audit; chưa giám sát reorg sau verdict; JSONpayload chưa streaming-capped; RPC config runtime reset chỉ review code (route/reference reset có browser test). Build646,54kB cảnh báochunk>500kB và npm audit cũ còn tồn đọng.
- Không lỗi test còn fail. Lượt CLI fixture fail do echo sai response ID đã sửa fixture đúng giao thức, không nới assertion. tsx CLI bị sandbox chặnIPC: dùng Node loader/test-isolation=none; fixture/browser localhost chạy bằng quyền ngoài sandbox đã được duyệt. Foundry cảnh báo signature cache ngoài workspace read-only, không ảnh hưởng53tests exit0.
- Không sửa contract/test Solidity/invariant/ABI/deploy/dependency; không stage/commit/push/deploy/reset/seed/broadcast/Sepolia. Kế tiếp: Owner/ChatGPT review; không tự chuyển P3-FIX-04 hoặc tuyên bố hoàn tất Phase3.


### Git cuối bước P3-FIX-03B

Branch main; HEAD c9240a57bf6ba8bcb8152b41a0909d7a99dab188; 97untracked,3tracked modified (CLAUDE.md đã có từ bàn giao,2file tracked thuộc nhiệm vụ). 77→97 do20file mới:4shared+7frontend+4CLI+4PNG+1JSON. Diffstat không gồm frontend/shared/docs untracked.

```text
 M CLAUDE.md
 M docs/phase2b-verify-report.md
 M scripts/verify/src/main.ts
?? .github/
?? AGENTS.md
?? README.md
?? docs/PROGRESS.md
?? docs/phase3-frontend-report.md
?? docs/phase3-screenshots/
?? docs/phase3-verification-evidence.json
?? frontend/
?? scripts/verify/src/adapter.ts
?? scripts/verify/src/legacy-main.ts
?? scripts/verify/test/rpcFixture.ts
?? scripts/verify/test/strict.test.ts
?? shared/
```

```text
 CLAUDE.md                     |  26 +-------
 docs/phase2b-verify-report.md |  66 +++++++++++++++++++
 scripts/verify/src/main.ts    | 148 ++++++++----------------------------------
 3 files changed, 95 insertions(+), 145 deletions(-)
```

---


## P3-FIX-02 — 14/11/2026, Codex

**PASS_CANDIDATE, chờ Mạnh/ChatGPT review.** Theo giao việc của Owner, P3-FIX-01 đã ACCEPTED WITH DOCUMENTED LIMITATIONS. Không tuyên bố Phase 3 hoàn tất; chưa làm Verification UI hoặc RPC fallback.

### Specification gap analysis

| Requirement | Spec reference | Trước sửa | Gap | Thay đổi |
|---|---|---|---|---|
| List title/state/tally/deadline | 5.1 | Đã có | Tải tất cả ID | Giữ thẻ/bảng và link chi tiết; giới hạn ID trước RPC |
| Pending/Active/Closed filter | 5.1 | Không có | Thiếu filter | Lọc state(id) canonical trong trang; Closed = Succeeded(2) hoặc Defeated(3), Pending=0, Active=1 |
| Quorum progress | 5.1, 2.5 | Chỉ có ở detail | Thiếu ở list | Participation=For+Against, quorumVotes(id) sau snapshot, text và progressbar |
| Snapshot chưa hoàn tất | 2.3, 3.6, 5.1 | List chưa đọc quorum | quorumVotes revert nếu block<=snapshot | Không gọi trước snapshot; hiển thị chưa chốt, không ước lượng giả |
| Loading/error/retry | 5.2–5.4 | P3-FIX-01 có error handling | Phải giữ khi thêm data | Chờ đủ các query cùng block; lỗi có ReadError/retry, không placeholder |
| Pagination/bounded loading | 5.3 | Array.from 1..N | RAM/RPC tăng tuyến tính tổng lịch sử | Cửa sổ tối đa 10 ID, bigint, cũ/mới; không cắt sau khi fetch |

Filter, quorum progress, error handling và giới hạn tải là yêu cầu v1.1. Page size 10, lọc trong cửa sổ ID hiện tại, phần trăm 2 chữ số và progressbar là lựa chọn triển khai nhỏ nhất, không phải giá trị do đặc tả ấn định. UI ghi rõ filter trong trang, không tuyên bố lọc toàn lịch sử hoặc đếm tổng toàn bộ trạng thái. Mỗi trang vẫn truy cập được proposal cũ; có thể mở trực tiếp route chi tiết ID.

### Implementation và quorum

- Sửa frontend/src/pages/ProposalList.tsx; thêm lib/proposalList.ts và components/QuorumProgress.tsx.
- state(id) là nguồn duy nhất quyết định trạng thái/filter, không tự tính thắng/thua từ UI. Query count, getProposal, state, quorum đều pin block và chain cấu hình; key query thay theo block/ID, không giữ placeholder.
- Quorum chuẩn do contract trả: ceil(getPastTotalSupply(snapshot)*1000/10000). Frontend không dùng balance hiện tại hoặc Abstain, không hardcode 100.000 GOV làm số đọc thực tế.
- participation=forVotes+againstVotes; đạt khi participation>=quorum. Phần trăm tính bigint, làm tròn xuống 2 chữ số; thanh capped 100% nhưng text cho biết vượt ngưỡng. Đạt quorum không đồng nghĩa Succeeded.
- Pending không gọi quorumVotes; hiển thị “Quorum: chưa chốt snapshot.” Không hiển thị tổng cung hiện tại như dữ liệu snapshot.
- Cửa sổ ID tạo trước RPC, mới nhất trước. Clamp trang nếu count giảm; không đổi count bigint sang Number, chỉ độ dài <=10. Lọc local không thêm RPC. Trang rỗng theo filter khác với chain chưa có proposal.

### Performance

Một trang/block: 1 count + N getProposal + N state + K quorum, N<=10, K<=N, tối đa 31 logical contract reads khi thành công. Trên chain Anvil tùy chỉnh hiện tại không có multicall3 cấu hình, wagmi fallback sang từng read; fixture xác minh 27 reads cho trang 10 ID có 6 snapshot hoàn tất. Test count=10^30 vẫn chỉ getProposal 10 lần và <=31 reads.

Giới hạn này không gồm ConfigGuard/block polling, retry, các trang/block người dùng đã yêu cầu trước đó; mỗi query có tối đa một retry theo P3-FIX-01. RPC lỗi chậm có thể còn request cũ đang chạy dù kết quả không hiển thị. Tốc độ tải tiếp tục phụ thuộc block và RPC; chưa benchmark RPC thật hoặc mạng latency cao. Không indexer/backend, không quét toàn lịch sử để lọc global.

### Tests và bằng chứng

- Typecheck: PASS exit 0.
- Vitest: **67/67 PASS, 6 file** (52 test trước giữ nguyên + 15 mới proposalList.test.ts).
- Build: PASS exit 0, JS chính 622,88 kB/gzip 186,13 kB; cảnh báo >500 kB giữ nguyên.
- Playwright validation: **18/18 PASS (36,2s)**; gồm 10 ca P3-FIX-01 giữ nguyên và 8 ca mới P3-FIX-02:
  1. rỗng và một proposal;
  2. phân trang trước RPC; filter canonical; quorum ngưỡng, Pending→Active sau block mới;
  3. RPC list failure và retry;
  4. dữ liệu block cũ hoàn tất muộn không ghi đè block mới;
  5–7. responsive 375×812, 768×1024, 1280×800;
  8. N rất lớn vẫn chỉ tải 10 proposal.
- Không chạy E2E giao dịch cũ, không gọi RPC tới Anvil, không seed/reset/broadcast. Mọi dữ liệu browser là fixture trả qua route mock; ảnh không phải bằng chứng on-chain.
- Responsive: không cuộn ngang, button/select >=44px; đã mở ảnh kiểm bố cục. Ảnh mới riêng docs/phase3-screenshots/p3-fix-02-list-375.png, -768.png, -1280.png (fullPage nên chiều cao ảnh có thể vượt viewport). Không ghi đè 18 ảnh cũ.
- Lệnh: npm --prefix frontend run typecheck; npm --prefix frontend test; npm --prefix frontend run build. Browser từ frontend: node node_modules/@playwright/test/cli.js test --config playwright.validation.config.ts (Node Linux trên PATH, chạy ngoài sandbox vì sandbox chặn localhost).

### Git và giới hạn bàn giao

HEAD main c9240a57bf6ba8bcb8152b41a0909d7a99dab188. Không stage/commit/push/deploy. 62→70 untracked ở P3-FIX-01 do 8 file mới: BlockGuard, ReadError, session.ts, tests/rpc.test.ts, tests/session.test.ts, tests/transport.test.ts, playwright.validation.config.ts, validation/p3-fix-01.spec.ts. P3-FIX-02 thêm 4 file frontend và 3 PNG nên hiện **77 untracked**, cùng 1 modified CLAUDE.md đã có từ bàn giao.

```text
 M CLAUDE.md
?? .github/
?? AGENTS.md
?? README.md
?? docs/PROGRESS.md
?? docs/phase3-frontend-report.md
?? docs/phase3-screenshots/
?? frontend/
```

```text
 CLAUDE.md | 26 +++-----------------------
 1 file changed, 3 insertions(+), 23 deletions(-)
```

Diff stat chỉ gồm tracked, không mô tả thay đổi frontend chưa tracked. Đã rà riêng văn bản untracked, generated/ignore và mẫu secret; không in giá trị secret. Không sửa contract/test Solidity/ABI/deploy/dependency. Các file bàn giao ngoài phạm vi giữ nguyên.

Giới hạn còn lại: filter trong trang, không global; dữ liệu browser giả; chưa benchmark/kiểm on-chain; polling có thể làm loading lại lúc sang block. Các giới hạn wallet P3-FIX-01, dependency audit cũ, verify UI/script completeness và RPC fallback chưa giải quyết ở đây. Dừng chờ Owner/ChatGPT review trước nhiệm vụ tiếp theo.

---


## P3-FIX-01 Final Validation — 14/11/2026, Codex

**PASS_CANDIDATE — chờ Owner/ChatGPT nghiệm thu.** Bản ghi này cập nhật phần CHƯA XÁC MINH browser của lần triển khai trước; không đóng toàn bộ Phase 3 và không triển khai P3-FIX-02.

### Session guard review

- A→B, disconnect, đổi chain khi simulate còn chờ: browser chứng minh khi resolve simulate cũ, số lần gọi eth_sendTransaction = 0, không hiện tx-status cũ.
- A→B→A: browser xác minh số dư/votes đúng account; unit test thế hệ phiên chứng minh guard cũ vẫn bị hủy dù identity quay lại A.
- Query A hoàn tất sau B: browser chứng minh kết quả A không ghi đè balance B.
- Trước writeContract có assertCurrent; sau send/receipt có active check. watchAccount và unmount vô hiệu hóa phiên cũ. Đây không phải atomic lock với wallet provider: account/chain vẫn có thể đổi trong các await bên trong writeContract hoặc popup ký.
- Popup ký đã mở không thể bị UI đóng/thu hồi; giao dịch đã broadcast không thể hủy bằng session guard. Xử lý popup đổi account và receipt cũ trả sau đổi account: đã review code path, **CHƯA XÁC MINH bằng browser/provider thật**; không tuyên bố chống race tuyệt đối. Chưa bổ sung fixture receipt/popup trong browser.

### Browser verification — 10/10 PASS (29,0 giây)

Lệnh từ frontend (PATH dùng Node Linux có sẵn):
`node node_modules/@playwright/test/cli.js test --config playwright.validation.config.ts`

Tên test và kết quả:
1. RPC error → tiếng Việt; retry sau phục hồi — PASS.
2. RPC liên tục lỗi: retry hữu hạn, không spinner — PASS.
3. RPC timeout: thoát loading, báo lỗi sau timeout và retry — PASS (17,1 giây).
4. Bytecode rỗng: đúng nguyên nhân — PASS.
5. A → B → A: dữ liệu đúng account; disconnect xóa phiên — PASS.
6. Đổi chain: khóa delegate — PASS.
7. Query A hoàn tất sau B: không ghi đè dữ liệu B — PASS.
8. Account khi simulate đang chờ: không gọi eth_sendTransaction — PASS.
9. Chain khi simulate đang chờ: không gọi eth_sendTransaction — PASS.
10. Disconnect khi simulate đang chờ: không gọi eth_sendTransaction — PASS.

Bộ test riêng ở frontend/validation, không import helper chuyển tiếp RPC tới Anvil; mọi request ngoài static server localhost đều được route mock, wallet giả không chuyển tiếp request. Không chạy E2E cũ, không gửi giao dịch, seed/reset/deploy. Sandbox chặn loopback EPERM nên lượt browser chạy bằng quyền ngoài sandbox đã được công cụ chấp nhận. Kết quả tạm nằm trong /tmp/govvote-p3fix01-*; không ghi đè test-results hoặc screenshots nghiệm thu cũ.

### Phát hiện và sửa trong validation

Browser phát hiện toUserMessage chỉ lấy shortMessage của viem, làm mất details từ RPC. Đã sửa errors.ts giữ details; thêm test 'thông báo giữ chi tiết lỗi RPC, không chỉ shortMessage'. Không sửa test cũ.

Assertion đếm request ban đầu gộp cả eth_blockNumber polling. Đã tách eth_chainId: một lượt lỗi = 2 calls, không tiếp tục tự retry query này; retry thủ công thêm đúng 2 calls nếu vẫn lỗi. Không nới số lần retry. Polling block vẫn chạy theo cấu hình watch, không phải vòng retry vô hạn của query chain ID. Vì có hai query ban đầu (chain ID và block), tổng HTTP khi timeout toàn RPC quan sát được là 4, không phải 2. Tổng thời gian lỗi có thể hơn 8 giây (timeout + retry + delay). Browser vẫn hiển thị lỗi và nút Thử lại.

### Verification cuối

- Vitest: **52/52 PASS**, 5 file (51 cũ + 1 mới trong phiên validation).
- Typecheck: exit 0, bao gồm validation/ và playwright.validation.config.ts trong tsconfig.
- Build: exit 0, JS chính 619,55 kB, gzip 185,06 kB; vẫn cảnh báo chunk >500 kB.
- git diff --check: exit 0; đọc riêng toàn bộ 70 file untracked (bỏ binary khi kiểm văn bản): không trailing whitespace hoặc mẫu secret đã kiểm; không node_modules/dist/test-results/out/cache lọt vào danh sách commit. Scan theo mẫu không bảo đảm tuyệt đối không có secret. Manifest/lock root dependencies vẫn khớp.
- .env.local, node_modules, dist, test-results được git check-ignore xác nhận. Hai ABI generated cần giữ; artifacts/cache/broadcast không commit.
- HEAD main vẫn c9240a57bf6ba8bcb8152b41a0909d7a99dab188; index trống, không commit/push. git status và diff --stat vẫn như snapshot ngay dưới ở bản ghi triển khai (1 modified CLAUDE.md có sẵn; các nhóm untracked); diff --stat chỉ ghi CLAUDE.md 26 dòng, 3 insertions/23 deletions, không bao gồm untracked.
- Thay đổi riêng phiên validation: errors.ts, tests/transport.test.ts, tsconfig.json; thêm playwright.validation.config.ts và validation/p3-fix-01.spec.ts; cập nhật PROGRESS và report. Không sửa Solidity/dependency/ABI/deploy hoặc chức năng khác.

Kế tiếp: dừng chờ Mạnh/ChatGPT review. Chưa nghiệm thu thay Owner.

---


## P3-FIX-01 — cập nhật 14/11/2026 bởi Codex

**Trạng thái: PASS_CANDIDATE, chờ Mạnh và ChatGPT nghiệm thu.** Phần dưới là checkpoint lịch sử của Claude; nhận định Phase 3 “kỹ thuật xong” không thay thế các thiếu sót v1.1 đã được audit. Chưa bắt đầu P3-FIX-02 hoặc Phase 4.

- HEAD vẫn `c9240a57bf6ba8bcb8152b41a0909d7a99dab188`, branch `main`; chưa commit/push.
- Root cause xác nhận từ code path: query lỗi thiếu error branch nên spinner vô hạn/nhầm lỗi RPC với bytecode rỗng; `keepPreviousData` có thể mang dữ liệu account trước sang query mới; async simulate/receipt chưa gắn với vòng đời phiên ví.
- Sửa: ReadError có nút Thử lại, BlockGuard cho lỗi polling; kiểm lỗi mọi query ở ConfigGuard và 4 trang; batch read fail rõ ràng; mọi read pin chain cấu hình; bỏ placeholder data; remount nội dung theo kết nối/account/chain.
- Giao dịch: kiểm lại phiên trước send và ngay sau simulate, theo dõi thay đổi account/chain, hủy hiệu lực kết quả cũ khi unmount hoặc đổi phiên; chặn gọi trùng trong cùng hook; receipt pin chain. Không thể thu hồi giao dịch đã broadcast hoặc đóng popup của ví thay người dùng.
- HTTP timeout 8 giây, retry transport 0; query retry 1 lần, delay 500ms và retry thủ công. Không thêm dependency.
- Kiểm chứng sau sửa: typecheck exit 0; Vitest **51/51 PASS (5 file, gồm 29 test cũ + 22 test mới)**; build exit 0, JS chính 619,49 kB (gzip 185,03 kB); git diff --check exit 0. Không có lint script.
- Test mới: `rpc.test.ts` (15 ca), `session.test.ts` (5 ca), `transport.test.ts` (1 ca), cộng ca retry trong rpc (tổng rpc 16). Test render server kiểm error branch; session tests kiểm guard thuần; transport test dùng mock fetch/AbortError và fake timers, không gọi Anvil. Test cũ không sửa.
- Chưa xác minh: browser account switching thực tế, MetaMask thật, layout sau sửa, E2E và giao dịch local. Không dựng chain hoặc chạy E2E có giao dịch trong nhiệm vụ này. Test timeout không phải đo timeout mạng thật.
- Còn lại: các thiếu sót verify UI/filter/quorum/pagination và script verification v1.1 thuộc nhiệm vụ khác; dependency audit 27 cảnh báo là số liệu cũ; build cảnh báo chunk >500 kB. Chưa nâng wagmi.
- Kế tiếp: Mạnh/ChatGPT review P3-FIX-01; chỉ tiếp tục việc khác khi được giao.

### Git cuối bước P3-FIX-01

```text
 M CLAUDE.md
?? .github/
?? AGENTS.md
?? README.md
?? docs/PROGRESS.md
?? docs/phase3-frontend-report.md
?? docs/phase3-screenshots/
?? frontend/
```

`git diff --stat` (chỉ file tracked, không phản ánh frontend/docs untracked):

```text
 CLAUDE.md | 26 +++-----------------------
 1 file changed, 3 insertions(+), 23 deletions(-)
```

Bản sửa trong phiên: App, config, main, ConfigGuard, bốn pages, useCurrentBlock, useTx; thêm BlockGuard, ReadError, session và ba test; cập nhật hai tài liệu này. CLAUDE.md, AGENTS.md, README, workflow, screenshots và các thay đổi bàn giao khác được giữ nguyên. Không sửa Solidity, ABI, scripts deploy, package manifest hoặc lockfile.

---


- **Cập nhật:** 2026-11-14 01:39 +0700
- **Bởi:** Claude Code (Claude Opus 5.5)
- **HEAD:** `c9240a57bf6ba8bcb8152b41a0909d7a99dab188` (Phase 2C)
- **Nhánh:** `main`

> File này có thể đã cũ. Test và git là sự thật: nếu mâu thuẫn thì tin test/git rồi sửa file này (xem `AGENTS.md` mục 6).

## 1. Trạng thái các phase

| Phase | Trạng thái | Commit | Ngày commit |
|---|---|---|---|
| 0. Dựng môi trường (Foundry, submodule forge-std v1.17.0, OpenZeppelin v5.6.1) | Xong. Không có commit riêng; nằm trong commit Phase 1 | `738636b` | 2026-11-09 |
| 1. GovToken, GovVote, deploy, seed, lifecycle trên Anvil | Xong | `738636b` | 2026-11-09 |
| 2A. Fuzz + invariant I1–I6 | Xong | `35c1265` | 2026-11-09 |
| 2B. Script `scripts/verify` đối chiếu VoteCast với storage | Xong | `9fe23a7` | 2026-11-09 |
| 2C. `.gas-snapshot`, threat model, ADR | Xong | `c9240a5` | 2026-11-12 |
| 3. Frontend (`frontend/`) | Kỹ thuật xong, **chưa commit** | (chưa có) | |
| 4. Sepolia, CI, README, hosting | Chưa bắt đầu | | |

Phase 3, từng bước, theo bảng trạng thái trong `docs/phase3-frontend-report.md` (ghi ngày 14/11/2026):

| Bước | Trạng thái | Bằng chứng (trong report) |
|---|---|---|
| 0. Chuẩn bị chain | PASS | Dựng lại 14/11; `scripts/verify` độc lập: VERIFIED, 3 log, 600.000 / 250.000 GOV |
| 1. Tạo `frontend/`, pin phiên bản | PASS | 15 gói, không `^`/`~` |
| 2. ABI từ `forge build` | PASS | `npm run sync-abi`, có sha256 |
| 3. Kết nối ví và mạng | PASS | E2E `01` |
| 4. Đọc dữ liệu | PASS | E2E `02`, ảnh |
| 5. Ghi giao dịch | PASS | E2E `02` (delegate, propose, vote) |
| 6. Lỗi tiếng Việt | PASS | Unit test, E2E `01` |
| 7. An toàn hiển thị (XSS) | PASS | E2E `03`, grep `dangerouslySetInnerHTML` = 0 |
| 8. Responsive | PASS | 18 ảnh ở `docs/phase3-screenshots/` |
| 9. Kiểm thử | PASS | Vitest 137/137, E2E 12/12 |
| 10. Kiểm tra cuối | PASS | E2E 12/12 ngày 14/11, không bị kill |

## 2. ĐANG LÀM DỞ (đọc kỹ)

- **Việc đang dở:** Phase 3 đã xong phần kỹ thuật, đang **chờ Mạnh xem lại** `docs/phase3-frontend-report.md` cùng 18 ảnh, rồi mới quyết định có commit hay không. Chưa có commit nào cho Phase 3.
- **Việc của phiên này (14/11):** tạo `AGENTS.md`, chuyển `CLAUDE.md` thành file trỏ sang `AGENTS.md`, tạo file này. Cả ba **chưa commit**.
- **Lỗi và rủi ro:**
  - Exit 137: ngày 12/11, tiến trình chạy E2E bị kill (exit 137) và Anvil dừng cùng lúc, chain mất. Lần chạy ngày 14/11 cho 12/12 và không bị kill. **Nguyên nhân của exit 137 chưa xác minh**: lúc đó không chạy `dmesg`, nên không rõ có phải do hết bộ nhớ (OOM) hay không. Nếu gặp lại, chạy `free -h; dmesg | tail` ngay sau đó.
  - Chain demo nằm trên Anvil (trong bộ nhớ). Tắt Anvil là mất chain, phải chạy lại Bước 0 Phase 3.
  - `npm audit` của `frontend/`: 27 lỗ hổng (16 high, 11 moderate), có wagmi là phụ thuộc trực tiếp bị cảnh báo lan truyền; các node advisory gốc nằm trong nhánh phụ thuộc gián tiếp, gồm nested viem của WalletConnect. Đang chờ Mạnh quyết định ở Phase 4.
- **File chưa commit** (`git status --short` lúc 01:39):
  ```
   M CLAUDE.md
  ?? .github/
  ?? AGENTS.md
  ?? README.md
  ?? docs/PROGRESS.md
  ?? docs/phase3-frontend-report.md
  ?? docs/phase3-screenshots/
  ?? frontend/
  ```
  - `.github/workflows/test.yml` và `README.md` là bản mẫu của `forge init`, có từ trước, **không thuộc Phase 3**.
  - `frontend/.env.local`, `node_modules/`, `dist/` đã bị ignore.

## 3. Việc kế tiếp (theo thứ tự)

1. Bước 10 Phase 3: đã PASS. Không còn việc dở.
2. Mạnh xem lại `docs/phase3-frontend-report.md` và các ảnh trong `docs/phase3-screenshots/`.
3. Commit Phase 3, **chỉ khi Mạnh xác nhận**: stage đúng từng file trong `frontend/`, `docs/phase3-*`. Commit 3 file của phiên này nếu Mạnh muốn.
4. Phase 4 (chưa bắt đầu):
   - Deploy Sepolia bằng keystore (`cast wallet`), ví deployer riêng.
   - Verify source trên Etherscan.
   - GitHub Actions CI: forge fmt/build/test, `forge snapshot --check`, frontend typecheck/test/build, E2E với Anvil.
   - Viết lại `README.md` (bản mẫu hiện có ví dụ `--private-key`).
   - Dọn `.github/` (đang là template của `forge init`).
   - Deploy frontend lên Cloudflare Pages.
   - Quyết định npm audit: nâng wagmi v3 hay giữ v2 kèm ghi chú rủi ro.
   - [Đã thực hiện local trong P3-FIX-03B theo Owner; không còn TODO Phase4] Mở rộng strict verification mục4.5: state, voter trùng, txIndex, quorum, MISMATCH/INCOMPLETE. Phần legacy vẫn tally-only; public provenance/giới hạn nâng cao cần quyết định riêng.

## 4. Quyết định đã chốt và giới hạn đã biết

- Đặc tả v1.1 giữ nguyên: quorum 10% tổng cung tại snapshot, đo For + Against, clock là `block.number`, không execute, không Abstain, không owner, không mint sau deploy (`docs/adr.md`).
- Snapshot không chặn việc mua hoặc mượn GOV **trước** snapshot (đặc tả mục 2.4, `docs/threat-model.md`).
- `hasVoted` chặn theo **địa chỉ**, không theo người thật, nên có thể bị Sybil (một người dùng nhiều ví).
- Độ phủ invariant thấp: trong 40 seed, 25% run có ít nhất 1 proposal Succeeded, 32,5% run có ít nhất 1 Defeated có phiếu, 87,5% run có phiếu được chấp nhận (`docs/phase2a-invariant-report.md`).
- `scripts/verify` tin vào RPC: nếu cùng một RPC trả sai cả log lẫn storage một cách nhất quán thì không phát hiện được. Script chưa đối chiếu weight với `getPastVotes` (`docs/phase2b-verify-report.md`).
- Mọi kiểm thử chỉ chạy trên Anvil local. Chưa chạy trên Sepolia, chưa thử với MetaMask thật; E2E dùng ví EIP-1193 giả.
- Frontend giữ wagmi v2 (`2.19.5`) theo quyết định của Mạnh.

## 5. Kiểm tra nhanh trạng thái thật (chạy lúc 2026-11-14 01:39 +0700)

| Lệnh | Kết quả |
|---|---|
| `forge --version` / `anvil --version` | 1.7.1 / 1.7.1 |
| `node --version` / `npm --version` | v24.19.0 / 11.17.0 |
| `forge test` | 53 passed, 0 failed (4 suite: 4 + 39 + 3 fuzz + 7 invariant) |
| `forge fmt --check` | exit 0 |
| `forge snapshot --check` | exit 0 |
| `cd frontend && npm run typecheck` | exit 0 |
| `cd frontend && npm test` | 9 file, 137 passed |
| E2E Playwright | **Không chạy lại ở bước này.** Lần gần nhất (14/11, theo report): 12 passed |
| `scripts/verify` | **Không chạy lại ở bước này.** Lần gần nhất (14/11, theo report): VERIFIED |

Phiên bản pin chính:
- Frontend: wagmi 2.19.5, viem 2.57.13, react 19.3.1, @tanstack/react-query 5.105.0, vite 8.3.5, tailwindcss 4.3.3, typescript 7.0.2, vitest 5.0.5, @playwright/test 1.64.1.
- `scripts/verify`: viem 2.57.11, tsx 4.23.15, typescript 7.0.2.

## 6. Địa chỉ chain hiện tại (Anvil cục bộ, sẽ đổi hoặc mất mỗi lần restart)

Đọc từ `frontend/.env.local` và `docs/phase3-frontend-report.md`; lúc 01:39 đã kiểm bằng `cast code` (có bytecode).

| Contract | Địa chỉ |
|---|---|
| GovToken | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| GovVote | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |

Lúc kiểm, Anvil ở block 7.261 với `proposalCount` = 3. Hai địa chỉ này chỉ lặp lại được nếu deploy lại từ một Anvil mới bằng đúng thứ tự Bước 0 (cùng deployer, cùng nonce).

### P3-FINAL-01 — Git handover snapshot cuối

HEAD c9240a57bf6ba8bcb8152b41a0909d7a99dab188/main; 168 untracked + 3 tracked modified; staged0. So với108 untracked ban đầu: thêm60file bằng chứng/test/manifest trong FINAL, không có tracked modification mới. GroupA=166file, B=3, C=2; toàn bộ paths ở manifest. 48ảnh mới giữ riêng lượt PASS đầu/source cuối/supplement.

```text
 M CLAUDE.md
 M docs/phase2b-verify-report.md
 M scripts/verify/src/main.ts
?? .github/
?? AGENTS.md
?? README.md
?? docs/PROGRESS.md
?? docs/phase3-final-evidence/
?? docs/phase3-final-manifest.json
?? docs/phase3-frontend-report.md
?? docs/phase3-screenshots/
?? docs/phase3-verification-evidence.json
?? frontend/
?? scripts/verify/src/adapter.ts
?? scripts/verify/src/legacy-main.ts
?? scripts/verify/test/rpcFixture.ts
?? scripts/verify/test/strict.test.ts
?? shared/
```

`git diff --stat` chỉ phản ánh tracked, không bao phủ frontend/shared untracked:

```text
 CLAUDE.md                     |  26 +-------
 docs/phase2b-verify-report.md |  66 +++++++++++++++++++
 scripts/verify/src/main.ts    | 148 ++++++++----------------------------------
 3 files changed, 95 insertions(+), 145 deletions(-)
```
