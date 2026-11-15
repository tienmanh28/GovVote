# PROGRESS: tiến độ GovVote (bộ nhớ chung giữa các phiên AI)

## PR-A / P4-D1 — guard deploy và runbook, 15/11/2026, Codex

- Nhánh `feat/p4-d1-deploy-guard`, base/main **1e8b944**; fetch/pull ff-only, PR #2 MERGED lúc 09:35:02 UTC, working tree sạch trước tạo nhánh. Owner giao ba PR độc lập A → B → C; D0 đã merge, checkpoint OPEN bên dưới là lịch sử. Không tự merge PR nào.
- Guard/test **653da54**: EXPECTED_CHAIN_ID bắt buộc, allowlist theo shared/chains.ts, mismatch có expected/actual và chặn trước startBroadcast. Sepolia đọc broadcaster thực bằng readCallers sau startBroadcast, recipient phải đúng signer; hậu kiểm toàn bộ 1.000.000 GOV ở signer, token/config khớp. Local giữ recipient/tham số và SeedDemo phân phối 400.000/250.000/200.000/150.000 GOV, không delegate; SeedDemo giờ chỉ local. Không thay src, spec hoặc test cũ.
- Đã kiểm local **54/54 Foundry** = 53 cũ + 1 test mới chứa **11 tình huống**, 0 fail/skip. Các ca dùng vm.setEnv từng bị race khi chạy song song; gom tuần tự, giữ toàn bộ assertion và không đổi threads/fuzz của test cũ. Broadcast cheatcode không rollback khi ca cố ý revert, nên harness dọn context sau từng ca. Missing-env trong harness dùng chuỗi rỗng (setEnv không có unset); thêm offline forge script với env thực sự vắng mặt đã xác nhận ExpectedChainIdRequired trước RPC/broadcast.
- `forge fmt --check`, shellcheck PASS; build --sizes và so SHA256 xác nhận **runtime + creation bytecode không đổi**, runtime GovToken **6.846 B**, GovVote **4.603 B**. Snapshot tạo lại **đúng một lần** với seed 0x1 / threads 1, hai check liên tiếp exit 0. Có một dòng test mới và ba dòng gas fuzz được tính lại theo tập test/dictionary mới; không sửa test/fuzz thresholds. Bằng chứng: `docs/p4-d1-evidence/`.
- Cập nhật nơi gọi local và .env.example với EXPECTED_CHAIN_ID=31337; README EN/VI, AGENTS, lệnh chạy lại trong phase1-demo-report được đồng bộ, không đổi receipt lịch sử. Runbook `docs/sepolia-runbook.md` **CHƯA thực hiện**, chỉ placeholder/env: keystore govvote-deployer, kiểm chain/deployer/ETH, dry-run không broadcast, Owner duyệt deploy và từng transfer, self-delegate, hậu kiểm, D3 source verification/frontend, bảng Owner điền. Không private key/mnemonic/API credential, không RPC public.
- Anvil cô lập **8549**: prepare-chain PASS, proposal #1 Succeeded, For600.000/Against250.000 GOV; browser **64/64** = validation34 + reliability12 + finalUI3 + E2E15. Trap đã tắt Anvil. CI chưa xác minh tại commit tài liệu này; sẽ theo dõi Checks sau push. Kế tiếp D2/D3 chỉ Owner chuẩn bị keystore/ETH/RPC/API key và bốn tài khoản, duyệt từng giao dịch; không tự deploy Sepolia. Rủi ro: expected/RPC cùng chọn sai nhưng đều thuộc allowlist không bị phát hiện; địa chỉ transfer sai có thể mất token; RPC nói dối/fork sau anchor, hang SeedDemo cũ chưa giải thích.
- Git snapshot trước docs commit: HEAD653da54, nhánh A; thay đổi .env.example, AGENTS.md, README EN/VI, docs/phase1-demo-report.md, docs/threat-model.md, scripts/ci/prepare-chain.sh; mới docs/sepolia-runbook.md và docs/p4-d1-evidence/. Tất cả do phiên này tạo, chưa push; không đụng chain8545.

## P4-D0 — PR #2 đã qua CI, chờ kiểm commit docs cuối, 15/11/2026, Codex

- Checkpoint hiện hành; mục DỪNG bên dưới là lịch sử đã được Owner giải quyết. Nhánh `feat/p4-d0-chain-profile`, base `aaf77fa`, PR #1 đã merge. Các commit: `31b9458` (profile), `fd6b8ac` (consumers), `bd0adc6` (tests). Chưa merge nhánh D0; Owner merge.
- Nguồn chính sách: `shared/chains.ts`, chỉ `{31337, 11155111}`; mainnet và mọi ID khác bị từ chối rõ ràng. Cấu hình sai bị chặn trước RPC; endpoint trả chain khác bị chặn ngay sau eth_chainId, trước state/logs. CLI mới có `GOV_CHAIN_ID`, mặc định local; frontend dùng `VITE_CHAIN_ID`. Sepolia phải có URL RPC tường minh, không tự dùng RPC public của viem.
- Local giữ 12 confirmations, không explorer và `LOCAL_DEPLOYMENT_EVIDENCE`. Sepolia chọn 64 confirmations vì public testnet cần khoảng lùi bảo thủ hơn, không coi đó là finality; explorer sepolia.etherscan.io và `PUBLIC_TESTNET_DEPLOYMENT_EVIDENCE`. Nhãn chỉ là bằng chứng quan sát bytecode/token liên kết/event-storage qua RPC, không phải audit, nguồn gốc hay Etherscan source verification. Core, runner, cả hai CLI, UI/config/wagmi và continuity anchor dùng profile; strict exit 0/1/3/2, legacy 0/1/2 giữ nguyên.

### Test cũ được cập nhật theo yêu cầu mới

- **Owner đã cho phép:** `frontend/tests/lib.test.ts:172`, đổi duy nhất `VITE_CHAIN_ID: "11155111"` thành `"137"`; dòng 171 thêm comment tiếng Việt vì Sepolia được P4-D0 hỗ trợ. **Assertion 3 lỗi tại dòng 175 và mọi assertion cũ giữ nguyên.** Ý định test vẫn là hai địa chỉ sai + chain không được hỗ trợ. Không thay test để che lỗi.
- Test mới `frontend/tests/chainProfile.test.ts` (đổi tên từ draft .tsx, không đổi cấu hình Vitest) kiểm riêng Sepolia hợp lệ, Sepolia thiếu địa chỉ chỉ có hai lỗi địa chỉ, mainnet bị chặn; thêm metadata, provenance, confirmations, explorer an toàn, ConfigGuard không mount RPC và continuity anchor. CLI thêm 14 ca loopback cho strict/legacy, kể cả exit 2 trước RPC.
- Bằng chứng cục bộ tại `docs/p4-d0-evidence/`: frontend/CLI typecheck PASS, format:check PASS, forge fmt PASS, forge **53/53**. Vitest **151 cũ + 22 mới = 173**, tất cả đã được chạy và xanh: full run đầu 170/170; ba ca continuity bổ sung được kiểm trong profile 22/22, suites liên quan cuối 46/46; không chạy lại suite không đổi. CLI **37/37** (23 + 14), 0 fail/skip. Full run CI đã xác nhận **173/173**, 12 files, không skip ở d45298f.
- Browser **64/64** trên Anvil 1.7.1 cô lập **18548**: validation 34 (1,1 phút), reliability 12 (14,8s), final UI 3 (5,2s), E2E gốc/hardening 15 (25,1s). Dựng chain bằng script CI nguyên bản, không retry, timeout RPC giữ 45s. Trap đã tắt Anvil, kiểm bind xác nhận cổng được trả. Các đổi template tên mạng cuối giữ nguyên chữ local; unit liên quan xanh, CI sẽ kiểm lại 64 browser ở HEAD cuối.
- Không sửa contract `src/`, script deploy `script/`, spec, CI, dependency, browser test hoặc cấu hình Vitest. Không public RPC, không Sepolia deploy, không tác động chain 8545, không force push/merge. README EN/VI và threat-model ghi rõ CHƯA deploy Sepolia, CHƯA audit. Còn chưa xác minh: mạng public/MetaMask thật; RPC có thể nói dối nhất quán, fork sau anchor chưa theo dõi; diagnostic hang SeedDemo cũ chưa giải thích.
- Kế tiếp sau Owner merge: **D1 guard EXPECTED_CHAIN_ID trong script deploy phải được Owner duyệt trước**; sau đó mới xem xét deploy Sepolia, mỗi giao dịch cần Owner xác nhận. Không bắt đầu D1 hay Sepolia trong D0.
- Git snapshot trước commit docs: HEAD `bd0adc6`; status chỉ README.md, README.vi.md, docs/PROGRESS.md, docs/threat-model.md modified và docs/p4-d0-evidence/ mới. Đây là snapshot lịch sử trước docs d45298f; sau đó đã push thường và mở PR #2. Hash commit docs kết thúc sẽ được báo ở PR và báo cáo cuối.

### Bằng chứng CI trên PR #2

- [PR #2](https://github.com/tienmanh28/GovVote/pull/2) OPEN, Owner merge; các commit code/tests `31b9458`, `fd6b8ac`, `bd0adc6`, docs/local evidence `d45298f`. Working tree sạch sau bốn commit và push thường, không merge.
- [PR run 43697609309](https://github.com/tienmanh28/GovVote/actions/runs/43697609309), attempt 1, HEAD **d45298f7218158d5c516036bc337173ad73b8c2e**: **4/4 SUCCESS**. Không job đỏ, không sửa CI, không rerun test. Summary/API/logs xác nhận số thực, lưu `docs/p4-d0-evidence/actions-d45298f.json`.

| Job | Kết luận | Thời gian | Test thực tế |
|---|---|---|---|
| contracts | SUCCESS | 40s | forge 53/53; snapshot 53/53 |
| frontend | SUCCESS | 35s | Vitest 173/173 = 151 cũ + 22 mới |
| verify-cli | SUCCESS | 38s | CLI 37/37 = 23 cũ + 14 mới |
| e2e | SUCCESS | 3m04s | browser 64/64 = validation 34 + reliability 12 + final UI 3 + E2E gốc/hardening 15 |

- 64 browser tests ở CI đã kiểm cả template tên mạng cuối trên code fd6b8ac. Refactor giữ chữ local, không cần chỉnh bất kỳ assertion/browser test nào. Kiểm local không chạy lại suite không đổi; CI thực hiện đầy đủ workflow theo chính sách repo.
- Commit kết thúc này **chỉ docs/bằng chứng CI**; sau push vẫn phải `gh pr checks --watch` cho HEAD mới, chưa tuyên bố trước kết quả. Nếu bốn job xanh, P4-D0 **READY_FOR_OWNER_REVIEW**, dừng chờ Owner merge, khuyên **Create a merge commit** để giữ hash bằng chứng. Không tự bắt đầu D1/deploy Sepolia.
- Git snapshot ngay trước cập nhật CI: HEAD/origin `d45298f`, status/diff sạch. Sau cập nhật: `docs/PROGRESS.md`, `docs/threat-model.md` modified, `docs/p4-d0-evidence/actions-d45298f.json` mới; không thay code/test.

## P4-D0 — DỪNG vì test cũ mâu thuẫn allowlist mới, 15/11/2026, Codex

- Nhánh `feat/p4-d0-chain-profile`, base `aaf77fa` (merge PR #1). Preflight: fetch/pull --ff-only, PR #1 MERGED lúc 08:48:09 UTC, working tree sạch, nhánh chưa tồn tại trước khi tạo. Chưa commit, push hoặc mở PR D0.
- Draft chưa hoàn tất: `shared/chains.ts` là nguồn profile local/Sepolia; local 12 confirmations, public testnet 64 (chính sách bảo thủ hơn, không bảo đảm finality), provenance `PUBLIC_TESTNET_DEPLOYMENT_EVIDENCE`. Core/runner, strict/legacy CLI và UI/config/explorer đã được nối profile. Sepolia yêu cầu URL RPC tường minh; chain ngoài allowlist bị chặn trước các phép RPC khác. Chưa gọi bất kỳ public RPC nào.
- **Mâu thuẫn cần Owner quyết:** `frontend/tests/lib.test.ts:171` dùng `VITE_CHAIN_ID: "11155111"` làm chain không được hỗ trợ và assertion tại dòng 174 đòi 3 lỗi (chain + hai địa chỉ). P4-D0 cho phép Sepolia nên chỉ còn 2 lỗi địa chỉ: Vitest **150 PASS / 1 FAIL**, tổng 151. Không sửa test cũ, không thêm lỗi giả, không nới assertion. Đề xuất Owner cho phép đổi duy nhất fixture chain sai này sang `"137"`, giữ nguyên assertion 3 lỗi và bổ sung test Sepolia hợp lệ như yêu cầu.
- Kiểm đã chạy: frontend/CLI typecheck PASS; CLI **37/37** (23 cũ + 14 mới); `forge fmt --check` PASS; `forge test` **53/53**. Forge chỉ cảnh báo cache chữ ký ngoài workspace không ghi được. Prettier đã chạy trên các file code đổi; chưa chạy full format:check. Test frontend mới hiện là `.test.tsx`, trong khi cấu hình Vitest chỉ nhận `.test.ts`, nên **chưa được chạy**; cần chuyển test mới sang `.test.ts` với createElement hoặc mở rộng include khi tiếp tục, không được tính vào số đã xanh. Chưa chạy browser 64, chưa hoàn tất README/threat-model/PR/CI.
- Dừng ngay sau lỗi do ràng buộc Owner, chờ quyết định về fixture cũ; không sửa contract, script deploy, spec, timeout RPC hoặc test cũ; không tác động chain 8545. Không có Anvil do phiên D0 khởi động nên không có tiến trình cần tắt.
- Git snapshot trước cập nhật checkpoint: HEAD `aaf77fa`, nhánh D0; status có 12 file code tracked modified và 4 file mới (profile, CLI chain config, hai file test). `git diff --stat`: 12 files changed, 155 insertions(+), 74 deletions(-); checkpoint này bổ sung `docs/PROGRESS.md` modified. Tất cả là thay đổi trong phiên D0, chưa stage.

## CI setup — hoàn tất chứng minh, 15/11/2026, Codex

- **READY_FOR_OWNER_REVIEW:** PR #1, nhánh feat/p4-b2-verifier-hardening; Owner merge. Fetch xác nhận HEAD/origin f73fe36 và working tree sạch lúc tiếp nhận; PROGRESS cũ đã lạc hậu. Không sửa contract/spec/test, không force push, không Sepolia, không merge.
- Nguyên nhân đã xác nhận trên runner: `cast rpc anvil_mine` đào ~7.200 block/request vượt timeout mặc định **45s**. Hai diagnostic run 43659543705/43659539697 ghi FAIL đúng tại mine past deadline sau 45s; SeedDemo đã ONCHAIN EXECUTION COMPLETE & SUCCESSFUL; Anvil vẫn đào block sau client timeout. Run xanh đo mining31s, local44,66s; CPU load tái hiện cùng lỗi.
- So sánh c20d2fb..b148b0a chỉ docs. Cùng Ubuntu24.04 image20261111.370.1, forge/anvil1.7.1 commit4072e487; mọi endpoint loopback127.0.0.1, không có localhost/IPv6. Cài Chromium kết thúc trước Anvil; forge/cast chờ receipt, không dùng sleep để chờ giao dịch. Timestamp đầy đủ tại baseline-comparison.json. Một rerun --failed trước sửa của b148b0a/43602966837 attempt2 đã xanh.
- Fix **f73fe36** chia batch500, giữ tổng block/voting period7200/deadline và timeout45s. Không retry RPC, giao dịch hay test. Cùng tải CPU: trước sửa fail45s; sau sửa lifecycle/tally PASS, tổng mining89s nhưng batch dài nhất12s. Chẩn đoán: **1a531b6**, **61c4687**; setup guard180s/kill-after10s, artifact lỗi/hủy retention2 ngày.
- Ba lần liên tiếp **cùng f73fe36**, run PR [43659985832](https://github.com/tienmanh28/GovVote/actions/runs/43659985832): push rồi hai full rerun, đều 4/4 job SUCCESS; mỗi lần contract53 (+snapshot53), Vitest151, CLI23. Không rerun riêng test lỗi.

| Attempt | Kết luận | E2E | Browser tests |
|---|---|---|---|
| 1 | SUCCESS | 213s | 64 = 34+12+3+15 |
| 2 | SUCCESS | 217s | 64 = 34+12+3+15 |
| 3 | SUCCESS | 221s | 64 = 34+12+3+15 |

- Quét artifact mới nhất **14139302737**, run43659539697, 6 file: không có 0xac0974be/PRIVATE_KEY/mnemonic/seed phrase (case-insensitive); không cần xóa artifact. Filter trước disk trong anvil-log.py được giữ. Dọn cuối: bỏ -vvvv SeedDemo, bỏ dòng trắng/hash/time lặp; giữ timestamp, tiến độ block/RPC/lỗi, log khi fail/hủy và guard180s. Shellcheck/actionlint/Python syntax PASS; commit dọn/docs sẽ được kiểm lại Checks của PR sau push.
- Bằng chứng bền: docs/p4-ci-setup-evidence/ (ba attempts, so image/timestamps, lỗi runner30 dòng, local before/after, artifact audit). Rủi ro còn: diagnostic push1a531b6 từng kẹt >7 phút ở BEGIN SeedDemo rồi bị hủy, chưa giải thích và không tính proof; RPC có thể nói dối nhất quán; fork sau anchor chưa theo dõi. Không tuyên bố đã sửa riêng hang SeedDemo.
- Git snapshot trước commit kết thúc: HEAD/origin=f73fe36, status/diff trống trước dọn/docs. PR chưa merge; khuyên Owner dùng **Create a merge commit** để giữ hash bằng chứng. Các checkpoint dưới là lịch sử.

## P4-B2 — verifier hardening, 14/11/2026, Codex

- **CI_BLOCKED_SETUP — CHƯA ĐẠT yêu cầu 4 job xanh ở head mới nhất:** [PR #1](https://github.com/tienmanh28/GovVote/pull/1) trên `feat/p4-b2-verifier-hardening`, **chưa merge**, Owner merge. Implementation F3/F4 và tests đã PASS tại c20d2fb; sau commit chỉ-docs b148b0a, cả workflow push và PR lại FAIL khi dựng chain local. Dừng sửa, chờ Owner giao debug setup ngoài phạm vi verifier. Các checkpoint bên dưới là lịch sử.
- Bước 0: fetch, switch main, pull --ff-only; main/remote cùng `97f5bf55ab8e65b215e27989e48ba61176b2e49e`, working tree sạch, nhánh mới chưa tồn tại trước khi tạo. Không đổi contract `src/`, đặc tả, dependency, test thresholds, `.env.local` chính hoặc chain 8545.
- Commit đã tạo: `f21dfa0` (chỉ bốn runs-on thành ubuntu-24.04, actionlint 1.7.12 PASS); `1dec025` (F3 EIP-1898); `2d5a764` (fixture hash động theo block đã quan sát, regression đổi confirmations); `c3ba01e` (F4 bounded streaming và E2E). Tất cả dùng `Co-authored-by: Codex <noreply@openai.com>`, không amend/no-verify/force push.
- **F3:** raw eth_call/eth_getCode đọc evidence bằng `{blockHash: hashH, requireCanonical: true}`. Tất cả 11 state reads ở hash H; proposalCount chẩn đoán ID chưa đủ confirmations dùng hash latest đã quan sát để giữ nguyên INVALID_INPUT/NOT_CONFIRMED. JSON-RPC từ chối hash/EIP-1898 => INCOMPLETE/MISSING_DATA, thông báo rõ, không fallback số block. Giữ kiểm anchor cuối lượt => ANCHOR_CHANGED khi hash đổi.
- **F4:** HTTP shared dùng `DEFAULT_MAX_RESPONSE_BYTES=5242880` (5 MiB/response), cấu hình qua tham số `maxResponseBytes`. Kiểm cả Content-Length và byte thực, buffer tăng dần có trần, abort/cancel trước JSON.parse khi vượt => INCOMPLETE/RESOURCE_LIMIT. Biên đúng ngưỡng nhận; header nói dối vẫn chặn. Strict CLI exit codes giữ 0 VERIFIED / 1 MISMATCH / 3 INCOMPLETE / 2 RPC_ERROR hoặc INVALID_INPUT; legacy không đổi semantics/transport.
- Kiểm local: frontend/CLI typecheck PASS, format:check PASS, production build PASS (cảnh báo chunk >500 kB giữ nguyên). Vitest **151/151** (137 cũ + 14 mới); CLI **23/23** (17 cũ + 6 mới). Không xóa test hay nới assertion. Fixture response cũ đổi sang Response/stream thật, assertion giữ nguyên.
- Anvil 1.7.1 trên **127.0.0.1:18547**, bản sao `/tmp/govvote-p4-b2-e2e-53j2mmqk`: probe cả eth_call/eth_getCode EIP-1898 PASS; deploy/seed/lifecycle bằng unlocked account local. **15/15 E2E** = 12 gốc + 3 mới (UI/strict CLI VERIFIED thực, unsupported EIP-1898 INCOMPLETE, body >5 MiB INCOMPLETE). Thêm **16/16** bộ p3-fix-03 verifier UI; responsive 375×812, 768×1024, 1280×800. Strict CLI riêng VERIFIED tại **H=7217**, hash `0x0df7da6a040e6329586e72b4935f3e46685545b7cb6b3c34cdb9ae9cad9aad44`, 18 requests. Trap đã tắt Anvil, kiểm cổng 18547 được trả.
- Bằng chứng bền tại `docs/p4-b2-evidence/`: `eip1898-anvil.json`, `strict-anvil.json`, `vitest.log`, `cli.log`, `e2e.log`, `verify-ui.log`. E2E screenshot/trace chỉ sinh trong bản sao, không ghi đè ảnh Phase 3 ở repo chính.
- Lỗi local đã chẩn đoán/sửa: tiến trình probe Anvil không sống qua tool call => gom lifecycle vào một phiên có cleanup; fixture stream tự đóng nên không chứng minh được cancel => giữ stream mở khi mô phỏng payload đang tải, không đổi assertion; fixture chỉ chấp nhận H mặc định => lưu hash thực sự đã trả và thêm test đổi confirmations. E2E fixture từng hardcode 8545 => đọc RPC_URL, giữ nguyên assertion. Automatic review từng nhầm F3 lẫn F4; kiểm diff chứng minh F4 chưa áp rồi được phép commit F3.
- CI đầu: [workflow push 43601381595](https://github.com/tienmanh28/GovVote/actions/runs/43601381595) FAIL ở dựng chain local: RPC timeout sau deploy, chưa vào browser. [Workflow PR 43601407874](https://github.com/tienmanh28/GovVote/actions/runs/43601407874) cùng commit đã dựng chain thành công và pass validation 34, nhưng fixture reliability dùng chung cho UI thường bị guard hash mới từ chối block-number reads. Commit `c20d2fb` thêm opt-in chỉ cho fixture UI thường; strict fixture mặc định vẫn bắt hash, object selector vẫn kiểm hash đã quan sát. Giữ nguyên mọi assertion, rerun reliability **12/12** và các Vitest liên quan **46/46** PASS, typecheck/format PASS. Không đổi timeout hay script deploy; nguyên nhân gốc của timeout push **chưa xác minh**. Hai workflow vòng sửa sau đều dựng chain và PASS toàn bộ. Log tại `reliability.log`, `ci-initial-push-error.log`, `ci-initial-pr-error.log` trong thư mục bằng chứng.
- Phạm vi/rủi ro: bảo vệ shared strict verifier và HTTP endpoint probe; legacy tally-only và RPC wagmi khác không được nâng thành strict. Một RPC vẫn có thể nói dối nhất quán; không theo dõi fork sau anchor, không state proof hay weight proof từng voter. Chưa thử public RPC thật, vẫn chặn chain ngoài Anvil; không Sepolia. Xem `docs/threat-model.md` P4-B2.
- CI giữ nguyên mọi dòng khác ngoài bốn runs-on theo Owner. Label cũ của bước browser vẫn ghi 12/61; summary Actions xác nhận **64 browser tests** (34 validation + 12 reliability + 3 final UI + 15 E2E), không suy từ label. `gh pr checks --watch --interval 30` kết thúc exit 0 ở vòng sửa 1.
- [Actions PR 43602384113](https://github.com/tienmanh28/GovVote/actions/runs/43602384113) tại `c20d2fb361f3cb16b077ce2551787cf849ec368c`: **4/4 SUCCESS**, Ubuntu 24.04. [Workflow push 43602379147](https://github.com/tienmanh28/GovVote/actions/runs/43602379147) cũng **4/4 SUCCESS**. Bằng chứng metadata/summary: `actions-c20d2fb.json`, `ci-green-summary.log`.

| Job PR | Kết luận | Thời gian | Test thực tế |
|---|---|---|---|
| contracts | SUCCESS | 53s | 53/53; snapshot 53/53 |
| frontend | SUCCESS | 41s | Vitest 151/151 |
| verify-cli | SUCCESS | 28s | CLI 23/23 |
| e2e | SUCCESS | 3m44s | 64/64 = 34+12+3+15 |

- Kiểm sau commit docs **b148b0a**: [PR run 43602966837](https://github.com/tienmanh28/GovVote/actions/runs/43602966837) và [push run 43602960708](https://github.com/tienmanh28/GovVote/actions/runs/43602960708) đều FAIL tại `Dựng chain demo`, **trước browser/verifier**; contracts/frontend/CLI SUCCESS. Lỗi trực tiếp: `Error: error sending request for url (http://127.0.0.1:8545/)`, `operation timed out`, sau deploy hai contract. Đây là Anvil 8545 riêng trên runner, không phải chain 8545 ở máy Owner. b148b0a chỉ đổi docs, không đổi code so với c20d2fb đã xanh. Nguyên nhân gốc/ràng buộc Ubuntu 24.04/Foundry/Anvil **chưa xác minh**; log không xác định được lệnh lifecycle cụ thể vì output các lệnh bị chuyển vào /dev/null. Không đoán nguyên nhân, không tăng timeout, không nới kiểm tra, không sửa script deploy ngoài scope.
- Bằng chứng lỗi mới: `actions-b148b0a-failure.json`, `ci-final-setup-error.log` (30 dòng quanh lỗi đầu). Bảng 4/4 xanh ở trên chỉ áp dụng c20d2fb, **không phải kết luận head b148b0a**. Một vòng sửa fixture đã dùng; dừng vì lỗi setup còn lại chưa chứng minh thuộc F3/F4, không sử dụng vòng sửa thứ hai để đổi deployment pipeline ngoài phạm vi Owner giao.
- Git snapshot trước commit bàn giao lỗi: nhánh feat/p4-b2-verifier-hardening tại b148b0a, đồng bộ remote; `git status --short`/`git diff --stat` trống trước thay đổi docs. Commit bàn giao này chỉ thêm trạng thái lỗi/bằng chứng; Actions tự kích hoạt khi push docs có thể đang chạy, **chưa xác minh**, không theo dõi tiếp sau điểm dừng. Kế tiếp cần Owner quyết định phạm vi debug `scripts/ci/prepare-chain.sh` và môi trường Foundry/Anvil runner; không tự merge hoặc bắt đầu Phase 4 khác.

## P4-C1 — ghim số luồng cho gas snapshot, 14/11/2026, Codex

- Codex tiếp nhận từ Claude Code sau khi Claude hết token. Checkpoint này là trạng thái hiện hành; các checkpoint bên dưới lưu lịch sử.
- Bước 0: `HEAD = origin/main = 492d2683f21b467baf88c11d90d6c932a212d584`, nhánh `main`, working tree sạch; đã fetch. Remote public: https://github.com/tienmanh28/GovVote. `gh auth status` xác nhận tài khoản `tienmanh28` hoạt động, không in token thật.
- PROGRESS cũ chưa ghi remote và hai lần CI đã chạy. [Actions lần 1, 0b5402e](https://github.com/tienmanh28/GovVote/actions/runs/43595979018) và [lần 2, 492d268](https://github.com/tienmanh28/GovVote/actions/runs/43596632803) đều FAIL ở snapshot của contracts; frontend/verify-cli PASS, e2e SKIPPED. Lần 1 chưa ghim seed; lần 2 ghim seed vẫn lệch số gas fuzz trên runner.
- Nguyên nhân: fuzz chạy song song nên gas trung bình/trung vị phụ thuộc cả seed lẫn số luồng. Tạo baseline bằng `forge snapshot --fuzz-seed 0x1 --threads 1`; kiểm bằng `forge snapshot --check --fuzz-seed 0x1 --threads 1`. Chỉ so sánh khi cùng seed, số luồng, Foundry **1.7.1** và solc **0.8.28**. Seed/luồng chỉ ghim cho snapshot; bước `forge test -vv` của CI vẫn fuzz ngẫu nhiên, giữ nguyên `foundry.toml` và test.
- Đã tạo lại `.gas-snapshot` đúng **một lần**, exit 0, **22,85 giây**, **53/53 PASS**. Hai lần `--check` liên tiếp: exit 0, **21,81 giây** và **23,01 giây**, mỗi lần 53/53 PASS. Chỉ ba dòng fuzz gas thay đổi; SHA-256 baseline: `5bf92c0e8ae3cc45e6739b73bd05a7e6ff520ab1e96fde9148fcd5622fe21f07`.
- Clone mới `~/ci-dryrun/clone4`: clone origin sạch, `git submodule update --init --recursive`, áp patch đang kiểm chứng trước khi commit (không mang theo cache/artifact). Snapshot `--check` exit 0/**24,91 giây**; `forge test -vv` **53/53 PASS**, exit 0/**6,91 giây**; `taskset -c 0-3 forge snapshot --check --fuzz-seed 0x1 --threads 1` exit 0/**22,79 giây**, 53/53 PASS. Sau khi tạo commit đã đối chiếu toàn bộ cây file, đưa clone về đúng `fb0231e` và xác nhận `git status --short` trống. Log và thời gian bền: `~/ci-dryrun/logs/clone4-{snapshot,test,taskset}.{log,time}`.
- `forge build`, `forge fmt --check`, `forge build --sizes`: exit 0; deployed size GovToken **6.846 bytes**, GovVote **4.603 bytes**. actionlint **1.7.12** kèm shellcheck: exit 0. `git diff --check`: exit 0. Đã đối chiếu đặc tả mục 4.3 và Phụ lục B; không đổi đặc tả, contract, test hay ứng dụng.
- Đã sửa hướng dẫn snapshot trong AGENTS, README EN/VI, threat-model, ADR, PROGRESS và các khuyến nghị snapshot của báo cáo Phase 3; lệnh kiểm cũ trong bằng chứng lịch sử được ghi rõ là lịch sử. Không có file `docs/phase2c*` trong repo để sửa.
- Đã push thường commit **`fb0231e98e13ef2148a1571d74e2aee6482acb60`** lên `origin/main`. [Actions 43598111070](https://github.com/tienmanh28/GovVote/actions/runs/43598111070): **SUCCESS, 4/4 job xanh**. Theo dõi bằng `gh run watch --interval 30 --exit-status`, exit 0. Gas fuzz trên runner khớp baseline: tally μ=1.852.898/~=1.907.284; threshold μ=209.491/~=269.735; weight μ=463.773/~=466.026. Toàn bộ browser **61/61 PASS** (34 validation + 12 reliability + 3 final UI + 12 E2E gốc). Log bền: `~/ci-dryrun/logs/threads1-actions-43598111070.log`; log local: `threads1-snapshot-{generate,check1,check2}.{log,time}` cùng thư mục.

| Job | Kết luận | Thời gian (completedAt − startedAt) |
|---|---|---|
| contracts (forge) | SUCCESS | 1m05s |
| frontend (typecheck, format, Vitest, build) | SUCCESS | 48s |
| verify-cli (scripts/verify) | SUCCESS | 30s |
| e2e (Anvil + Playwright) | SUCCESS | 3m31s |

- Sau khi cả bốn job xanh, đã tạo và **GET đọc lại xác nhận** [ruleset main 27262992](https://github.com/tienmanh28/GovVote/rules/27262992): `enforcement=active`, chỉ áp dụng `refs/heads/main`, đúng hai rule `non_fast_forward` (cấm force push) và `deletion` (cấm xóa nhánh), `bypass_actors=[]`. Không bật required status checks hoặc require pull request.
- Điều lệch môi trường đã xử lý: sandbox ban đầu chặn fetch/gh; chạy lại với quyền phù hợp thành công. Automatic approval review ban đầu từ chối commit do chưa nhận ra ủy quyền trong tệp yêu cầu; đối chiếu lại đúng đoạn Owner cho phép commit/push rồi được chấp thuận. Không có thay đổi ngoài phạm vi.
- Kế tiếp, chỉ khi Owner giao: xem Mermaid trong README trên GitHub; quyết định required checks; spike wagmi v3 trên nhánh riêng; P4-B2 verifier hardening; chain profile; rồi Sepolia (yêu cầu rõ, ký bằng keystore). Các việc này **chưa thực hiện/chưa xác minh** trong bước CI.
- Snapshot git sau push bản sửa CI, trước khi cập nhật checkpoint docs này: `HEAD = origin/main = fb0231e`, working tree sạch. Output hai lệnh đều trống:

  ```text
  $ git status --short
  $ git diff --stat
  ```

- Đang hoàn tất commit docs theo Owner: `docs: cập nhật PROGRESS sau CI xanh`, chỉ file PROGRESS, push thường; dừng chờ Owner sau báo cáo cuối, không bắt đầu việc Phase 4 khác.

## P4-C1/C2 — CI GitHub Actions và LICENSE, 14/11/2026, Claude

- HEAD sau CI: `603c97fad57c9d6aac96bf57f9e1255bea11cad0` (`ci: GitHub Actions (contracts, frontend, verify, e2e) và LICENSE MIT`). Commit docs chứa checkpoint này có hash riêng.
- Trạng thái: CI **chuẩn bị xong nhưng CHƯA chạy trên GitHub** (repo chưa có remote). Chỉ có chạy thử cục bộ trong clone sạch `~/ci-dryrun`.
- `.github/workflows/ci.yml`: job contracts (fmt, build --sizes, test, snapshot --check), frontend (typecheck, format:check, Vitest, build, npm audit chỉ cảnh báo), verify-cli (typecheck, test), e2e (needs contracts + frontend; Anvil loopback, `scripts/ci/prepare-chain.sh`, 4 bộ Playwright tách bước, upload artifact khi fail, retention 5 ngày). Action ghim SHA: checkout v7.0.1 `3d3c42e5`, setup-node v7.1.0 `949feb24`, upload-artifact v7.0.2 `cf430e03`, foundry-toolchain v1.9.2 `dba66c27`. Foundry v1.7.1, Node 24.19.0. Không secret, không RPC công khai, không deploy.
- `scripts/ci/prepare-chain.sh`: dựng chain theo lifecycle Phase 1 (deploy, seed, 4 ví delegate, mine 2, propose, vote 3 phiếu, qua deadline), kiểm proposal #1 Succeeded For 600.000 / Against 250.000 GOV; ký bằng `--unlocked`. Dùng chung CI và local (`RPC_URL`, `ENV_OUT`).
- Bằng chứng chạy thử: contracts, frontend, verify-cli PASS (lần trước, file không đổi); e2e validation 34/34, reliability 12/12, final UI 3/3, E2E gốc 12/12 = **61/61** trên Anvil 8547. actionlint 1.7.12 + shellcheck 0.11.0 sạch. RAM available thấp nhất 3.604 MiB.
- Lần chạy e2e đầu fail 5/12 vì chain chỉ delegate Bob/Charlie/David; đã thay bằng script lifecycle đầy đủ theo quyết định Owner, không sửa test hay app.
- LICENSE MIT (2026, Lê Tiến Mạnh); dòng tác giả + license ở cuối 2 README.
- Môi trường: WSL từng restart giữa lúc chạy thử CI (do tắt máy khi đang chạy, theo Owner); mất scratchpad và Anvil 8545. Log bền đặt ở `~/ci-dryrun/logs`. Máy không có `.wslconfig` (giới hạn RAM/CPU mặc định của WSL).
- Backlog frontend (để sau, chưa sửa): cổng "tạo proposal" dùng `getVotes(me)` (hiện tại) nhưng contract kiểm voting power ở `block.number - 1`, nên ngay sau delegate có thể bị revert khi mô phỏng. Đề xuất: phản chiếu đúng luật contract (`getPastVotes(me, block - 1)`) hoặc nhắc "đợi 1 block sau khi delegate".
- Kế tiếp cho Owner: tạo repo GitHub, push, xem Actions chạy thật (đặc biệt `forge snapshot --check` trên runner và thời gian job e2e).

## P4-A3 — README (EN + VI), 14/11/2026, Claude

- HEAD sau P4-A3: `f3650ad8754efde0805c4d7383555c5e5a6bf14e` (`docs: viết lại README (EN + VI)`). Commit docs chứa checkpoint này có hash riêng.
- Đã xong: `README.md` (tiếng Anh) thay README mẫu của Foundry; `README.vi.md` (tiếng Việt), cùng cấu trúc, link qua lại. Số liệu lấy từ PROGRESS, threat-model, phase2a/2b/3 report, foundry.toml/foundry.lock, package.json.
- Kiểm: 12/12 link tương đối mỗi file tồn tại; lệnh Quick start đối chiếu với script package.json, tên contract script Foundry và `--help` của forge/cast/anvil; quét không có `--private-key`, chuỗi 0x 64-hex, "audited"/"production-ready".
- Chưa xác minh: Mermaid chưa render thử (máy không có `mmdc`), chỉ kiểm cú pháp bằng mắt; cần xem trên GitHub sau khi push.
- Chờ Owner quyết: LICENSE (repo chưa có) và tên tác giả trong README (chưa ghi).
- Kế tiếp: C1/C2 CI (`.github/` đang untracked, chưa đụng). Chỉ làm khi Owner giao.

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

### PR-B / backlog polish — checkpoint 15/11/2026, Codex

- Nhánh `chore/p4-backlog-polish`, từ main `1e8b944`, độc lập PR-A; PR-A #3 đã xanh4/4 tại9fa2ffb: forge/snapshot54, Vitest173, CLI37, browser64; PR-B độc lập, không chứa guard của A. Không sửa src/script/test cũ hoặc dependency trong repo.
- **B1 đã được sửa sẵn trên main:** `frontend/e2e/01-wallet-states.spec.ts:86` lấy origin từ RPC_URL; helper đọc VITE_RPC_URL, mặc định127.0.0.1:8545. Không sửa lại test; proof riêng cổng8549 đã PASS **6/6** trong docs/p4-backlog-evidence/wallet-8549.log; Anvil đã tắt. Backlog cũ bên dưới đã lạc hậu.
- **B2 audit:** 76 PNG, 76 SHA256 khác nhau, không có nhóm trùng byte; 76/76 được manifest pin đúng hash. Không xóa ảnh hay sửa manifest. Inventory đầy đủ tại docs/p4-backlog-evidence/screenshot-audit.json; tên thư mục gần giống không đủ căn cứ xóa bằng chứng.
- **B3:** README EN/VI thể hiện Voter → frontend, MetaMask ký qua RPC ví và nguồn đọc cấu hình riêng → GovToken/GovVote; không đồng nhất RPC ví với frontend. Mermaid CLI12.0.0 (stable24/09, chỉ cài /tmp với ignore-scripts) render thành công cả 4 diagram, có SVG kiến trúc và summary. Thêm lưu ý verify64 confirmations ~13 phút, không bảo đảm finality.
- **B4 phân tích, không sửa:** getVotes tại B dự đoán txB+1 là đúng, nhưng simulation không đặt blockTag nên mặc định latestB; contract kiểm getPastVotes(B-1). Sau tăng quyền ở B có thể false-enable rồi simulation revert, Anvil cần block mới. Chỉ là UX, contract không bị bypass; chưa tái hiện bằng test mới. Đề xuất gate theo pastVotes(B-1)/nhắc chờ block, cần Owner duyệt PR riêng. Chi tiết docs/p4-backlog-review.md.
- **B5 spike /tmp:** wagmi3.7.9 + core3.6.7 + connectors8.2.2, stable21/10 đủ14ngày; audit27 (16high/11moderate) → **0**, cặp standalone cũng0. Không sửa source trong spike: typecheck, Vitest173, build PASS. API đang dùng chưa cần sửa qua các check này; browser v3/MetaMask/persistence thực chưa xác minh. Ước lượng1–2ngày cho PR nâng riêng và QA, không phải cam kết. Không đổi frontend/package*.json; summary và log tại docs/p4-backlog-evidence/.

- Kiểm PR-B trên code/main v2 không đổi: typecheck, build, format:check PASS, Vitest **173/173**, E2E01 **6/6** trên Anvil8549. Không test bị xóa/skip, không sửa src/script/frontend logic/test cũ/package*.json. CI sẽ chạy đủ64 browser; chưa xác minh tại checkpoint này. Commits B1 fea03f6, B2 3967023, B3 2f2aee6, B4 9f647a2 + abb07ec (đối chiếu tên lỗi), B5 7fb67ba; commit proof có hash riêng. Git status trước proof commit chỉ docs/PROGRESS.md và bằng chứng mới; không public RPC, không merge.

### Backlog đã ghi nhận, chưa triển khai

- B1 đã giải quyết trước PR-B: E2E01 dùng RPC_URL theo VITE_RPC_URL (default8545); không còn hardcode origin. Xem checkpoint PR-B và bằng chứng8549.
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

## PR-C / P4-E1 — hosting prep, checkpoint 15/11/2026, Codex

- Nhánh `feat/p4-e1-hosting-prep`, từ main **1e8b944**, độc lập PR-A/PR-B. Cả A/B chưa merge bởi AI; Owner merge A → B → C. PR-A #3 HEAD9fa2ffb xanh4/4 (forge/snapshot54, Vitest173, CLI37, browser64, e2e186s); PR-B #4 HEADd4df3ac xanh4/4 (forge/snapshot53, Vitest173, CLI37, browser64, e2e212s). Metadata bền tại docs/p4-e1-evidence/actions-pr-a.json và actions-pr-b.json; các checkpoint OPEN/CI pending cũ là lịch sử.
- **C1:** docs/hosting-cloudflare.md ghi root frontend, npm ci --ignore-scripts + build, output dist, Node24.19.0 theo CI và frontend/.node-version; env VITE chain/RPC/fallback/hai địa chỉ chỉ placeholder/công khai. Không tạo project, deploy hoặc gọi API Cloudflare; hướng dẫn Owner tự làm sau duyệt, chưa xác minh dashboard thật.
- **C2:** public/_headers template đóng mạng ngoài; plugin Vite sinh dist/_headers theo đúng origin primary/fallback build, bỏ path/query, chặn credentials/fragment/scheme khácHTTP(S), không wildcard. Script/style/font/img self, không inline/eval, frame-ancestors/object/base/form/media/worker none; nosniff/no-referrer/permissions. React bar dùng CSSOM qua policy style-src-attr none đã kiểm flow thực, không cần unsafe-inline.
- **C3:** không thêm _redirects vì App hash routing (fragment không gửi server), giữ tài nguyên JS/CSS; Pages có default SPA fallback khi không có404.html theo docs chính thức. Không bịa rule rewrite rộng.
- **C4:** vite preview phục vụ chính header artifact (preview mặc định bỏ qua _headers). Typecheck/format PASS; Vitest **177/177** (173+4); browser **66/66** trên Anvil8549 = validation34 + reliability12 + finalUI3 + defaultE2E17 (15cũ+2CSP). Các trang list/create/wallet/detail/verify ở375×812,768×1024,1280×800 không CSP violation, mock EIP-1193 hoạt động và strict VERIFIED. Probe âm riêng cố ý tạo hai violation cho inline script/origin loopback ngoài allowlist, không gọi mạng public. Anvil đã tắt sau test.
- **C5:** threat-model thêm hosting/CSP và giới hạn. Cloudflare dashboard/header CDN/domain/TLS, RPC public/CORS và MetaMask/mobile thật **chưa xác minh** (F1); CSP không bảo vệ khi bundle cùng origin hoặc RPC được phép bị chiếm/nói dối. Không deploy Sepolia/Cloudflare, không bắt đầu D2/D3; không sửa contract, script, spec, test cũ, dependency hoặc CI; label CI cũ ghi64 nhưng số thực sau thêm test là66.
- Bằng chứng local tại docs/p4-e1-evidence; CI của PR-C chưa xác minh tại commit checkpoint này, sẽ watch sau push. Git snapshot trước commit: branchC từ1e8b944, modified frontend/vite.config.ts và docs/threat-model.md, mới policy/public header/Nodepin/4unit/2browser/docs hosting/evidence; tất cả do phiên này tạo, không xóa/ghi đè thay đổi Owner.

## 3. Việc kế tiếp (theo thứ tự)

1. Bước 10 Phase 3: đã PASS. Không còn việc dở.
2. Mạnh xem lại `docs/phase3-frontend-report.md` và các ảnh trong `docs/phase3-screenshots/`.
3. Commit Phase 3, **chỉ khi Mạnh xác nhận**: stage đúng từng file trong `frontend/`, `docs/phase3-*`. Commit 3 file của phiên này nếu Mạnh muốn.
4. Phase 4 (chưa bắt đầu):
   - Deploy Sepolia bằng keystore (`cast wallet`), ví deployer riêng.
   - Verify source trên Etherscan.
   - GitHub Actions CI: forge fmt/build/test, `forge snapshot --check --fuzz-seed 0x1 --threads 1`, frontend typecheck/test/build, E2E với Anvil. Cùng seed, số luồng, Foundry 1.7.1/solc 0.8.28; chỉ snapshot ghim seed/luồng, `forge test` vẫn fuzz ngẫu nhiên.
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
| `forge snapshot --check` (lệnh lịch sử, trước khi ghim seed/luồng cho CI) | exit 0 |
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
