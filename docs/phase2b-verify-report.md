# Phase 2B: script đối chiếu VoteCast với storage

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
