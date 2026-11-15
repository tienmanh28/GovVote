# GovVote v1.1: Báo cáo demo Phase 1 (Anvil local)

> D1 cập nhật lệnh chạy lại local với EXPECTED_CHAIN_ID=31337; receipt/kết quả lịch sử dưới đây giữ nguyên. SeedDemo hiện chỉ local; lỗi mạng mới là LocalDemoOnly(actual).

> **Phạm vi của báo cáo này**
> - Chạy trên **Anvil local (chain 31337)**. **Chưa phải testnet**, chưa có giao dịch nào trên Sepolia.
> - **Chưa verify source** trên Etherscan (không áp dụng cho Anvil).
> - Trạng thái Anvil chỉ nằm trong RAM: tắt Anvil là mất. Địa chỉ và tx hash dưới đây chỉ có nghĩa
>   trong phiên Anvil này. Chạy lại từ đầu trên Anvil sạch sẽ cho địa chỉ khác nếu thứ tự giao dịch khác.
> - Full lifecycle (delegate → propose → vote → kết quả) ở mục 6b cũng **chỉ chạy trên Anvil local**.
>   Block được tạo nhanh bằng `anvil_mine`, nên "7.200 block" ở đây không tương ứng thời gian thực.
> - Không có private key, mnemonic hay credential nào trong báo cáo, lệnh hay file của repo.
> - Ngày chạy: 09/11/2026. Người thực hiện: Lê Tiến Mạnh.

## 1. Môi trường

| Thành phần | Phiên bản |
|---|---|
| forge / cast / anvil | 1.7.1 |
| solc | 0.8.28 (`foundry.toml`, `evm_version = "cancun"`, optimizer 200 runs) |
| OpenZeppelin Contracts | v5.6.1 (`5fd1781b`) |
| forge-std | v1.17.0 (`f3dae6e6`) |
| OS | Ubuntu 26.04 trên WSL2 |

**Khóa phiên bản:** `foundry.lock`, working tree của `lib/` và git index đều trỏ cùng commit:
OZ `5fd1781b1454fd1ef8e722282f86f9293cacf256` (tag v5.6.1), forge-std `f3dae6e6ee381f25eb6a246f7da9b85c91a68219`
(tag v1.17.0). `git submodule status` không còn dấu `+`. Trước đó index ghi nhầm đầu nhánh `master` lúc cài
(`efaa6f78`, `dc647cc0`); đã sửa bằng `git add lib/forge-std lib/openzeppelin-contracts`. Thay đổi này mới
**stage**, repo **chưa có commit nào**.

## 2. Mạng và contract

| Mục | Giá trị |
|---|---|
| Chain ID | `31337` (Anvil) |
| RPC | `http://127.0.0.1:8545` |
| Deployer / người ký | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Anvil account 0) |
| `TOKEN_RECIPIENT` (truyền tường minh) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| **GovToken** | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |
| **GovVote** | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` |

Trên cùng phiên Anvil này còn một bản deploy cũ từ Bước 6 (GovToken `0x5FbDB2315678afecb367f032d93F642f64180aa3`,
GovVote `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`), tạo bằng phiên bản `Deploy.s.sol` trước khi đổi sang
`PROPOSAL_THRESHOLD_GOV`. Bản đó **đã được thay thế**; báo cáo này chỉ dùng cặp địa chỉ ở bảng trên.

### Cấu hình GovVote (đọc lại bằng `cast call`)

| Tham số | Giá trị on-chain | Ý nghĩa |
|---|---|---|
| `token()` | `0x0165878A594ca255338adfa4d48449f69242Eb8F` | trỏ đúng GovToken |
| `proposalThreshold()` | `1000000000000000000000` (`1e21`) | 1.000 GOV |
| `quorumBps()` | `1000` | 10% tổng cung tại snapshot |
| `votingDelayBlocks()` | `15` | snapshot = block tạo + 15 |
| `votingPeriodBlocks()` | `7200` | deadline = snapshot + 7200 (~1 ngày nếu 12 giây/block, ước tính) |
| `proposalCount()` | `0` | chưa có proposal |

## 3. Giao dịch

Tất cả `status = 1` (thành công), lấy từ receipt trong `broadcast/*/31337/run-latest.json` (thư mục này
không được đưa vào Git).

| Block | Script | Hành động | Tx hash | Gas used |
|---|---|---|---|---|
| 6 | Deploy | `new GovToken(0xf39F…2266)` | `0x6786f7d663a7348b377704d6a3e1f6077f539400f5fa2af5bc9286096fd18622` | 1.718.541 |
| 7 | Deploy | `new GovVote(token, 1e21, 1000, 15, 7200)` | `0x2716d19d451d1efef446f35af92106a89bf10404b7c3dc76b21cadba9e9ef799` | 1.051.962 |
| 8 | SeedDemo | `transfer(Alice, 400.000 GOV)` | `0x0ed5d80e67c1871b65d06ca0100a7e64c8ecd2257a52132ec318a5d3446d0550` | 56.338 |
| 9 | SeedDemo | `transfer(Bob, 250.000 GOV)` | `0xee7779b2385cf36ced8d9b51f312cf6e0128d3e1b2729155fbaec5ac1d4b7cef` | 56.338 |
| 10 | SeedDemo | `transfer(Charlie, 200.000 GOV)` | `0x330aac10191654f656fd6f346e7b4446f852c1d5848a887b343cdac399dd8b49` | 56.338 |
| 11 | SeedDemo | `transfer(David, 150.000 GOV)` | `0xfff484062b9a35a2f5e7873d57de4f12716cbbe6aaa826a93b5c487e401d226b` | 51.550 |

Gas là số đo trên Anvil cho đúng các giao dịch này, không phải ước tính chung. Lần chuyển cuối rẻ hơn vì số dư
người gửi về 0 (được hoàn gas khi xóa storage slot).

## 4. Số dư sau seed (đọc bằng `cast call` trên GovToken `0x0165…Eb8F`)

| Ví | Địa chỉ | `balanceOf` | Tỷ lệ | `getVotes` |
|---|---|---|---|---|
| Deployer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | 0 | 0% | 0 |
| Alice | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 400.000 GOV (`4e23`) | 40% | 0 |
| Bob | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | 250.000 GOV (`2.5e23`) | 25% | 0 |
| Charlie | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | 200.000 GOV (`2e23`) | 20% | 0 |
| David | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | 150.000 GOV (`1.5e23`) | 15% | 0 |
| **`totalSupply()`** | | **1.000.000 GOV (`1e24`)** | 100% | |

`getVotes = 0` cho mọi ví là đúng thiết kế: SeedDemo không delegate. Mỗi chủ ví tự gọi `delegate()`.
Bốn ví demo là account 1–4 của Anvil do một người kiểm soát, nên đây là bài tập phân phối token,
không chứng minh quyền sở hữu đã phi tập trung (đặc tả mục 2.1).

## 5. Lệnh đã chạy

Ký giao dịch bằng `--unlocked --sender`: forge gửi `eth_sendTransaction` tới account đã được Anvil mở khóa sẵn,
nên **không có private key** trong lệnh, file hay log. Output khởi động của Anvil (có in key) được bỏ vào `/dev/null`.

```bash
# 1. Anvil (chạy nền)
anvil --port 8545 > /dev/null 2>&1

# 2. Deploy
EXPECTED_CHAIN_ID=31337 TOKEN_RECIPIENT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
PROPOSAL_THRESHOLD_GOV=1000 QUORUM_BPS=1000 VOTING_DELAY_BLOCKS=15 VOTING_PERIOD_BLOCKS=7200 \
  forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 \
  --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 3. Seed
EXPECTED_CHAIN_ID=31337 GOV_TOKEN=0x0165878A594ca255338adfa4d48449f69242Eb8F \
DEMO_ALICE=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
DEMO_BOB=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
DEMO_CHARLIE=0x90F79bf6EB2c4f870365E785982E1f101E93b906 \
DEMO_DAVID=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 \
  forge script script/SeedDemo.s.sol:SeedDemo --rpc-url http://127.0.0.1:8545 \
  --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 4. Đối chiếu (ví dụ)
cast call 0x0165878A594ca255338adfa4d48449f69242Eb8F 'totalSupply()(uint256)' --rpc-url http://127.0.0.1:8545
cast call 0x0165878A594ca255338adfa4d48449f69242Eb8F 'balanceOf(address)(uint256)' <ví> --rpc-url http://127.0.0.1:8545
cast call 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 'proposalThreshold()(uint256)' --rpc-url http://127.0.0.1:8545
```

Log preflight của Deploy (in trước khi broadcast):

```
chainId               : 31337
broadcaster (sender)  : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
TOKEN_RECIPIENT       : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
PROPOSAL_THRESHOLD GOV: 1000
PROPOSAL_THRESHOLD wei: 1000000000000000000000
QUORUM_BPS            : 1000
VOTING_DELAY_BLOCKS   : 15
VOTING_PERIOD_BLOCKS  : 7200
```

## 6. Các đường chặn của script (chỉ mô phỏng, không broadcast)

### SeedDemo: 4 đường chặn, chạy trên GovToken `0x0165…Eb8F`

| # | Tình huống | Lệnh (rút gọn) | Kết quả thật |
|---|---|---|---|
| 1 | Chain ngoài danh sách cho phép | `forge script …SeedDemo --chain 1` | `WrongNetwork(1)` |
| 2 | Người gửi không có GOV (account 5) | `… --rpc-url $RPC --sender 0x9965…A4dc` | `NotEnoughBalance(0x9965…A4dc, 0, 1e24)` |
| 3 | Người gửi trùng ví nhận | `… --rpc-url $RPC --sender $DEMO_ALICE` | `InvalidDemoWallet("DEMO_ALICE", 0x7099…79C8)` |
| 4 | Chạy seed lần hai sau khi đã seed | `… --rpc-url $RPC --sender <deployer>` | `NotEnoughBalance(0xf39F…2266, 0, 1e24)` |

Block number không đổi sau các lần mô phỏng (không có giao dịch nào được gửi).

### Deploy: kiểm tra biến `PROPOSAL_THRESHOLD_GOV`

| Biến môi trường | Kết quả thật |
|---|---|
| (mặc định) | log `GOV: 1000`, `wei: 1000000000000000000000` |
| `PROPOSAL_THRESHOLD_GOV=2500` | log `GOV: 2500`, `wei: 2500000000000000000000` |
| còn đặt biến cũ `PROPOSAL_THRESHOLD=1000` | `DeprecatedEnvVar("PROPOSAL_THRESHOLD")`, dừng trước khi deploy |

## 6b. Lifecycle trên Anvil

Proposal #1 chạy trọn vòng đời trên cùng GovToken `0x0165…Eb8F` / GovVote `0xa513…C853` (chain 31337).
Mọi giao dịch ký bằng `--unlocked --from`, không có key. Biến môi trường dùng trong lệnh:
`RPC=http://127.0.0.1:8545`, `GOV_TOKEN`, `GOV_VOTE`, `ALICE`, `BOB`, `CHARLIE`, `DAVID` (địa chỉ ở mục 2 và 4).

Lưu ý khi đọc bảng: `cast call` ở `latest` chạy với `block.number` = block mới nhất (đã đo bằng `GovToken.clock()`),
còn một giao dịch gửi mới sẽ nằm ở block **kế tiếp**.

| Bước | Lệnh | Kết quả thật | Tx hash | Block | Gas | Status |
|---|---|---|---|---|---|---|
| 1 | `cast send $GOV_TOKEN "delegate(address)" $ALICE --from $ALICE --unlocked --rpc-url $RPC` | Alice tự delegate, `getVotes` = 400.000 GOV | `0x2f546c818daebc0938673b5fd0affbb95708fa3697467494da823e8cbe7ecfc6` | 12 | 95.644 | 1 |
| 1 | như trên với `$BOB` | `getVotes` = 250.000 GOV | `0xd2961826a42fcb690bebc000bc41e9f85b35a326504254dda65ca44b04babecb` | 13 | 95.632 | 1 |
| 1 | như trên với `$CHARLIE` | `getVotes` = 200.000 GOV | `0x65711019b614c768730d8d3c40a6174e1e794b1c93ea4a32dd92aa6cf42c6fc1` | 14 | 95.644 | 1 |
| 1 | như trên với `$DAVID` | `getVotes` = 150.000 GOV | `0xf72a8219ee6565992f5cec6cc2a0bbcca28e0affe1ca38a3cbf08acbfb41fe66` | 15 | 95.644 | 1 |
| 2 | `cast rpc anvil_mine 2 --rpc-url $RPC` | block 15 → 17; checkpoint delegate đã thuộc quá khứ | (không có tx) | 16–17 | | |
| 3 | `cast send $GOV_VOTE "propose(string,string)" "<title 44 bytes>" "<description 91 bytes>" --from $ALICE --unlocked --rpc-url $RPC` | `ProposalCreated` id = 1, `proposalCount` = 1 | `0xd6e40a20534b11f16d518fabbab7006a03966714a4f18180a0d9465774a9b6d3` | 18 | 303.678 | 1 |
| 4 | `cast call $GOV_VOTE "state(uint256)(uint8)" 1` | block 18: `0` (Pending) | | | | |
| 5 | `cast call $GOV_VOTE "getProposal(uint256)((address,string,string,uint256,uint256,uint256,uint256,uint256))" 1` | proposer Alice, createdBlock **18**, snapshotBlock **33**, deadlineBlock **7233**, 0 / 0 | | | | |
| 6 | `cast rpc anvil_mine 15` rồi `state(1)`; `cast rpc anvil_mine 1` rồi `state(1)` | block 33 (snapshot): `0` (Pending), `quorumVotes` revert `SnapshotNotFinalized(1, 33)`, mô phỏng vote revert `NotActive(1, Pending)`. Block 34: `1` (Active), `quorumVotes` = 100.000 GOV | (không có tx) | 33, 34 | | |
| 7 | `cast send $GOV_VOTE "castVote(uint256,bool)" 1 true --from $ALICE --unlocked --rpc-url $RPC` | `VoteCast(1, Alice, true, 400.000 GOV)` | `0x23988fc006b264c87b577dd91ab639529ad958812a8d267c515cb9b99a933014` | 35 | 83.907 | 1 |
| 7 | như trên, `false`, `--from $BOB` | `VoteCast(1, Bob, false, 250.000 GOV)` | `0x58ea11cdac22fdd7effc4d1e353cb7db1a9346af4d0c9141bb555aa1be68531e` | 36 | 83.882 | 1 |
| 7 | như trên, `true`, `--from $CHARLIE` | `VoteCast(1, Charlie, true, 200.000 GOV)` | `0xe9d64f076072d69929cfaea09b7d64ef8437911cb56c718846be02fe10cc92d4` | 37 | 66.807 | 1 |
| 7 | Alice vote lại: `cast send $GOV_VOTE "castVote(uint256,bool)" 1 false --from $ALICE --unlocked --rpc-url $RPC` | Bị từ chối khi ước tính gas: `custom error 0x04f9da63 … AlreadyVoted(1, 0x7099…79C8)`. Không có tx nào được gửi (block giữ 37) | (không có tx) | | | |
| 7+ | Như trên, thêm `--gas-limit 100000` để ép gửi | Tx được mine nhưng **revert trong contract**: `AlreadyVoted(1, Alice)`, không có log, tally giữ 600.000 / 250.000 | `0x1bc945f76730e8973caba075023978e4e29e39465cfb2ca70bcc703b03c03b48` | 38 | 30.626 | **0** |
| 8 | `cast rpc anvil_mine 7195` rồi `state(1)`; `cast rpc anvil_mine 1` rồi `state(1)` | block 7233 (deadline): `1` (Active). Block 7234: **`2` (Succeeded)**. David vote muộn (mô phỏng): `NotActive(1, Succeeded)` | (không có tx) | 7233, 7234 | | |
| 9 | `cast call $GOV_VOTE "getProposal(uint256)(…)" 1` | forVotes **600.000 GOV** (`6e23`), againstVotes **250.000 GOV** (`2.5e23`), khớp tổng tính lại từ 3 event `VoteCast` | | | | |

**Kết quả cuối:** proposal #1 **Succeeded**. Tham gia = 600.000 + 250.000 = 850.000 GOV ≥ quorum 100.000 GOV,
và For 600.000 > Against 250.000. David (150.000 GOV, đã delegate) không vote. `hasVoted(1, Alice)` = true,
`hasVoted(1, David)` = false.

Ghi chú gas: phiếu của Charlie rẻ hơn Alice (66.807 so với 83.907) vì slot `forVotes` đã khác 0 sau phiếu của Alice
(ghi đè slot khác 0 rẻ hơn ghi slot đang bằng 0). Tx 7+ chỉ tốn 30.626 gas vì revert sớm ở bước kiểm tra `hasVoted`.

## 7. Kiểm thử

`forge test -vv`: **43 passed, 0 failed, 0 skipped** (2 suite). `forge fmt --check` và `forge build --sizes`
(kể cả `--force`) đều exit 0.

| Suite / nhóm | Số test | Tiêu biểu |
|---|---|---|
| **GovTokenTest** | 4 | `test_TotalSupplyFixed`, `test_TransferDoesNotCreateVotes`, `test_DelegateSelfAndOther`, `test_PastVotesRecordedByBlock` |
| GovVote: cấu hình constructor | 3 | `test_RevertWhenInvalidParameters`, `test_ConstructorAcceptsBoundaryValues`, `test_RevertWhenVotingWindowExceedsUint48` |
| GovVote: proposal | 7 | `test_RevertWhenBelowThreshold`, `test_ThresholdReadsPreviousBlock`, `test_RevertWhenTitleInvalid`, `test_ValidationOrder`, `test_ProposalCreatedEmitsSnapshotAndDeadline` |
| GovVote: timing / state / view | 7 | `test_PendingAtSnapshotBlock`, `test_ActiveAfterSnapshotBlock`, `test_ActiveAtDeadlineBlock`, `test_DefeatedAfterDeadlineWithoutVotes`, `test_QuorumVotesRevertsWhilePending` |
| GovVote: vote, trạng thái | 3 | `test_RevertAfterDeadlineBlock`, `test_RevertWhenVotingWhilePending`, `test_CastVoteRevertsWhenProposalNotFound` |
| GovVote: vote, trọng số | 4 | `test_RevertWhenAlreadyVoted`, `test_VoteWeightMatchesPastVotes`, `test_TwoVotesInSameBlockBothCount`, `test_TransferAfterSnapshotDoesNotChangeTally` |
| GovVote: delegate và snapshot | 6 | `test_DelegateBeforeSnapshotCounts`, `test_DelegateAfterSnapshotDoesNotCount`, `test_FlashLoanVoteDoesNotCount`, `test_GetVotingPowerAtReturnsSnapshotPower` |
| GovVote: quorum (GovToken) | 6 | `test_DefeatedWhenQuorumNotMet` (11/10), `test_SucceedsWhenQuorumMet` (60k/40k), `test_DefeatedOnTie`, `test_UndelegatedSupplyRaisesQuorumBar` |
| GovVote: quorum (MockVotesToken) | 2 | `test_QuorumUsesSnapshotSupply`, `test_QuorumRoundsUp` |
| GovVote: integration | 1 | `test_FullLifecycle` |
| **Tổng** | **43** | |

Cả 10 custom error của GovVote đều có ít nhất một test kiểm tra đúng selector và tham số.
`test_FlashLoanVoteDoesNotCount` chỉ chứng minh token nhận **sau** snapshot không được tính. Snapshot không chặn
việc mua/vay **trước** snapshot (đặc tả mục 2.4).

Kích thước contract (`forge build --sizes --force`):

| Contract | Runtime (B) | Initcode (B) | Runtime margin (B) |
|---|---|---|---|
| GovToken | 6.846 | 9.652 | 17.730 |
| GovVote | 4.603 | 5.061 | 19.973 |
| MockVotesToken (chỉ test) | 7.002 | 7.953 | 17.574 |

## 8. Đã làm / còn lại

**Đã làm xong trong Phase 1:**
- Full lifecycle trên **Anvil local** (mục 6b): delegate → propose → Pending → Active → vote → Succeeded, có tx hash.
  Chưa phải testnet.
- Khóa submodule: git index khớp `foundry.lock` (mục 1). Mới stage, chưa commit.

**Còn lại:**
- Repo chưa có commit nào (chưa được yêu cầu commit).
- Phase 2: fuzz test, invariant test, coverage, `.gas-snapshot`, verification script đối chiếu `VoteCast` với storage,
  threat model, ADR.
- Phase 3: frontend.
- Phase 4: deploy Sepolia, verify source, CI trên GitHub, README thật.
