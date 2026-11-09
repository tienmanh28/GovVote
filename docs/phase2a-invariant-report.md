# Phase 2A: báo cáo fuzz và invariant

## Phạm vi

- **Fuzz** ([test/GovVoteFuzz.t.sol](../test/GovVoteFuzz.t.sol)): `testFuzz_WeightEqualsPastVotes`, `testFuzz_ThresholdBoundary`, `testFuzz_TallyNeverExceedsSupply`.
- **Invariant** ([test/GovVoteInvariant.t.sol](../test/GovVoteInvariant.t.sol)): I1–I6 theo đặc tả mục 4.3.
  - Mỗi invariant bật `fail-on-revert = true`.
  - `GovVoteHandler` có 7 hành động: propose, proposeBelowThreshold, delegate, transfer, vote, voteRejected, roll. Handler có ghost state để đối chiếu và có counter đo độ phủ (coverage).
  - Smoke test `test_HandlerReachesKeyPaths` (test nhanh kiểm tra handler chạy được các nhánh) đi qua Pending → Active → Succeeded.
  - Cấu hình test: DELAY = 5, PERIOD = 20.
- **Cấu hình**: dùng `foundry.toml` hiện tại, không đổi. Fuzz `runs = 1000`. Invariant `runs = 256`, `depth = 50`.

## Kết quả

| Nhóm | Kết quả |
|---|---|
| 3 fuzz test | PASS, mỗi test 1000 runs |
| I1–I6 | PASS, mỗi invariant 256 runs, 12.800 calls, 0 reverts |
| Smoke test | PASS |
| Toàn bộ `forge test` | 53/53 pass. `forge fmt --check` exit 0 |

## Kiểm chứng fail-on-revert

Thử đổi tạm `propose` trong handler thành title rỗng. Lời gọi đó revert `EmptyTitle()` (selector `0xa5bb9bde`), là một revert ngoài dự kiến.

Kết quả: **cả 6 invariant FAIL**. Forge thu gọn chuỗi lời gọi về 2 bước (`roll`, `propose`). Vậy cấu hình có hiệu lực. Sau đó đã khôi phục file, sha256 khớp bản gốc.

## Giới hạn độ phủ

Đo trên 40 seed (`--fuzz-seed 1..40`). Mỗi seed lấy run cuối của `invariant_I1` (depth 50).

| Chỉ số | Kết quả |
|---|---|
| Proposal được tạo | 187, trung bình 4,67/run, mọi run đều có ít nhất 1 proposal |
| Run có ≥ 1 phiếu được chấp nhận | 35/40 = **87,5%** |
| Run có ≥ 1 Succeeded | 10/40 = **25%** |
| Run có ≥ 1 Defeated có phiếu | 13/40 = **32,5%** |

Đã chạy 1 vòng đo baseline và 2 vòng chỉnh handler:
1. (Đo) Đo baseline bằng counter.
2. (Chỉnh) Cho `vote()` chỉ chọn proposal đang Active.
3. (Chỉnh) Tăng tỷ lệ `roll` từ 1/7 lên 3/9.

Các ngưỡng đặt trước (≥ 80% / ≥ 50% / ≥ 50%) **không đạt**. Vòng 3 làm tụt tỷ lệ run có phiếu xuống 70%, nên **giữ phiên bản sau vòng 2** (bản E), vì bản này có độ phủ phiếu tốt hơn.

**Nguyên nhân.** 50 lời gọi tương ứng khoảng 45 block (ước tính: khoảng 1/7 số lời gọi là `roll`, trung bình 6,5 block mỗi lần). Trong khi đó, một proposal cần 25 block (5 + 20) mới có kết quả.
- Khoảng 50% lời gọi `vote()` rơi vào lúc không có proposal nào đang Active.
- Tăng `roll` thì lại bớt lời gọi `vote`.

Các nhánh kết quả được kiểm bằng **unit test xác định** (deterministic: đầu vào cố định, luôn cho cùng kết quả) trong [test/GovVote.t.sol](../test/GovVote.t.sol): `test_SucceedsWhenQuorumMet`, `test_DefeatedOnTie`, `test_DefeatedWhenAgainstWins`, `test_DefeatedWhenQuorumNotMet`, `test_DefeatedWhenForOnlyBelowQuorum`.

## Nhận định

Invariant kiểm tra **tính đúng trên diện rộng**: tally, ghost, một phiếu cho mỗi voter, đóng băng sau deadline, và điều kiện Succeeded, qua hàng nghìn chuỗi hành động ngẫu nhiên. Nhưng nó **không chứng minh độ phủ đầy đủ** mọi nhánh kết quả. Nhánh Succeeded và nhánh "có phiếu nhưng rớt" xuất hiện trong ít hơn 1/3 số run.

## Hướng sau (chưa làm)

- Thêm profile sâu trong `foundry.toml`, ví dụ `[profile.deep]` với `depth = 200`, rồi chạy `FOUNDRY_PROFILE=deep forge test`. Không đổi cấu hình mặc định.
- Cân nhắc đưa profile `deep` vào CI ở Phase 4.
