# GovVote v1.1: Architecture Decision Records (ADR)

ADR (bản ghi quyết định kiến trúc) ghi lại các quyết định có trade-off mà đặc tả mục 3.7 yêu cầu phải ghi.

GovVote không có owner và cấu hình là immutable. Vì vậy, thay đổi bất kỳ ADR nào đều có nghĩa là **deploy một phiên bản mới**, giữ bản cũ để kiểm chứng lịch sử, và thông báo địa chỉ mới (mục 3.7).

Đặc tả gốc là `docs/GovVote_Thiet_ke_v1.1.pdf`. Trích dẫn trong tài liệu này ghi theo số mục.

---

## ADR 1: Quorum tính For + Against

- **Trạng thái:** Đã chấp nhận (v1.1).
- **Bối cảnh:** Quorum dùng để đo mức tham gia, tức có đủ người quan tâm hay không. v1.1 chỉ có hai lựa chọn For và Against, không có Abstain (bảng "Các quyết định đã chốt" và mục 2.5).
- **Quyết định:**
  - `quorumVotes = ⌈getPastTotalSupply(snapshot) × quorumBps / 10.000⌉`. Làm tròn lên bằng `Math.mulDiv(..., Ceil)` để ngưỡng không thấp hơn tỷ lệ chỉ vì phép chia nguyên.
  - `participation = forVotes + againstVotes`.
  - Succeeded khi và chỉ khi `participation ≥ quorumVotes` **và** `forVotes > againstVotes` (mục 2.5 và 3.6).
- **Phương án bị loại:**
  - Mô hình For + Abstain để tính quorum, giống `GovernorCountingSimple` của OpenZeppelin (mục 2.5).
  - Abstain và các kiểu phiếu khác được hoãn sang v2 (mục 1.2). Nếu sau này thêm Abstain, phải quyết định riêng cách tính quorum, không được lặng lẽ đổi từ For+Against sang For+Abstain (mục 7.3).
- **Hệ quả:**
  - Phiếu Against có thể giúp proposal đạt quorum. Ví dụ: 60.000 For + 0 Against thì không đạt, nhưng thêm 40.000 Against thì đạt và For vẫn thắng. Điều này được chấp nhận có chủ đích (mục 2.5).
  - Hòa phiếu thì Defeated.
  - GOV chưa delegate vẫn nằm trong mẫu số, nên quorum có thể khó đạt (mục 2.5).
  - Đổi chính sách thì cần một ADR mới và test lại (mục 2.5).
- **Test:** `test_SucceedsWhenQuorumMet`, `test_DefeatedWhenQuorumNotMet`, `test_DefeatedWhenForOnlyBelowQuorum`, `test_DefeatedOnTie`, `test_DefeatedWhenAgainstWins`, `test_QuorumRoundsUp`, `test_UndelegatedSupplyRaisesQuorumBar`, `invariant_I6_SucceededImpliesQuorumAndMajority`.
- **Tham chiếu đặc tả:** bảng quyết định đã chốt, mục 1.2, 2.5, 3.6, 7.3.

---

## ADR 2: Snapshot và clock theo block number

- **Trạng thái:** Đã chấp nhận (v1.1).
- **Bối cảnh:**
  - Thiết kế cũ trộn `snapshotBlock` với `endTime` kiểu timestamp (mục 2.3).
  - ERC20Votes của OpenZeppelin mặc định dùng clock theo block number. ERC-6372 là chuẩn mô tả contract dùng loại clock nào.
  - `getPastVotes` chỉ trả lời được cho block đã kết thúc (mục 2.3).
- **Quyết định:**
  - Mọi mốc thời gian đều tính theo `block.number`: `snapshotBlock = B + votingDelayBlocks` và `deadlineBlock = snapshotBlock + votingPeriodBlocks`.
  - Proposal ở trạng thái Pending khi `N ≤ snapshotBlock`, và Active khi `snapshotBlock < N ≤ deadlineBlock`.
  - Ngưỡng tạo proposal đọc ở `B − 1` (mục 2.2 và 3.4).
  - GovToken không override clock (mục 3.2).
- **Phương án bị loại:**
  - Trộn block với timestamp (mục 2.3).
  - Clock theo timestamp. Nếu sau này cần, phải đổi clock của **cả** token lẫn GovVote theo ERC-6372, không được đổi một nửa (mục 2.3).
- **Hệ quả:**
  - 7.200 block chỉ **ước tính** khoảng 1 ngày nếu mỗi block cách nhau 12 giây. UI phải hiển thị block mục tiêu và ghi rõ thời gian là ước tính (mục 2.3).
  - Active bắt đầu từ `snapshotBlock + 1`.
  - Snapshot cố định weight sau thời điểm chốt, nhưng không chặn được việc mua hoặc vay GOV trước snapshot (mục 2.4, xem `docs/threat-model.md`).
  - Theo quyết định trong quá trình review Phase 1, constructor kiểm tra thêm `votingDelayBlocks + votingPeriodBlocks ≤ uint48.max`. Lý do: clock của ERC-6372 là `uint48`. Nếu vượt giới hạn này, mọi lời gọi `getPastVotes` sẽ revert và proposal không bao giờ vote được.
- **Test:** `test_PendingAtSnapshotBlock`, `test_ActiveAfterSnapshotBlock`, `test_ActiveAtDeadlineBlock`, `test_RevertAfterDeadlineBlock`, `test_ThresholdReadsPreviousBlock`, `test_DelegateBeforeSnapshotCounts`, `test_RevertWhenVotingWindowExceedsUint48`, `testFuzz_WeightEqualsPastVotes`.
- **Tham chiếu đặc tả:** bảng quyết định đã chốt, mục 2.2, 2.3, 2.4, 3.2, 3.4.

---

## ADR 3: Không có execute, treasury, timelock trong v1.1

- **Trạng thái:** Đã chấp nhận (v1.1).
- **Bối cảnh:**
  - v1.1 là dự án học tập và portfolio.
  - Cho phép thực thi (execute) đồng nghĩa với việc contract chuyển giá trị hoặc gọi contract khác. Khi đó phải review lại CEI (thứ tự Checks-Effects-Interactions), quyền gọi, reentrancy và các mục tiêu tấn công (mục 3.5).
  - Đặc tả ưu tiên giảm rủi ro và tránh phình phạm vi (bảng quyết định đã chốt).
- **Quyết định:**
  - Proposal chỉ có 4 trạng thái: Pending, Active, Succeeded, Defeated. Không có Executed.
  - Succeeded chỉ là tín hiệu biểu quyết. Proposal không tự chuyển tiền (mục 1.1).
  - Sản phẩm được gọi là "DAO Voting DApp", không phải DAO tự động thực thi (bảng quyết định đã chốt).
- **Phương án bị loại / hoãn:**
  - Treasury, execution, timelock, gasless flows được hoãn sang v2 (mục 1.2).
  - Ở v2, chỉ thêm timelock, treasury và execute khi có threat model mới và có test cho quyền thực thi nhiều bước (mục 7.3).
  - Ở v2, nghiên cứu `Governor`, `GovernorVotes`, `GovernorCountingSimple`, `GovernorVotesQuorumFraction` của OpenZeppelin thay vì tự mở rộng mãi (mục 7.3).
- **Hệ quả:**
  - Bề mặt tấn công nhỏ: không có lời gọi chuyển ETH hay token sau khi ghi state (mục 3.5).
  - Kết quả không được thực thi on-chain. Việc làm theo kết quả cần tin vào một bên off-chain.
- **Test:** không có test cho tính năng "không tồn tại". Trạng thái cuối chỉ là Succeeded hoặc Defeated, đã kiểm bởi `invariant_I6_SucceededImpliesQuorumAndMajority` và `test_FullLifecycle`.
- **Tham chiếu đặc tả:** bảng quyết định đã chốt, mục 1.1, 1.2, 3.5, 7.3.

---

## ADR 4: Title và description lưu on-chain

- **Trạng thái:** Đã chấp nhận (v1.1).
- **Bối cảnh (SUY LUẬN CỦA NGƯỜI VIẾT ADR, không có trong đặc tả):** Đặc tả quy định title và description nằm trong struct `Proposal` (mục 2.2 và 3.3), nhưng **không nêu lý do** chọn lưu on-chain. Người viết ADR suy luận các lý do sau:
  - v1.1 tự chứa: nội dung proposal đọc được trực tiếp từ contract qua cùng RPC dùng để vote, không phụ thuộc IPFS, pinning hay gateway.
  - Frontend và script verify đơn giản hơn, vì không cần lấy và xác minh CID.
  - Phù hợp quy tắc giữ phạm vi v1.1 nhỏ.
- **Quyết định (theo đặc tả mục 2.2 và 3.3):**
  - `title` dài 1–100 byte UTF-8, không rỗng. `description` tối đa 1.000 byte UTF-8 (mục 2.2).
  - Cả hai lưu trong storage, trong struct `Proposal` (mục 3.3).
  - Event `ProposalCreated` phát kèm `title` (mục 3.3).
- **Phương án bị loại / hoãn (theo đặc tả):**
  - Mô tả dài trên IPFS/Pinata được hoãn sang v2 (mục 1.2).
  - Lợi ích của IPFS mà đặc tả nêu: giảm gas cho mô tả dài, kèm cơ chế xác minh CID (mục 7.3).
- **Lý do (SUY LUẬN CỦA NGƯỜI VIẾT ADR):** Với giới hạn 1.000 byte, chi phí gas chấp nhận được trong môi trường demo. Đổi lại, không phải thêm một hệ thống lưu trữ ngoài cùng các rủi ro của nó: nội dung bị mất pin, hoặc CID không khớp nội dung.
- **Hệ quả:**
  - Gas tăng theo độ dài văn bản. Số đo bằng `forge test --gas-report`: `propose` có median 213.445 gas, max 916.735 gas (ca description dài 1.000 byte).
  - Giới hạn tính theo **byte**, không theo ký tự. Tiếng Việt có dấu tốn nhiều byte cho mỗi ký tự trong UTF-8, nên số ký tự tối đa ít hơn 100 / 1.000.
  - Giới hạn văn bản cũng góp phần hạn chế spam (mục 2.2).
  - Nội dung công khai và không sửa được sau khi tạo (suy luận từ việc không có hàm sửa).
- **Test:** `test_RevertWhenTitleInvalid`, `test_RevertWhenDescriptionTooLong`, `test_GetProposalStoresFields`, `test_ProposalCreatedEmitsSnapshotAndDeadline`.
- **Tham chiếu đặc tả:** mục 1.2, 2.2, 3.3, 7.3.

---

## ADR 5: Tổng cung bất biến, mint một lần

- **Trạng thái:** Đã chấp nhận (v1.1).
- **Bối cảnh:** Quorum là tỷ lệ trên tổng cung tại snapshot (mục 2.5). Đặc tả quy định không có mint sau deploy (bảng quyết định đã chốt, mục 2.1). Lý do sau đây là suy luận của người viết ADR, không có trong đặc tả: nếu có ai đó mint được sau deploy, người đó có thể thay đổi cả phân phối quyền vote lẫn mẫu số của quorum.
- **Quyết định:**
  - 1.000.000 GOV (18 decimals) được mint đúng một lần trong constructor, cho một địa chỉ nhận được truyền vào rõ ràng, không tự suy từ `msg.sender` của script (mục 2.1; 18 decimals: mục 3.2).
  - Không có public mint, pause, blacklist hoặc upgrade (mục 3.2). Theo code `src/GovToken.sol`, token cũng không có burn hay owner.
  - GovVote vẫn đọc `getPastTotalSupply(snapshot)` chứ không hardcode tổng cung (mục 3.6).
- **Phương án bị loại / hoãn:**
  - Public mint, pause, blacklist, upgrade (mục 3.2).
  - Tokenomics và phân phối thật được hoãn sang v2 (mục 1.2).
- **Hệ quả:**
  - Phân phối lúc deploy quyết định quyền lực lâu dài. Vì vậy không được gọi hệ thống là "phi tập trung hoàn toàn" (mục 3.7).
  - Muốn test trường hợp tổng cung thay đổi thì phải dùng mock `IVotes` có mint, và mock đó chỉ nằm trong test (mục 4.2, `test/mocks/MockVotes.sol`).
  - UI có thể hiển thị quorum ước tính trong lúc Pending nhờ tổng cung cố định (mục 3.6).
- **Test:** `test_TotalSupplyFixed`, `test_QuorumUsesSnapshotSupply`, `test_QuorumRoundsUp`, `invariant_I1_TallyWithinSnapshotSupply`.
- **Tham chiếu đặc tả:** bảng quyết định đã chốt, mục 1.2, 2.1, 2.5, 3.2, 3.6, 3.7, 4.2.

---

**Ghi chú kiểm chứng (sửa lại 14/11/2026):** cả `forge test` lẫn `forge snapshot` đều không cố định seed fuzz mặc định. Hai lần Actions đầu tiên cho thấy ghim seed thôi chưa đủ: fuzz chạy song song nên gas (μ, ~) phụ thuộc cả seed lẫn số luồng. Tạo `.gas-snapshot` bằng `forge snapshot --fuzz-seed 0x1 --threads 1`, kiểm bằng `forge snapshot --check --fuzz-seed 0x1 --threads 1`. Chỉ so sánh khi cùng seed, số luồng, Foundry 1.7.1 và solc 0.8.28; số gas chỉ phản ánh tập đầu vào của cấu hình đó. Seed và luồng chỉ ghim cho bước snapshot; `forge test` vẫn fuzz ngẫu nhiên.
