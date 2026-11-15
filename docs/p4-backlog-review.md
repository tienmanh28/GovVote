# PR-B — rà backlog, chỉ phân tích

Base main `1e8b944`; không sửa src, script hoặc logic frontend. B1 đã được giải quyết trước PR này: E2E01 đọc origin qua RPC_URL, helper lấy VITE_RPC_URL với mặc định8545. B2: 76PNG có 76SHA256 khác nhau và đều hash-pin đúng trong manifest; không có bản trùng byte hợp lệ để xóa. Xem inventory trong p4-backlog-evidence.

## B4 — ngưỡng tạo proposal và thời điểm mô phỏng

Đây là **quyền tạo proposal**, không phải weight khi bỏ phiếu. `frontend/src/pages/CreateProposal.tsx:58` đọc getVotes(ví) tại block B; điều kiện enoughPower so với proposalThreshold và nhãn UI dự đoán giao dịch sẽ vào B+1. Dự đoán đó hợp lý nếu thực sự vào block kế: contract kiểm getPastVotes(proposer, (B+1)-1).

Tuy nhiên `simulateContract` ở cùng trang không đặt blockNumber/blockTag. Mã viem được khóa phiên bản (`actions/public/call.ts`) chọn client.experimental_blockTag hoặc **latest**; ứng dụng không cấu hình pending. Khi simulation vẫn ở B, `src/GovVote.sol:186` kiểm getPastVotes(proposer,B-1). Nếu quyền vừa tăng ở B (delegate/nhận delegation/chuyển token có votes), UI có thể bật gửi vì getVotes(B) đủ nhưng simulation latest(B) vẫn revert BelowThreshold. Nếu chain đã tăng trước simulation, điều kiện có thể thỏa. Chưa xác minh bằng ca browser tái hiện mới ở PR-B, đây là kết luận từ mã và default của dependency hiện hành.

Mức ảnh hưởng: lỗi UX theo thời điểm, không bypass an toàn contract. Trên Anvil auto-mine nhưng chưa có giao dịch mới, block không tự tăng nên người dùng có thể bị kẹt cho tới block mới; public testnet thường có block kế nhưng thời gian thực chưa kiểm. Đọc cache giữa hai block cũng có thể khiến trạng thái nút tạm lệch quyền; contract vẫn là nguồn quyết định cuối.

Đề xuất cho PR riêng cần Owner duyệt: đọc bổ sung getPastVotes(ví,B-1) cho gate phù hợp simulation latest, giải thích rõ chờ một block sau khi vừa nhận quyền; hoặc giữ dự đoán B+1 nhưng phân biệt trạng thái chưa qua simulation và hướng dẫn chờ block mới. Cần test biên delegate tại B, quyền ở B-1/B, rồi simulation ở B/B+1 và reorg/cache scope. Không tự dùng pending trên mọi RPC (ngữ nghĩa/hỗ trợ chưa xác minh), không retry test hoặc tự ký lại giao dịch. **PR-B không sửa logic này.**
