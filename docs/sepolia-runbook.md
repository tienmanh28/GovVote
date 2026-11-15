# Runbook Sepolia — CHƯA thực hiện

Chỉ Owner chạy sau khi merge D1 và duyệt D2/D3. AI không tự chạy các lệnh trong tài liệu này. **CHƯA deploy Sepolia, CHƯA audit.** Mọi địa chỉ/URL dưới đây là placeholder; không sao chép nguyên văn để broadcast. Không dùng SeedDemo trên Sepolia.

## 1. Chuẩn bị và chốt phân phối

- Keystore ngoài repo tên `govvote-deployer`, tạo/import bằng giao diện tương tác; luôn ký bằng `--account govvote-deployer`, không truyền key thô qua dòng lệnh.
- Ví deployer có ETH Sepolia trả gas; bốn tài khoản MetaMask độc lập cũng có ETH Sepolia để tự delegate/vote. Không dùng tài khoản/key Anvil trên mạng công khai.
- RPC Sepolia và Etherscan API key do Owner cung cấp qua biến môi trường tương tác, không ghi file, shell history, log hoặc commit. Bản ghi bằng chứng chỉ lưu địa chỉ/tx/block/gas, không lưu URL chứa credential.
- Owner đã chốt: deployer nhận **toàn bộ 1.000.000 GOV** lúc deploy. GovToken không mint thêm; chuyển sai địa chỉ có thể mất token vĩnh viễn. Owner kiểm bằng mắt địa chỉ, chain, số GOV trước **từng** giao dịch phân phối. Ví dụ đợt demo dưới đây là 400.000/250.000/200.000/150.000 GOV; Owner xác nhận lại trước khi dùng.

Đọc RPC qua biến môi trường, không có endpoint công khai điền sẵn:

```bash
read -rs -p 'RPC Sepolia (không ghi history): ' SEPOLIA_RPC_URL
export SEPOLIA_RPC_URL
export DEPLOYER_ADDRESS='<DEPLOYER_ADDRESS>'
export ALICE='<ALICE>' BOB='<BOB>' CHARLIE='<CHARLIE>' DAVID='<DAVID>'
```

Kiểm địa chỉ keystore bằng `cast wallet address --account govvote-deployer`; phải bằng `<DEPLOYER_ADDRESS>`. Kiểm `cast chain-id --rpc-url "$SEPOLIA_RPC_URL"` phải đúng **11155111**; kiểm `cast balance "$DEPLOYER_ADDRESS" --ether --rpc-url "$SEPOLIA_RPC_URL"`. Owner kiểm ETH và bốn địa chỉ nhận, không tự chọn ví thay Owner.

## 2. Dry-run trước, chưa ký giao dịch on-chain

Chốt cấu hình giữ nguyên: threshold 1.000 GOV, quorum 1.000 bps (10%), delay 15 block, period 7.200 block. Nếu Owner muốn đổi phải có quyết định riêng.

```bash
EXPECTED_CHAIN_ID=11155111 TOKEN_RECIPIENT="$DEPLOYER_ADDRESS" \
PROPOSAL_THRESHOLD_GOV=1000 QUORUM_BPS=1000 VOTING_DELAY_BLOCKS=15 VOTING_PERIOD_BLOCKS=7200 \
  forge script script/Deploy.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL" \
  --account govvote-deployer
```

**Không có `--broadcast`.** So sánh chính xác dòng `broadcaster (sender)` trong log dry-run với địa chỉ trả bởi `cast wallet address --account govvote-deployer`; **DỪNG nếu khác**, không broadcast hoặc chuyển GOV. Đối chiếu log chain/name/broadcaster/recipient/tham số, gas dự kiến và bytecode với commit được Owner duyệt. Script dùng `vm.readCallers()` sau `startBroadcast` để lấy signer thực; không suy ra signer từ `msg.sender`. Bất kỳ mismatch/revert nào đều dừng; không retry giao dịch để che lỗi.

## 3. Owner xác nhận rồi mới broadcast deploy

Ngay trước ký: kiểm lại chain ID, địa chỉ keystore, recipient và số dư ETH. Owner xác nhận hai giao dịch deploy và cấu hình. Chỉ sau xác nhận mới thêm `--broadcast`:

```bash
EXPECTED_CHAIN_ID=11155111 TOKEN_RECIPIENT="$DEPLOYER_ADDRESS" \
PROPOSAL_THRESHOLD_GOV=1000 QUORUM_BPS=1000 VOTING_DELAY_BLOCKS=15 VOTING_PERIOD_BLOCKS=7200 \
  forge script script/Deploy.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL" \
  --account govvote-deployer --broadcast
```

Script có hai CREATE. Nếu một giao dịch đã có receipt còn giao dịch kia lỗi, dừng ghi bằng chứng; không chạy lại cả script vì có thể tạo thêm contract/đổi nonce. Owner quyết cách xử lý sau khi đối chiếu receipt và nonce.

Ghi tx hash/block/gas/địa chỉ GovToken, GovVote, commit/compiler/optimizer/EVM trong bảng cuối. Chỉ dùng địa chỉ từ receipt thật:

```bash
export GOV_TOKEN='<GOV_TOKEN>' GOV_VOTE='<GOV_VOTE>'
```

## 4. Đọc lại state sau deploy

```bash
cast call "$GOV_TOKEN" 'totalSupply()(uint256)' --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_TOKEN" 'balanceOf(address)(uint256)' "$DEPLOYER_ADDRESS" --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_VOTE" 'token()(address)' --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_VOTE" 'proposalThreshold()(uint256)' --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_VOTE" 'quorumBps()(uint256)' --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_VOTE" 'votingDelayBlocks()(uint256)' --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_VOTE" 'votingPeriodBlocks()(uint256)' --rpc-url "$SEPOLIA_RPC_URL"
```

Phải khớp: supply và balance deployer đều `1000000000000000000000000`; GovVote.token đúng GovToken; threshold `1000000000000000000000`, quorum `1000`, delay `15`, period `7200`. Nếu không khớp, dừng trước phân phối. Guard chỉ phát hiện expected/actual lệch hoặc chain ngoài allowlist; nếu Owner chọn nhầm cả hai nhưng chúng cùng là một chain được phép thì guard không biết ý định thật.

## 5. Bốn giao dịch phân phối riêng, Owner duyệt từng giao dịch

Các số sau tính bằng wei GOV (18 decimals). **Không chạy thành một batch/loop.** Trước mỗi lệnh Owner kiểm bằng mắt chain, contract token, keystore, địa chỉ đích và lượng GOV. Sau receipt, đọc lại balance trước khi duyệt lệnh kế tiếp; ghi vào bảng bằng chứng.

Alice — chỉ chạy sau xác nhận riêng của Owner:

```bash
cast send "$GOV_TOKEN" 'transfer(address,uint256)(bool)' "$ALICE" 400000000000000000000000 --account govvote-deployer --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_TOKEN" 'balanceOf(address)(uint256)' "$ALICE" --rpc-url "$SEPOLIA_RPC_URL"
```

Bob — cần xác nhận mới:

```bash
cast send "$GOV_TOKEN" 'transfer(address,uint256)(bool)' "$BOB" 250000000000000000000000 --account govvote-deployer --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_TOKEN" 'balanceOf(address)(uint256)' "$BOB" --rpc-url "$SEPOLIA_RPC_URL"
```

Charlie — cần xác nhận mới:

```bash
cast send "$GOV_TOKEN" 'transfer(address,uint256)(bool)' "$CHARLIE" 200000000000000000000000 --account govvote-deployer --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_TOKEN" 'balanceOf(address)(uint256)' "$CHARLIE" --rpc-url "$SEPOLIA_RPC_URL"
```

David — cần xác nhận mới:

```bash
cast send "$GOV_TOKEN" 'transfer(address,uint256)(bool)' "$DAVID" 150000000000000000000000 --account govvote-deployer --rpc-url "$SEPOLIA_RPC_URL"
cast call "$GOV_TOKEN" 'balanceOf(address)(uint256)' "$DAVID" --rpc-url "$SEPOLIA_RPC_URL"
```

Đọc lại balance deployer (0 nếu đúng cả đợt ví dụ), tổng cung vẫn 1.000.000 GOV. Khi lỗi/thiếu receipt: dừng, kiểm tx hash và nonce; không tự gửi lại transfer.

## 6. Mỗi tài khoản tự delegate

Alice/Bob/Charlie/David lần lượt kết nối MetaMask ở Sepolia và tự ký `GovToken.delegate(địa chỉ của chính mình)`. Mỗi lần phải có Owner/chủ ví xác nhận; không dùng keystore deployer ký thay. Nếu frontend chưa được cấu hình/verify, dừng chờ bước giao diện hoặc công cụ tương tác được Owner duyệt.

Sau receipt mỗi ví, đọc `cast call "$GOV_TOKEN" 'getVotes(address)(uint256)' '<ALICE>' --rpc-url "$SEPOLIA_RPC_URL"` (thay bằng địa chỉ của ví tương ứng). Kỳ vọng lần lượt 400.000/250.000/200.000/150.000 GOV theo đợt ví dụ. Đợi block mới để checkpoint thành quá khứ trước thao tác đòi quyền tại block trước/snapshot.

## 7. D3 source verification và frontend — chỉ sau xác minh

Owner chuẩn bị Etherscan API key qua env tương tác, không truyền giá trị secret vào dòng lệnh hoặc log. D3 đối chiếu solc **0.8.28**, optimizer **200**, EVM **cancun**, constructor args từ receipt/config thực; verify source cả GovToken và GovVote, ghi link kết quả. Chưa thực hiện các lệnh gọi Etherscan trong D1.

Chỉ sau kiểm state/source theo bước được Owner duyệt mới cấu hình frontend env (không chứa key/credential), `VITE_CHAIN_ID=11155111`, URL RPC công khai do Owner chọn, hai địa chỉ đúng; cập nhật README bằng bằng chứng thật. Strict CLI dùng `GOV_CHAIN_ID=11155111`, RPC tường minh, địa chỉ đã kiểm. Verify có thể trễ **khoảng 13 phút** vì **64 confirmations** (64 × 12 giây = 768 giây, ước tính, không bảo đảm finality). Không bịa proposal/tx hoặc tuyên bố VERIFIED khi chưa có evidence.

## 8. Bảng bằng chứng Owner điền

| Bước | Chain/commit | Người ký/địa chỉ | Tx hash | Block/gas | State đọc lại / xác nhận Owner |
|---|---|---|---|---|---|
| Dry-run | chưa thực hiện | <DEPLOYER_ADDRESS> | không broadcast | chưa có | chưa xác minh |
| Deploy GovToken | chưa thực hiện | <GOV_TOKEN> | chưa có | chưa có | chưa xác minh |
| Deploy GovVote | chưa thực hiện | <GOV_VOTE> | chưa có | chưa có | chưa xác minh |
| Transfer Alice | chưa thực hiện | <ALICE> | chưa có | chưa có | chưa xác minh |
| Transfer Bob | chưa thực hiện | <BOB> | chưa có | chưa có | chưa xác minh |
| Transfer Charlie | chưa thực hiện | <CHARLIE> | chưa có | chưa có | chưa xác minh |
| Transfer David | chưa thực hiện | <DAVID> | chưa có | chưa có | chưa xác minh |
| Self-delegate × 4 | chưa thực hiện | từng ví | chưa có | chưa có | chưa xác minh |
| D3/source/frontend | chưa thực hiện | hai contract | chưa có | chưa có | chưa xác minh |

**Trạng thái hiện tại: chỉ tài liệu chuẩn bị, chưa chạy thật trên Sepolia.**
