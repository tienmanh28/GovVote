# Phase 2B: script đối chiếu VoteCast với storage

## P3-FIX-03B — strict verification (14/11/2026)

**PASS_CANDIDATE, chờ Mạnh/ChatGPT nghiệm thu.** Phần báo cáo Phase 2B bên dưới là lịch sử của verifier tally. Manifest hash cũ không áp dụng cho entry point main.ts mới và không phải chứng nhận strict verifier.

### Kiến trúc và chế độ CLI

- Core thuần TypeScript: `shared/verification/core.ts`; runner và HTTP read-only dùng Web APIs chuẩn: `runner.ts`, `http.ts`. Core không import React/Node/viem.
- CLI codec dùng viem 2.57.11 đã pin; browser codec dùng viem 2.57.13 đã pin. Cả hai dùng ABI generated trong frontend/src/abi, chỉ import data; CLI runtime không cần cài dependency frontend. Fixtures test của CLI dùng viem riêng của CLI.
- Có GOV_PROPOSAL_ID: main.ts chạy strict verifier một proposal. Không có: chuyển sang legacy-main.ts và in rõ `LEGACY TALLY ONLY`; hành vi tally cũ giữ nguyên, không coi đó là đủ mục 4.5. Lỗi transport/config không echo dữ liệu có thể nhạy cảm.

Từ scripts/verify (Node Linux trên PATH):

```bash
GOV_VOTE=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
GOV_TOKEN=0x5FbDB2315678afecb367f032d93F642f64180aa3 \
GOV_PROPOSAL_ID=1 GOV_CONFIRMATIONS=12 npm run verify
```

Địa chỉ chỉ đúng với deployment local hiện tại; kiểm tra lại khi chain thay đổi. Không yêu cầu private key.

| Biến | Ý nghĩa/default |
|---|---|
| GOV_VOTE | GovVote bắt buộc |
| GOV_TOKEN | Token expected tùy chọn; nếu có phải khớp GovVote.token() |
| GOV_PROPOSAL_ID | ID dương uint256; có giá trị để chọn strict mode |
| GOV_RPC_URL | http://127.0.0.1:8545; output chỉ origin, ẩn credentials/path/query |
| GOV_CONFIRMATIONS | 12, số nguyên >=1; H=latest−C |
| GOV_VERIFY_MAX_REQUESTS | 200, tính cả retry và kiểm context |
| GOV_VERIFY_MAX_LOGS | 50000, gồm ProposalCreated và mọi bản sao log nhận được |
| GOV_VERIFY_MAX_MS | 60000 |
| GOV_VERIFY_RANGE | 10000 block, cấu hình 1..10000 |
| GOV_VERIFY_RETRIES | 1 retry/request; cấu hình 0..3 |
| GOV_VERIFY_TIMEOUT_MS | 8000/request; còn bị chặn bởi ngân sách thời gian chung |

Ngân sách phải là số nguyên hữu hạn hợp lệ. Requests thực hiện tuần tự, retry nằm trong tổng maxRequests; timeout/cancel dùng AbortController. Không tạo toàn bộ mảng windows cho lịch sử dài. Quá ngân sách trả INCOMPLETE.

| Exit strict | Verdict |
|---|---|
| 0 | VERIFIED |
| 1 | MISMATCH |
| 3 | INCOMPLETE |
| 2 | RPC_ERROR hoặc INVALID_INPUT |

Legacy giữ 0/1/2 như trước. IDLE/RUNNING chỉ là lifecycle UI, không phải kết quả CLI hoàn tất.

### Điều kiện strict VERIFIED

Đúng chain/address, có code GovVote/token; proposal tại H; ProposalCreated khớp proposer/title/mốc block/createdBlock/config delay-period và block hash; VoteCast đúng address/id/voting window, metadata hợp lệ, dedupe bản sao trước khi kiểm voter trùng. Quét đủ mọi range tới H; không default missing storage bằng 0. Tally tính bằng bigint, quorum ceil(supply lịch sử*bps/10000); expected state dùng tally từ event và đúng boundary Solidity; đối chiếu storage/quorum/state. Hash H phải giữ nguyên ở đầu/cuối lần chạy.

Snapshot chưa hoàn tất => INCOMPLETE. Active sau snapshot có thể VERIFIED tại H nhưng kết quả biểu quyết chưa cuối cùng. RPC đọc lỗi => RPC_ERROR, không phải MISMATCH. Thiếu range/evidence hoặc malformed logs => không VERIFIED. Tally lệch do RPC trả thiếu log là MISMATCH quan sát được, chưa kết luận gian lận.

### Bằng chứng

- CLI tests: 17/17 PASS (9 legacy không đổi + 8 strict mới). Lệnh đã chạy: `node --import tsx --test --test-isolation=none test/verify.test.ts test/strict.test.ts`. tsx CLI ban đầu bị sandbox chặn IPC; loader Node và quyền cho fixture localhost dùng để chạy rõ từng case. Không sửa test legacy hoặc dependency.
- Frontend Vitest: 127/127 PASS, gồm 60 test mới core/runner/route. Typecheck cả CLI/frontend exit 0.
- HTTP fixture CLI kiểm thật entry point, output và exit 0/1/3/2; một lỗi ban đầu ở fixture echo response ID cố định đã sửa để echo đúng ID, không nới assertion.
- Anvil read-only proposal #1: VERIFIED, latest 7261/H7249, 3 VoteCast, For 600000/Against250000 GOV, participation850000 GOV, quorum100000 GOV, expected/contract state Succeeded. 18 requests, 4 logs gồm ProposalCreated. Latest sau khi đọc vẫn7261. JSON đầy đủ: docs/phase3-verification-evidence.json.
- Hash H: `0x5d47b51cfd5f8dc19b9d41a1d2555016ee3f01ff61c2236321131ffd12dce90d`.

### Giới hạn

Đây là ON-CHAIN CONSISTENCY trong phạm vi RPC và deployment local tin cậy, không phải source-verified trên Etherscan hoặc audit. Bytecode tồn tại + ABI/event evidence không phải chứng minh bytecode chính xác tương đương source. Không đối chiếu từng weight với getPastVotes (bước tùy chọn trong đặc tả); không thêm RPC thứ hai hoặc fallback. RPC sai cả logs/storage nhất quán có thể không bị phát hiện. Confirmations không bảo đảm finality tuyệt đối; không liên tục giám sát reorg sau khi verdict đã hiển thị. Giới hạn logs được kiểm sau khi nhận JSON; không có giới hạn streaming payload bytes. Vượt ngân sách không được gọi là VERIFIED.

---


## Mục đích

Script [scripts/verify/](../scripts/verify/) đối chiếu tổng phiếu tính từ event `VoteCast` trên chain với `forVotes` / `againstVotes` trong storage của GovVote. Cả hai nguồn được đọc **tại cùng một block**.

Script chỉ đọc qua RPC: không dùng ví, không dùng private key, không gửi giao dịch.

## Cách hoạt động

1. Lấy `head = latest − 12`, tức chờ 12 block xác nhận (confirmation). Nếu `head < 1` thì dừng.
2. Đọc `proposalCount` và `getProposal(1..count)` với `blockNumber = head`.
3. Đọc log `VoteCast` từ block 0 tới `head`. Mỗi lần đọc một cửa sổ tối đa 10.000 block, các cửa sổ không chồng lấn: `[s, s+9999]`, `[s+10000, s+19999]`, … Hàm ném lỗi nếu `from > to` hoặc `size < 1`.
4. Bỏ log có `blockNumber > head`, khử trùng theo `transactionHash:logIndex`, cộng For/Against theo id, rồi so với storage.
   - Một id nằm ngoài `1..count` mà có phiếu trong log thì tính là MISMATCH.
   - Hai log cùng khóa nhưng nội dung khác nhau thì ném lỗi.

```
GOV_RPC_URL, GOV_VOTE ─► chainId == 31337? ─► head = latest − 12 ─► getCode(GOV_VOTE) @head
                                                       │
            ┌──────────────────────────────────────────┴──────────────────────────┐
  proposalCount, getProposal(1..count) @head               getLogs VoteCast [0, head], cửa sổ 10.000
            │                                                                      │
            └────────► compareWithChain ◄── aggregateVotes (lọc > head, khử trùng) ┘
                              │
                 bảng từng proposal + VERIFIED / MISMATCH
```

Code tách thành hai lớp:
- **Hàm thuần** (pure function, không gọi RPC), dễ test: `aggregateVotes`, `compareWithChain` (trong `src/verify.ts`) và `blockWindows` (trong `src/fetch.ts`).
- **Phần đọc RPC**: `fetchVoteLogs` (trong `src/fetch.ts`) và `main` (trong `src/main.ts`).

## Cấu hình và exit code

| Biến môi trường | Ý nghĩa |
|---|---|
| `GOV_RPC_URL` | RPC endpoint, mặc định `http://127.0.0.1:8545` |
| `GOV_VOTE` | Địa chỉ GovVote. Bắt buộc, không có mặc định |

Script chỉ chạy khi chainId là 31337 (Anvil). Gặp chainId khác thì thoát với exit 2.

| Exit | Nghĩa | Đã quan sát |
|---|---|---|
| 0 | VERIFIED | Có (chạy thật trên Anvil) |
| 1 | MISMATCH | Chưa. Đây là hành vi theo code. Trên chain thật chưa có dữ liệu lệch để thử |
| 2 | Lỗi cấu hình hoặc RPC | Có (2 ca lỗi cấu hình, xem bên dưới) |

## Phiên bản đã pin

Các gói được pin đúng phiên bản (không có `^` hay `~`) và có `package-lock.json`:
- viem `2.57.11`
- tsx `4.23.15`
- typescript `7.0.2`
- @types/node `24.19.2`

Gói được cài với `--ignore-scripts`, nghĩa là không chạy script tự động của các gói khi cài.

## Kiểm thử (node:test, dữ liệu tổng hợp, không cần chain)

`npm test`: **9/9 pass**. `npm run typecheck`: exit 0.

| Ca | Nội dung |
|---|---|
| (a) | Log hợp lệ, không trùng → VERIFIED |
| (b) | Log trùng y hệt (kể cả hash viết hoa) → VERIFIED, mỗi phiếu chỉ được cộng một lần |
| (c) | Sửa weight một log (+1 wei) → MISMATCH, đúng id bị sửa |
| (d) | Thiếu một log → MISMATCH |
| (e) | Log có `blockNumber > head` bị bỏ qua → VERIFIED. Log ở đúng `head` vẫn được tính |
| (f) | Cùng khóa `transactionHash:logIndex` nhưng nội dung khác → `aggregateVotes` ném lỗi |
| (g) | Có phiếu cho id ngoài `1..proposalCount` → MISMATCH |
| (h) | Proposal không có phiếu ở cả hai phía → VERIFIED, For = 0, Against = 0 |
| (i) | `blockWindows`: các cửa sổ liền nhau, không hở, không chồng lấn. `from > to` và `size < 1` ném lỗi |

**Mutation test** (cố ý làm hỏng code để xem test có phát hiện không):
- Tạm xóa lệnh `continue` dùng để bỏ qua bản trùng trong `aggregateVotes`.
- Kết quả: chỉ ca (b) FAIL. For tính từ log thành 1.400.000 GOV thay vì 600.000 GOV, **lệch 800.000 GOV**, đúng bằng 2 bản trùng × 400.000.
- Đã khôi phục file, `sha256sum` khớp bản gốc, chạy lại 9/9 pass.

## Chạy thật trên Anvil

Chạy với GovVote `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` (deploy của Phase 1).
- Kết quả: `latest / head = 7234 / 7222`, `proposalCount = 1`, đọc được **3 log VoteCast**.
- Proposal 1 khớp **600.000 / 250.000 GOV** ở cả phía log lẫn phía chain → **VERIFIED, exit 0**.
- Ca lỗi cấu hình:
  - Không đặt `GOV_VOTE` → exit 2.
  - `GOV_VOTE = 0x…dEaD` (không có bytecode) → exit 2.
- Block trước và sau khi chạy đều là 7234, tức script không ghi gì lên chain.

**Tamper test trong bộ nhớ** (script nháp, không nằm trong repo):
- Đọc log thật, rồi trên một bản sao tăng weight của một log For (Alice, block 35) thêm 1 wei.
- Kết quả: **MISMATCH**, chỉ id 1 lệch, For lệch đúng **1 wei**, Against lệch 0.
- Đối chứng với log gốc, cùng dữ liệu on-chain, cùng `head`: **VERIFIED**.

## Giới hạn

- **Script tin vào RPC.** Nếu RPC bỏ sót log, script chỉ phát hiện được nhờ storage vẫn đếm phiếu đó (ca (d)). Log và storage đều đi qua cùng một RPC. Nếu RPC trả sai cả hai một cách nhất quán, script không phát hiện được.
- **Chỉ đối chiếu tally với event.** Script chưa đối chiếu weight với `getPastVotes(voter, snapshot)`. Việc đó thuộc về test Foundry: `testFuzz_WeightEqualsPastVotes` ở Phase 2A, test này so `weight` trong `VoteCast` với `token.getPastVotes`. Đây là bước kiểm tra tally, chưa phải bước kiểm tra weight.
- **Chỉ chạy trên Anvil local.** Lifecycle của Phase 1 được tạo bằng `anvil_mine`, không chạy theo thời gian thực. Chưa chạy trên Sepolia.
- **12 block xác nhận chỉ có ý nghĩa trên chain thật.** Anvil không có reorg (chain thay các block mới nhất bằng một nhánh khác).
- **Tamper test chỉ sửa dữ liệu trong bộ nhớ.** Nó không phải tấn công thật lên chain.
- **Trạng thái Anvil mất khi tắt Anvil.** Sau khi khởi động lại Anvil, phải chạy lại phần deploy và lifecycle của Phase 1 (xem `docs/phase1-demo-report.md`). Khi đó địa chỉ `GOV_VOTE` có thể khác.

## Cách chạy lại

```bash
cd scripts/verify
npm ci --ignore-scripts          # cài đúng phiên bản trong package-lock.json
npm test                         # kỳ vọng 9/9 pass
npm run typecheck                # kỳ vọng exit 0
GOV_VOTE=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 npm run verify; echo "exit $?"
```

**Manifest sha256** của code lúc viết báo cáo. Lưu khối dưới đây vào một file ngoài repo, ví dụ `/tmp/verify-manifest.sha256`, rồi chạy `cd scripts/verify && sha256sum -c /tmp/verify-manifest.sha256`. Kỳ vọng 5 dòng OK.

```
7aab7341a7711d959b28e361b8a471830827fd70dcae241bc5e5838094d6c882  src/abi.ts
db4b14f635781231b2a64f6ffeab5b547d9e027a5220f55f1c911b9d56d48fb5  src/fetch.ts
116f83209b1e770522efeb769b1def3da18f522b5f53c7c02919355be31e1957  src/main.ts
194fad04832580e88728460c917f356f3050468bbed4cf35b88a984a739208b1  src/verify.ts
782c1cd61ce18edd65b12b754cedb49e6540c37bf4ed35cc149872a4a55f23bf  test/verify.test.ts
```
