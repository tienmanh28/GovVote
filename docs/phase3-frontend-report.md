# Phase 3: báo cáo frontend GovVote

> Báo cáo được cập nhật sau mỗi bước. Mọi giao dịch đều chạy trên **Anvil local (chainId 31337)** và được ký bằng `--unlocked --from/--sender`, nên không có private key nào trong lệnh hay file. Không chạm Sepolia.

## Chuẩn bị chain (Bước 0)

Ngày 12/11, Anvil bị dừng ở cuối lần chạy E2E. Chain được **dựng lại ngày 14/11/2026** trên Anvil mới (bắt đầu từ block 0), theo đúng thứ tự của `docs/phase1-demo-report.md`: Deploy, SeedDemo, rồi lifecycle. Số liệu dưới đây là của lần dựng lại này.

Vì cùng deployer, cùng nonce và cùng dữ liệu, **địa chỉ contract và tx hash của Deploy/Seed trùng với lần 12/11**. Nhờ vậy `frontend/.env.local` không phải đổi địa chỉ (chỉ cập nhật dòng chú thích).

| Mục | Giá trị |
|---|---|
| `cast chain-id` | `31337` |
| Deployer / recipient | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Anvil account 0) |
| **GovToken** | `0x5FbDB2315678afecb367f032d93F642f64180aa3`, `cast code` dài 13.695 ký tự hex |
| **GovVote** | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`, `cast code` dài 9.209 ký tự hex |
| Cấu hình | threshold 1.000 GOV, quorum 1.000 bps, delay 15 block, period 7.200 block |

| Bước | Giao dịch | Tx hash | Block | Gas | Status |
|---|---|---|---|---|---|
| Deploy | `new GovToken` | `0xb2c740f1aceb73b8dd205aa4b833f6bffec902257592c931ebac365d979049d3` | 1 | 1.718.541 | 1 |
| Deploy | `new GovVote` | `0x309542953470bed791047bf666db861e05a5f27ef3c9af4bd3b56b0699f43d17` | 1 | 1.051.962 | 1 |
| Seed | Alice +400.000 GOV | `0x33b276acb07732005656ec1115d891d192993344961a3810a21f19cbc4924697` | 2 | 56.338 | 1 |
| Seed | Bob +250.000 GOV | `0x007a347a5745dada8e5e841fc5eb6035cae724618c50f208f1e571321fad79ae` | 3 | 56.338 | 1 |
| Seed | Charlie +200.000 GOV | `0x16e0eff77f92d8353a8ddf74f90b014f24d90532ddf3ceefd39a052da0afdb65` | 4 | 56.338 | 1 |
| Seed | David +150.000 GOV | `0x18d0aebb6275c08fe5437af704be7eba734702479edf9223c725b974090edf34` | 4 | 51.550 | 1 |
| Delegate | Alice → Alice | `0x8ff8bbc091f7a3bf552597c0da04b13e7839c4f47b2fdacd58b89940fa187000` | 5 | 95.644 | 1 |
| Delegate | Bob → Bob | `0x32b4319973c0fbff91aaef430dbfe5a8b30583050aa68bffae640d2f7bce4c6a` | 6 | 95.632 | 1 |
| Delegate | Charlie → Charlie | `0x066e697023571d8fa73600a117bbebf5849d0eccd5ff953570939a264e172cd2` | 7 | 95.644 | 1 |
| Delegate | David → David | `0xf70be773ca40652881a35d65e7b45f68258f7dc6ba1a90c94cf19eb948169972` | 8 | 95.644 | 1 |
| Propose | Alice, proposal #1 | `0x0209421b426eaddc3cfe7aa04d88361a68d2deff980bacf98a7a1f78861c989e` | 11 | 326.279 | 1 |
| Vote | Alice For 400.000 GOV | `0xd0793eb92347766822de62e95dbf07f1533e72f910f01c08ed7deef5d37f7732` | 28 | 83.907 | 1 |
| Vote | Bob Against 250.000 GOV | `0xe25e03addccca1c04d35f0ebfc602eec1d678b0d91680c00c1f52e1a249e95f4` | 29 | 83.882 | 1 |
| Vote | Charlie For 200.000 GOV | `0x157a184c487acdf7775133ed1c186ef6aca47c4faceb129aa31863682c91dc38` | 30 | 66.807 | 1 |

Các mốc của proposal #1:
- `createdBlock` 11, `snapshotBlock` 26, `deadlineBlock` 7.226.
- Block 26 (snapshot): Pending. Block 27: Active.
- Block 7.226 (deadline): vẫn Active. Block 7.227: **Succeeded**, kết quả For 600.000 GOV (Alice 400.000 + Charlie 200.000) / Against 250.000 GOV (Bob).

Ba lần `anvil_mine` không tạo giao dịch: 2 block sau khi delegate, tới snapshot + 1, và tới deadline + 1.

`scripts/verify` chạy **độc lập** với địa chỉ GovVote (ngày 14/11, sau khi dựng lại chain, trước khi chạy E2E):

```
chainId        : 31337
GovVote        : 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
latest / head  : 7227 / 7215 (chờ 12 block xác nhận)
proposalCount  : 1 (tại head)
VoteCast logs  : 3 (block 0..7215)

id | log For | log Against | chain For | chain Against | khớp
---+---------+-------------+-----------+---------------+-----
 1 | 600.000 |     250.000 |   600.000 |       250.000 |   OK

VERIFIED        (exit 0)
```

Kết quả: **đạt**.

## 1. Mục tiêu và phạm vi

Frontend v1.1 của GovVote (đặc tả Phần 5): xem danh sách và chi tiết proposal, xem số dư / voting power / người được ủy quyền, delegate, tạo proposal và bỏ phiếu bằng MetaMask. Lỗi hiển thị bằng tiếng Việt. Giao diện responsive trên máy tính, máy tính bảng và điện thoại.

**Phạm vi:**
- Chỉ chạy trên **Anvil local (chainId 31337)**.
- Stack: Vite, React, TypeScript, Tailwind CSS, wagmi v2, viem, TanStack Query.
- Ví: MetaMask qua connector `injected`. Trên điện thoại chỉ hướng dẫn mở trang trong trình duyệt của app MetaMask; WalletConnect thuộc v2.

**Ngoài phạm vi:** Sepolia, Etherscan, deploy hosting (thuộc Phase 4); WalletConnect, indexer, IPFS (thuộc v2).

Lượt này không sửa `src/`, `test/`, `script/`, `foundry.toml` hay `scripts/verify/`. Không commit.

## 2. Tiêu chí chấp nhận

E2E chạy trong Chromium thật (Playwright 1.64.1, Chromium 156; thư viện hệ thống đã được cài bằng `sudo npx playwright install-deps chromium`) với **ví EIP-1193 giả**. Ví giả chuyển tiếp mọi request `eth_*` tới Anvil; Anvil tự ký vì các account demo là account dev đã mở khóa sẵn. **Không có private key trong ví giả.**

| # | Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|---|
| 0 | Chain demo dựng lại theo Phase 1, `scripts/verify` VERIFIED | Mục "Chuẩn bị chain" ở trên: 16 tx, verify cho 3 log và 600.000 / 250.000 GOV, exit 0 | Đạt |
| 1 | `frontend/` có package.json và lockfile riêng, phiên bản pin, không có `^`/`~`, mỗi gói phát hành ít nhất 14 ngày | Bảng phiên bản ở mục 4. `grep '"[\^~]' package.json` không có kết quả | Đạt |
| 1 | `.gitignore` chặn `node_modules/`, `dist/`, `.env.local`; có `.env.example` | `git check-ignore -v` xác nhận cả 3; `git status` không có các mục này | Đạt |
| 2 | ABI lấy từ `forge build`, không viết tay | `npm run sync-abi` sinh `src/abi/*.ts`, đầu file ghi nguồn và sha256 (govVote `5f95e53f…dc02`, govToken `d3500501…2547`) | Đạt |
| 3a | Điện thoại không có `window.ethereum`: hướng dẫn mở trong trình duyệt MetaMask | E2E `01` test 2 (UA iPhone): có hướng dẫn, link `https://metamask.app.link/dapp/127.0.0.1:4173/`. Ảnh `no-wallet-mobile-375x812.png` | Đạt |
| 3b | Máy tính không có `window.ethereum`: hướng dẫn cài MetaMask | E2E `01` test 1. Ảnh `no-wallet-desktop-1280x800.png` | Đạt |
| 3c | Sai chain: nút chuyển mạng | E2E `01` test 3: ví đổi sang chainId 1 thì hiện cảnh báo; bấm nút thì ví nhận `wallet_switchEthereumChain` và cảnh báo biến mất. Ảnh `wrong-chain-375x812.png` | Đạt |
| 3d | `VITE_GOV_VOTE` không có bytecode: báo lỗi cấu hình, không hiện dữ liệu rỗng | E2E `01` test 6: chặn `eth_getCode` trả `0x` thì hiện "Không có bytecode tại VITE_GOV_VOTE", và danh sách không hiển thị | Đạt |
| 4 | Danh sách proposal: proposalCount, getProposal, state | E2E `01`–`04`. Ảnh `list-*` ở 3 kích thước | Đạt |
| 4 | Chi tiết: getProposal, state, quorumVotes sau snapshot, hasVoted, getVotingPowerAt | E2E `02`: `my-power` = 400.000 GOV, `has-voted` đổi từ "Chưa" sang "Rồi". Ảnh `detail-*`, `detail-active-*` | Đạt |
| 4 | Dashboard ví hiện riêng balanceOf / getVotes / delegates, có giải thích tiếng Việt | E2E `02`: `delegatee` = "Chính ví này". Ảnh `wallet-*` | Đạt |
| 4 | Hiện block hiện tại và deadlineBlock, ghi rõ là block chứ không phải thời gian thực; GOV luôn có đơn vị | Ảnh `detail-*`: "Đây là số block, không phải thời gian thực…". Unit test `formatGov` | Đạt |
| 5 | Delegate cho chính mình | E2E `02`: trạng thái SUCCESS, receipt `success`, `to` = GovToken. Tx `0x54abf486…7f9d` | Đạt |
| 5 | Form tạo proposal: bộ đếm byte bằng TextEncoder; giới hạn lấy từ contract; nút khóa khi `getVotes(ví) < proposalThreshold` (threshold đọc từ contract) | E2E `02`: `current-votes` = 400.000 GOV, bộ đếm đúng số byte, proposal on-chain có title và description khớp. E2E `03`: bộ đếm "28/100 byte". Ảnh `create-*` | Đạt |
| 5 | Nút vote chỉ bật khi Active, chưa vote và power > 0 | E2E `02`: sau khi vote thì nút khóa với lý do "Ví này đã bỏ phiếu…". Ảnh `detail-1280x800` (Succeeded: khóa) và `detail-active-*` (Charlie: bật) | Đạt |
| 5 | Máy trạng thái IDLE → AWAITING_SIGNATURE → PENDING → SUCCESS/ERROR; invalidate khi SUCCESS; tx hash dạng văn bản | Unit test `txReducer`. E2E kiểm `data-status` SUCCESS/ERROR và đọc `tx-hash` | Đạt |
| 6 | Map đủ 10 lỗi GovVote sang tiếng Việt, theo `errorName` đã giải mã | Unit test: đủ 10 tên, khớp với ABI, giải mã từng lỗi từ revert data. Chuỗi thô "AlreadyVoted" không bị dịch | Đạt |
| 6 | Từ chối ký (4001) → "Bạn đã từ chối giao dịch trong ví" | Unit test và E2E `01` test 4 (ví giả ném lỗi 4001) | Đạt |
| 6 | Lỗi không nhận ra → thông báo gốc | Unit test (`fetch failed`, lỗi OpenZeppelin `ERC5805FutureLookup(10, 9)`) | Đạt |
| 6 | Lỗi khi đọc cũng dịch theo tên lỗi | E2E `01` test 5: `#/proposal/999` hiện "Không tìm thấy proposal #999." | Đạt |
| 7 | Không có `dangerouslySetInnerHTML` | `grep -rn dangerouslySetInnerHTML frontend/src`: 0 kết quả | Đạt |
| 7 | Title `<img src=x onerror=alert(1)>` hiện nguyên văn, không thực thi | E2E `03`: tạo proposal qua UI; title và description (`<script>…`) hiện đúng chuỗi; 0 phần tử `img`/`script`/`b`; 0 dialog | Đạt |
| 8 | Dưới 768px là thẻ, từ 768px là bảng; không cuộn ngang; nút ≥ 44px | E2E `04`: 18 ảnh, `scrollWidth ≤ innerWidth` ở mọi ảnh, 0 nút hoặc link điều hướng thấp hơn 44px | Đạt (sau khi sửa bảng ở 768px, xem mục 4) |
| 8 | Tự mở từng ảnh kiểm bố cục | Bảng kiểm ảnh ở dưới | Đạt |
| 9 | Unit test: errors, bộ đếm byte (chữ có dấu, emoji), tách voting power và số dư | `npm test`: 29 passed (2 file) | Đạt |
| 9 | E2E: Alice delegate → tạo proposal → vote; tally khớp getProposal và `scripts/verify` | E2E `02` (lần chạy cuối ngày 14/11 là proposal #2): Alice For 400.000, Bob Against 250.000; UI khớp `getProposal`; verify bên trong E2E cho VERIFIED, 5 log, 2 proposal đều OK | Đạt |
| 10 | E2E đầy đủ `npx playwright test --workers=1` | **12 passed, 0 failed** (29,5 giây), không bị kill | Đạt |
| 10 | typecheck, build, npm test | Exit 0, exit 0, 29/29 | Đạt |
| 10 | `forge test -vv` 53/53, `forge fmt --check` | 53 passed (4 suite), fmt exit 0 | Đạt |
| 10 | `scripts/verify` chạy độc lập | Ngày 14/11 trên chain dựng lại: exit 0, VERIFIED, 3 log, proposal 1 là 600.000 / 250.000 GOV (output ở mục "Chuẩn bị chain") | Đạt |
| 10 | `git status` chỉ thêm `frontend/`, báo cáo và thư mục ảnh | Xem mục "Kiểm tra cuối" | Đạt |

### Kết quả E2E lần chạy cuối (14/11/2026, code cuối cùng)

Lệnh `cd frontend && npx playwright test --workers=1` (đã `npx vite build` trước đó; không đặt `LD_LIBRARY_PATH`):

```
Running 12 tests using 1 worker
  ✓   1 e2e/01-wallet-states.spec.ts › máy tính không có window.ethereum: hướng dẫn cài MetaMask, vẫn xem được proposal
  ✓   2 e2e/01-wallet-states.spec.ts › điện thoại không có window.ethereum: hướng dẫn mở trong trình duyệt của app MetaMask
  ✓   3 e2e/01-wallet-states.spec.ts › sai chain: hiện cảnh báo, bấm nút thì gọi wallet_switchEthereumChain và cảnh báo biến mất
  ✓   4 e2e/01-wallet-states.spec.ts › người dùng từ chối ký (4001): thông báo tiếng Việt, trạng thái ERROR
  ✓   5 e2e/01-wallet-states.spec.ts › lỗi contract khi đọc: proposal không tồn tại → ProposalNotFound bằng tiếng Việt
  ✓   6 e2e/01-wallet-states.spec.ts › VITE_GOV_VOTE không có bytecode: hiện lỗi cấu hình thay vì dữ liệu rỗng
  ✓   7 e2e/02-flow.spec.ts › Alice delegate → tạo proposal → vote; tally khớp getProposal và scripts/verify
  ✓   8 e2e/03-xss.spec.ts › title <img src=x onerror=alert(1)> hiển thị nguyên văn, không chạy script
  ✓   9 e2e/04-screenshots.spec.ts › ảnh và bố cục ở 375×812
  ✓  10 e2e/04-screenshots.spec.ts › ảnh và bố cục ở 768×1024
  ✓  11 e2e/04-screenshots.spec.ts › ảnh và bố cục ở 1280×800
  ✓  12 e2e/04-screenshots.spec.ts › ảnh trạng thái ví: điện thoại không có ví, máy tính không có ví, sai chain
  12 passed (29.5s)
```

Giao dịch E2E của proposal #2 (14/11). Các hash trùng với lần chạy E2E đầu tiên ngày 12/11, vì trạng thái chain trước đó giống hệt:
- delegate `0x5165dd0380f7805662b947d6ac162873d812dc8327cb87783776a961289e4285`
- propose `0x943548f151cbdc51af9b01db533d1e74f99b75a3f248df8d2c4c827d79603b1f` (snapshot block 7.244)
- Alice For `0xd8353257169b7cd72b82938327e600f7e91a81193fdfd0c6f97be19d8b283db1`
- Bob Against `0xbb40ff84b12b3e0e1cc3c3e8ceda5cb13857981e86edbd62aa4a9d0a8e7e1af0`

`scripts/verify` bên trong E2E `02` (sau khi mine 13 block):

```
latest / head  : 7260 / 7248 (chờ 12 block xác nhận)
proposalCount  : 2 (tại head)
VoteCast logs  : 5 (block 0..7248)
 1 | 600.000 |     250.000 |   600.000 |       250.000 |   OK
 2 | 400.000 |     250.000 |   400.000 |       250.000 |   OK
VERIFIED
```

Sau E2E, chain có 3 proposal: #1 (lifecycle Bước 0, Succeeded), #2 (E2E `02`, Active), #3 (E2E `03`, title XSS, Pending).

### Kiểm ảnh bằng mắt (`docs/phase3-screenshots/`, 18 ảnh)

Lần chạy cuối (14/11): cả 18 ảnh đều có `scrollWidth ≤ innerWidth` và 0 nút hoặc link điều hướng thấp hơn 44px (đo tự động). Từng ảnh đã được mở để xem ở các lần chạy 12/11. Sau lần chạy 14/11, tôi mở lại `list-768x1024`, `list-375x812`, `detail-active-375x812` (nội dung đổi do chain mới): vẫn đạt.

| Ảnh | Kết quả kiểm bằng mắt |
|---|---|
| `list-375x812` | Thẻ xếp dọc; title XSS hiện nguyên văn; nhãn trạng thái không đè lên chữ. Đạt |
| `list-768x1024` | **Lần đầu không đạt**: cột tiêu đề chỉ còn khoảng 40px, chữ bị bẻ từng 2–3 ký tự. Đã sửa bảng (mục 4); ảnh mới đọc tốt. Đạt |
| `list-1280x800` | Bảng; nhãn trạng thái nằm trên một dòng (sau khi thêm `lg:whitespace-nowrap`). Đạt |
| `detail-375x812`, `detail-768x1024`, `detail-1280x800` | Proposal #1 Succeeded; địa chỉ người tạo tự xuống dòng; nút vote khóa và có lý do. Đạt |
| `detail-active-*` (3 ảnh) | Proposal Active; Charlie "Chưa" vote; hai nút For/Against bật; có "Còn N block tới deadline". Đạt |
| `create-*` (3 ảnh) | Ngưỡng 1.000 GOV và voting power `getVotes`; bộ đếm byte; nút gửi khóa khi chưa nhập title. Đạt |
| `wallet-*` (3 ảnh) | Ba con số tách riêng, giải thích tiếng Việt, nút delegate. Địa chỉ đầy đủ xuống dòng ở 375px. Đạt |
| `no-wallet-mobile-375x812` | Khung hướng dẫn 3 bước, deep link xuống dòng không tràn. Đạt |
| `no-wallet-desktop-1280x800` | Khung "Chưa phát hiện MetaMask". Đạt |
| `wrong-chain-375x812` | Khung đỏ "Ví đang ở sai mạng" và nút chuyển mạng. Đạt |

Chữ tiếng Việt có dấu hiển thị đúng. Ảnh ngày 14/11 dùng font khác ảnh ngày 12/11, vì lệnh cài thư viện hệ thống bằng sudo cài thêm font và Chromium chọn font mặc định khác. Bố cục không đổi.

## 3. Cấu trúc thư mục `frontend/`

```
frontend/
├── .env.example              Mẫu biến VITE_* (RPC, chainId, 2 địa chỉ) và cảnh báo VITE_* lộ ra trình duyệt
├── .env.local                (đã ignore) địa chỉ GovToken/GovVote của Anvil hiện tại
├── .gitignore                node_modules/, dist/, .env.local, test-results/, playwright-report/
├── index.html                Trang gốc (lang="vi", viewport cho điện thoại)
├── package.json              Script dev/build/preview/typecheck/test/test:e2e/sync-abi; phiên bản pin
├── package-lock.json         Khóa toàn bộ cây phụ thuộc
├── playwright.config.ts      Playwright: Chromium, chạy tuần tự, phục vụ bản build bằng vite preview :4173
├── tsconfig.json             TypeScript strict, moduleResolution bundler, noEmit
├── vite.config.ts            Vite (React + Tailwind) và cấu hình Vitest
├── scripts/sync-abi.mjs      Sinh src/abi/*.ts từ out/ của forge build, ghi nguồn và sha256
├── src/
│   ├── main.tsx              Khởi động: kiểm env, tạo wagmi config, Provider
│   ├── App.tsx               Khung trang: header, điều hướng, block hiện tại, ví, routing theo hash
│   ├── appContext.ts         Context cấu hình và hook useWallet (đã kết nối, sai chain, ghi được)
│   ├── config.ts             parseEnv (kiểm VITE_*), chain 31337 tự định nghĩa, wagmi config chỉ có injected
│   ├── errors.ts             Dịch 10 lỗi GovVote theo errorName, lỗi 4001, giữ nguyên lỗi lạ
│   ├── index.css             Nạp Tailwind CSS
│   ├── abi/govVote.ts        ABI GovVote (tự sinh, không sửa tay)
│   ├── abi/govToken.ts       ABI GovToken (tự sinh, không sửa tay)
│   ├── components/ui.tsx     Button (≥44px), Card, Notice, StateBadge, Stat, TxStatusView, Spinner
│   ├── components/ConnectBar.tsx   4 trạng thái ví: không ví điện thoại / máy tính, sai chain, kết nối
│   ├── components/ConfigGuard.tsx  Kiểm chainId của RPC, bytecode 2 contract, GovVote.token()
│   ├── lib/bytes.ts          Đếm byte UTF-8 bằng TextEncoder, kiểm form proposal
│   ├── lib/format.ts         formatGov (luôn có đơn vị GOV), rút gọn địa chỉ, nhãn trạng thái
│   ├── lib/power.ts          Tách số dư / voting power / người được ủy quyền, giải thích tiếng Việt
│   ├── lib/route.ts          Phân tích hash URL thành route
│   ├── lib/txMachine.ts      Máy trạng thái giao dịch (reducer thuần)
│   ├── lib/useTx.ts          Hook chạy giao dịch: gửi, chờ receipt, invalidate
│   ├── lib/useCurrentBlock.ts  Block mới nhất, dùng chung cho mọi lệnh đọc trong trang
│   ├── lib/walletEnv.ts      Phân loại môi trường ví, deep link MetaMask
│   └── pages/
│       ├── ProposalList.tsx     Danh sách: thẻ (<768px) / bảng (≥768px)
│       ├── ProposalDetail.tsx   Chi tiết, kết quả, mốc block, bỏ phiếu
│       ├── CreateProposal.tsx   Form tạo proposal, bộ đếm byte, khóa theo getVotes và threshold
│       └── WalletDashboard.tsx  balanceOf / getVotes / delegates và nút delegate cho chính mình
├── tests/errors.test.ts      Unit test errors.ts (đủ 10 lỗi, khớp ABI, 4001, lỗi lạ)
├── tests/lib.test.ts         Unit test byte, voting power, format, máy trạng thái, môi trường ví, env, route
└── e2e/
    ├── helpers.ts            Đọc .env.local, gọi RPC, anvil_mine, ví EIP-1193 giả (không có key)
    ├── 01-wallet-states.spec.ts   Trạng thái ví, từ chối ký, lỗi đọc, lỗi cấu hình
    ├── 02-flow.spec.ts            Kịch bản Alice/Bob và đối chiếu getProposal + scripts/verify
    ├── 03-xss.spec.ts             Title/description chứa HTML hiện nguyên văn
    └── 04-screenshots.spec.ts     18 ảnh, đo cuộn ngang và chiều cao nút
```

## 4. Các quyết định tự làm và lý do

1. **Tự viết khung thay vì `npm create vite`.** `create-vite` sinh `package.json` dùng `^`, trái quy tắc pin phiên bản.
2. **Phiên bản: bản stable mới nhất phát hành trước 29/10/2026.** wagmi giữ ở `2.19.5`, bản cuối của nhánh v2, theo quyết định đã chốt. `@types/node` dùng nhánh 24 để khớp Node v24. Cài với `--ignore-scripts`.
3. **Routing theo hash (`#/...`), không thêm thư viện router.** Chạy được trên mọi hosting tĩnh và bớt một phụ thuộc.
4. **Mọi lệnh đọc trong một trang dùng cùng `blockNumber`.** Đây là nguyên tắc "so sánh tại cùng một block" của Phase 2B, để state, tally, hasVoted và voting power là một ảnh chụp nhất quán.
5. **`simulateContract` trước khi `writeContract`.** Revert được giải mã theo ABI trước khi ví hiện hộp ký, nên lỗi luôn có `errorName`.
6. **Nút tạo proposal so `getVotes(ví)` với `proposalThreshold`** (thay cho `getPastVotes(ví, block − 1)` ở bản đầu). Giao dịch sẽ nằm ở block kế tiếp nên contract đọc voting power ở cuối block hiện tại; `getVotes` cho đúng giá trị đó. Contract vẫn quyết định cuối cùng; nếu revert `BelowThreshold` thì lỗi hiện bằng tiếng Việt.
7. **Quorum lúc Pending hiển thị "ước tính".** Tính từ `totalSupply × quorumBps` làm tròn lên, vì `quorumVotes` revert `SnapshotNotFinalized` trước snapshot (đặc tả mục 3.6).
8. **Giới hạn độ dài title/description đọc từ `MAX_TITLE_BYTES` / `MAX_DESCRIPTION_BYTES` của contract**, giống cách đọc `proposalThreshold`.
9. **Không chuẩn hóa Unicode khi đếm byte.** Chuỗi gửi lên contract chính là chuỗi đã đếm. Unit test ghi lại trường hợp "ệ" dạng NFD là 5 byte.
10. **Tắt EIP-6963 discovery, chỉ dùng `window.ethereum`.** Tránh hiện ví lạ; đúng phạm vi "MetaMask trên máy tính".
11. **Kiểm thêm `GovVote.token()` bằng `VITE_GOV_TOKEN`** trong `ConfigGuard`, để không đọc nhầm token.
12. **Sửa bảng danh sách ở 768px.** Khi tự mở ảnh, tôi thấy `table-fixed` với các cột cố định chỉ để lại khoảng 40px cho tiêu đề. Đổi sang `table-auto`, tiêu đề có `min-w-48`, các cột số không xuống dòng. Thêm `lg:whitespace-nowrap` cho nhãn trạng thái. Đo tự động (`scrollWidth`) không bắt được lỗi này, chỉ kiểm bằng mắt mới thấy.
13. **Thư viện hệ thống cho Chromium.** Lần đầu (12/11), Chromium thiếu `libnspr4`, `libnss3`, `libasound`. Ngày 14/11, bạn đã cài bằng `sudo`. `ldd` không còn báo thư viện nào thiếu, và mọi lần chạy Playwright cuối cùng đều **không** đặt `LD_LIBRARY_PATH`. Cách tạm thời dùng ở lượt trước (giải nén gói apt vào thư mục tạm) đã bỏ; thư mục đó không còn.
14. **Ba lần sửa test E2E, đều do lỗi trong test, không phải trong app:**
    - (a) Con số kỳ vọng "29/100 byte" bị đếm nhầm; chuỗi đúng là 28 byte (Python và TextEncoder đều cho 28).
    - (b) Locator `.first()` trúng thẻ điện thoại đang ẩn ở 1280px.
    - (c) Điều kiện "đúng 1 phần tử" sai khi chạy lại test nhiều lần, đổi sang kiểm đúng link của proposal vừa tạo.
    - Hàm dựng lỗi trong `errors.test.ts` lúc đầu thiếu `args`.
    - Không assertion nào bị nới.

## 5. Giới hạn

- **Chỉ chạy trên Anvil local.** Chưa có Sepolia, chưa có link explorer, chưa deploy hosting.
- **Chain demo là tạm thời.** Anvil chạy trong bộ nhớ; tắt Anvil là mất toàn bộ chain (đã xảy ra ngày 12/11, xem mục "Chuẩn bị chain"). Mỗi lần khởi động lại phải chạy lại Bước 0. Địa chỉ deploy không đổi vì cùng deployer và nonce.
- **Ví trên điện thoại chưa được kết nối trực tiếp.** Mới chỉ có hướng dẫn mở trong trình duyệt MetaMask. Điện thoại cũng không truy cập được Anvil `127.0.0.1` của máy tính. WalletConnect thuộc v2.
- **E2E tạo thêm proposal mỗi lần chạy** (#2, #3…), vì chạy trên chain thật và không reset. Test dùng id của proposal vừa tạo nên chạy lại vẫn đúng.
- **E2E dùng ví giả, không phải MetaMask thật.** Ví giả trả lời các method ví và chuyển tiếp `eth_*` tới Anvil, nên không kiểm được hộp thoại của MetaMask, cách MetaMask ước tính gas, hay `wallet_addEthereumChain` khi ví chưa biết chain (lỗi 4902). Luồng 4902 dựa vào hành vi của wagmi.
- **Chạy E2E trên máy khác cần cài thư viện hệ thống cho Chromium** (`sudo npx playwright install-deps chromium`) và Anvil đã dựng chain như Bước 0.
- **Test lỗi đọc mất khoảng 7,6 giây** vì TanStack Query mặc định thử lại 3 lần trước khi báo lỗi.
- **Bundle 617 kB** (gzip 184 kB), Vite có cảnh báo chunk lớn hơn 500 kB.
- **Kiểm tra trước ở UI không thay thế contract.** Trạng thái có thể đổi giữa lúc kiểm tra và lúc giao dịch vào block; khi đó contract revert và lỗi hiện bằng tiếng Việt.

## Bảo mật phụ thuộc

`npm audit` (ngày 12/11/2026) trên `frontend/`: **27 lỗ hổng: 16 high, 11 moderate, 0 critical. Không gói nào là phụ thuộc trực tiếp**, trừ chính `wagmi` được đánh dấu vì kéo theo các gói dưới.

| Nguồn gốc | Gói bị báo |
|---|---|
| `@wagmi/connectors` 6.2.0 (đi kèm wagmi 2.19.5) | `@reown/appkit*`, `@walletconnect/*`, `@metamask/sdk`, `@metamask/sdk-communication-layer`, `@metamask/utils`, `@metamask/rpc-errors`, `@gemini-wallet/core`, `@coinbase/cdp-sdk`, `uuid`, `query-string`, `decode-uri-component` |
| viem và các gói nó kéo theo | `ws` (lộ bộ nhớ chưa khởi tạo, DoS), `abitype` và `zod` (cạn bộ nhớ khi kiểm tập dữ liệu lớn), và chính `viem` vì phụ thuộc chúng |

**Cách sửa npm đề xuất:** nâng lên `wagmi@3.7.11`, tức đổi major version. Điều này trái quyết định đã chốt "wagmi v2", nên **chưa làm**. Bản viem mới hơn (2.57.19) phát hành ngày 12/11/2026, chưa đủ 14 ngày.

**Kiểm bundle production** (`dist/assets/index-*.js`): không có code của `@reown`, `@metamask/sdk`, `cbw-sdk`, `safe-apps`, `@gemini-wallet`, `porto` hay `zod`. Hai chữ "walletconnect" và "coinbase" xuất hiện chỉ là chuỗi tên: class lỗi `WalletConnectSessionSettlementError` của viem, và bảng target `coinbaseWallet` của connector `injected`. Như vậy các SDK có lỗ hổng **chỉ nằm trong `node_modules`** (môi trường dev), không chạy trên trình duyệt người dùng. Riêng viem thì có trong bundle; lỗ hổng `ws` chỉ liên quan WebSocket ở Node, còn app dùng HTTP transport.

**Để quyết định ở Phase 4:** nâng wagmi v3 (đổi API connector và hook), hoặc giữ v2 kèm ghi nhận rủi ro; và cập nhật viem khi bản sửa đủ 14 ngày.

## 6. Việc để sang Phase 4

1. Quyết định về `npm audit`: wagmi v3 hay giữ v2 (mục Bảo mật phụ thuộc).
2. Sepolia: thêm chain 11155111 vào cấu hình (hiện `parseEnv` chỉ chấp nhận 31337); link Etherscan cho tx hash và địa chỉ; verify source trên Etherscan.
3. Ký deploy Sepolia bằng `cast wallet` (keystore) và ví deployer riêng (threat model).
4. Deploy frontend tĩnh (đặc tả nhắc Cloudflare Pages); RPC công khai có giới hạn tốc độ, cân nhắc retry/fallback.
5. CI: chạy `npm run typecheck`, `npm test`, `npm run build`, cài `playwright install-deps` trên runner rồi chạy E2E với Anvil; thêm `forge snapshot --check`.
6. Giảm kích thước bundle (tách chunk, nạp động phần ghi giao dịch).
7. Đặt `retry` hợp lý cho lỗi revert khi đọc (không thử lại lỗi contract).
8. Kiểm thử với MetaMask thật, gồm luồng `wallet_addEthereumChain` (4902) và trình duyệt trong app MetaMask trên điện thoại khi đã có RPC công khai.
9. Sửa `README.md` (bản mẫu `forge init` còn ví dụ `--private-key`), thêm hướng dẫn chạy frontend.

## Kiểm tra cuối (Bước 10), ngày 14/11/2026

```
unset LD_LIBRARY_PATH; cast chain-id          → 31337
free -h                                         → Mem 7.4Gi, available 3.7Gi; Swap 2.0Gi
cd frontend && npx playwright --version         → Version 1.64.1 (Chromium 156.0.8078.4 chạy được, ldd: 0 thư viện thiếu)
scripts/verify (độc lập, sau Bước 0)            → VERIFIED, exit 0, 3 log, 600.000 / 250.000 GOV
npx playwright test --workers=1                 → 12 passed, 0 failed (29.5s)
npm run typecheck                               → exit 0
npm run build                                   → exit 0 (index-*.js 617,42 kB, gzip 184,44 kB)
npm test (Vitest)                               → Test Files 2 passed, Tests 29 passed
forge test -vv                                  → 53 tests passed, 0 failed (4 suite)
forge fmt --check                               → exit 0
git status --short                              → ?? .github/  ?? README.md  ?? docs/phase3-frontend-report.md
                                                  ?? docs/phase3-screenshots/  ?? frontend/
                                                  (không có node_modules/, dist/, .env.local, test-results/)
```

## Bảng trạng thái

| Bước | Trạng thái |
|---|---|
| 0. Chuẩn bị chain | PASS (dựng lại 14/11, verify độc lập VERIFIED) |
| 1. Tạo `frontend/` | PASS |
| 2. ABI từ build | PASS |
| 3. Kết nối ví và mạng | PASS (E2E 01, ảnh trạng thái ví) |
| 4. Đọc dữ liệu | PASS (E2E 02, ảnh list/detail/wallet) |
| 5. Ghi giao dịch | PASS (E2E 02: delegate, propose, vote) |
| 6. Lỗi tiếng Việt | PASS (unit test và E2E 01) |
| 7. An toàn hiển thị | PASS (E2E 03 và grep) |
| 8. Responsive | PASS (18 ảnh, đo tự động và kiểm bằng mắt; đã sửa bảng ở 768px) |
| 9. Kiểm thử | PASS (unit 29/29, E2E 12/12) |
| 10. Kiểm tra cuối | PASS |


## P3-FIX-01 — RPC Error Handling & Account Switching Safety (14/11/2026, Codex)

**PASS_CANDIDATE**, chờ Owner/Reviewer nghiệm thu; không có nghĩa toàn bộ Phase 3 đã hoàn tất đặc tả. Các output E2E, ảnh và giao dịch ở trên là bằng chứng lịch sử, chưa chạy lại sau bản sửa này.

### Root cause và sửa đổi

- ConfigGuard từng không kiểm lỗi bytecode/token read; token read lỗi có thể spinner vô hạn. Dashboard và một số query ở các trang cũng thiếu error branch. Nay mọi query liên quan có thông báo lỗi và nút Thử lại; bytecode rỗng được phân biệt lỗi RPC; batch read lỗi không bị bỏ qua. BlockGuard hiển thị lỗi đọc block kể cả khi có cache.
- `keepPreviousData` không phân biệt thay block với thay account. Nay bỏ placeholder và remount phần nội dung theo kết nối/account/chain; read luôn pin chain cấu hình, không đi theo chain vừa chuyển trong ví.
- Async simulate/receipt từng không kiểm phiên ví. Nay guard kiểm account/chain và thế hệ phiên trước write, sau send và receipt; watchAccount/unmount vô hiệu hóa kết quả cũ, bao gồm đổi A→B→A. Kết quả cũ không gọi callback thành công ở phiên mới. Receipt pin chain; có khóa chống send trùng trong một hook.
- Timeout HTTP 8 giây; HTTP không retry tự động; query thử lại tối đa một lần sau 500ms và có retry thủ công. Không thêm/nâng dependency hoặc đổi contract.

### Bằng chứng kiểm chứng

Dùng binary Node Linux có sẵn trong `/home/tienm/.nvm/versions/node/v24.19.0/bin` trên PATH:

```text
npm --prefix frontend run typecheck : exit 0
npm --prefix frontend test          : 5 files passed, 51 tests passed
npm --prefix frontend run build     : exit 0 (619,49 kB / gzip 185,03 kB JS chính)
git diff --check                   : exit 0
```

Không có lint script. 29 test cũ giữ nguyên; 22 test mới ở `rpc.test.ts`, `session.test.ts`, `transport.test.ts` kiểm lỗi đọc/revert, connection refused, timeout, bytecode rỗng, retry, account/disconnect/chain, request cũ hoàn tất muộn. Timeout test thực thi transport viem với mock fetch tuân thủ AbortError; assert chưa timeout ở 7.999ms, đã lỗi ở 8.001ms và chỉ gọi HTTP một lần. Các lỗi ban đầu trong test harness đã được giải thích trong phiên và sửa; không nới assertion timeout hoặc sửa test cũ.

### Giới hạn và bàn giao

Tests render server không thay thế browser integration; guard thuần chưa phải thao tác account switching trong MetaMask thật. Chưa chạy E2E/browser, đo responsive lại hoặc gửi giao dịch. Popup ký đã mở và giao dịch đã broadcast không thể bị thu hồi bởi guard UI. Cảnh báo bundle >500kB và dependency audit cũ vẫn còn. Các thiếu sót v1.1 ngoài P3-FIX-01 chưa triển khai. Chưa commit/push/deploy; chờ Mạnh và ChatGPT nghiệm thu.


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



## P3-FIX-03B — Verification Core, CLI, Browser, UI (14/11/2026)

**PASS_CANDIDATE — chờ Owner/ChatGPT nghiệm thu.** Owner đã phê duyệt đưa phần còn thiếu mục 4.5 vào Phase 3. P3-FIX-01 ACCEPTED; P3-FIX-02 ACCEPTED WITH DOCUMENTED LIMITATIONS. Không tự đóng toàn bộ Phase 3 hoặc triển khai P3-FIX-04.

### Kiến trúc thực tế

```text
shared/verification/core.ts        pure evidence validator/types/bigint
shared/verification/runner.ts      một proposal, budget, range, anchor, phân loại
shared/verification/http.ts        whitelist RPC read-only + AbortSignal
              ↑                       ↑
CLI adapter (viem 2.57.11)     browser adapter (viem 2.57.13)
main.ts / legacy-main.ts       useVoteVerification → VerifyProposal
```

Không thêm dependency hoặc backend. Dùng ABI generated có sẵn; codec ngoài core nên không khóa core vào phiên bản viem. `fixtures.ts` chỉ phục vụ test, không import vào UI production. CLI syntax, env budgets và exit codes được ghi ở đầu docs/phase2b-verify-report.md; phần cũ ở tài liệu đó được giữ như lịch sử legacy.

### Verification theo mục 4.5

- Input ID uint256, Anvil chain31337, confirmations mặc định12, hợp lệ>=1. Chọn H=latest−C; dữ liệu contract pin H, chốt hash trước/sau.
- Kiểm bytecode GovVote/token, token liên kết và expected address nếu cung cấp; xác định createdBlock từ storage, đối chiếu ProposalCreated và hash block tạo proposal. Đây là local deployment evidence, không Etherscan source verification.
- Chỉ VoteCast của proposal được chọn, từ createdBlock tới H. Raw logs decode strict và kiểm metadata; không âm thầm loại log malformed. Sort block/txIndex/logIndex; dedupe cùng log trước khi kiểm voter trùng. Kiểm xung đột vị trí log/transaction trong cùng block.
- Tính lại tally/participation; quorum từ getPastTotalSupply(snapshot) đọc tại H và quorumBps; ceil bằng bigint. Expected state tính bằng tally event, tuân thủ Pending N<=snapshot, Active snapshot<N<=deadline, cuối cùng từ deadline+1. So với state/quorum/tally contract.
- Không missing→0; chưa đủ evidence/ranges/snapshot/anchor => INCOMPLETE. RPC failure/timeout => RPC_ERROR. Mâu thuẫn => MISMATCH. Snapshot Pending không VERIFIED. Active sau snapshot có thể VERIFIED tại H, nhãn chưa phải kết quả cuối.
- UI `#/verify/:id` hỗ trợ ID uint256 không ép Number, link từ trang chi tiết. Trang verify tự kiểm RPC/provenance nên không bị ConfigGuard/BlockGuard của màn hình khác che lỗi verification. Không cần ví/signer.
- Có overview, H/hash/time/C/RPC origin, event/storage tally, historical supply/quorum, expected/on-chain state, verdict/reason, Verify/Retry/progress và lệnh CLI. Không có explorer link giả.
- Hook dùng key ID/RPC/address/chain/confirmations và generation/AbortController: đổi context xóa verdict cũ ngay khi render; completion cũ không cập nhật phiên mới. Verdict là point-in-time, không tự xác nhận lại mỗi block.

### Status/exit policy

VERIFIED/MISMATCH/INCOMPLETE/RPC_ERROR/INVALID_INPUT tách biệt governance state; IDLE/RUNNING phục vụ UI. Exit CLI tương ứng0/1/3/2/2. Không có GOV_PROPOSAL_ID thì entry point chạy legacy tally, in banner rõ giới hạn; legacy functions/tests không được dùng làm bằng chứng strict verifier. Không sửa tests cũ để PASS.

### Test evidence

| Check | Kết quả trong phiên |
|---|---|
| Frontend typecheck | PASS exit0, gồm shared code, UI và validation |
| CLI typecheck | PASS exit0 |
| Vitest | **127/127 PASS, 8 file**, 67 trước đó giữ nguyên +60 core/runner/route mới |
| CLI tests | **17/17 PASS**, 9 legacy +8 strict, gồm HTTP entry point và exit/redaction |
| Playwright full validation | **34/34 PASS, 58,7s**, gồm 18 ca cũ và16 Verification UI |
| Verification UI chạy lại sau hardening metadata | **16/16 PASS, 24,8s** |
| Production build | PASS, JS chính646,54kB/gzip193,53kB; cảnh báo>500kB giữ nguyên |
| Foundry | **53/53 PASS**, 4 suite; fuzz1000 runs và invariant256 runs/depth50 |
| forge fmt --check | PASS exit0 |
| forge build --sizes | PASS; GovToken6846B/GovVote4603B runtime |
| git diff --check | PASS; kiểm untracked văn bản riêng, không chỉ dựa tracked diff |

Foundry có cảnh báo không ghi được signature cache ngoài workspace (read-only filesystem); build/test vẫn exit0, không đổi sandbox/quyền để ghi cache đó. CLI fixture chạy ngoài sandbox để bind localhost, không phải blockchain.

Core/runner tests bao phủ match/mismatch tally-quorum-state, missing/duplicate logs, voter trùng, ID/contract sai, timeout/failure/retry, proposal chưa đủ confirmations tại H, Pending/Active/Succeeded/Defeated, boundary snapshot/deadline/quorum, bigint lớn, reorg/hash đổi, maxRequests/maxLogs/maxDuration/history ranges, request cũ bị hủy, malformed event, missing storage, invalid config và redaction RPC origin.

Browser cases mới (16): VERIFIED không ví; RPC_ERROR/Retry; thiếu ProposalCreated; thiếu votes làm tally mismatch; malformed event; reorg; Pending; progress trước verdict; completion cũ sau lần mới; đổi route; đổi confirmations/reference; timeout hữu hạn; VERIFIED cho Defeated; responsive3kích thước. Các tests P3-FIX-01/02 giữ nguyên.

### Bằng chứng Anvil thật — chỉ đọc

Strict CLI bản cuối proposal#1: **VERIFIED**, chain31337, latest7261/H7249, C12, hash `0x5d47b51cfd5f8dc19b9d41a1d2555016ee3f01ff61c2236321131ffd12dce90d`.

- For event/storage600.000 GOV; Against250.000 GOV; participation850.000 GOV.
- Snapshot26/deadline7226; historical supply1.000.000 GOV; quorum bps1000, calculated/contract100.000 GOV.
- Expected/contract Succeeded;3 unique VoteCast;18requests,4logs kể cả ProposalCreated; latest sau đọc7261.
- Full JSON: docs/phase3-verification-evidence.json (timestamp UTC trong file; ngày local14/11/2026).
- UI bản build được mở bằng Chromium thật ở1280×800, Verify#1 cũng VERIFIED và hiển thị cùng tally/state. One-off test chặn mọi network method ngoài eth_blockNumber/eth_chainId/eth_getBlockByNumber/eth_getCode/eth_call/eth_getLogs. Không có request ngoài whitelist; không ví/ký/gửi giao dịch. Ảnh: docs/phase3-screenshots/p3-fix-03-anvil-live-1280.png.

### Responsive và ảnh

Ba browser mock tests kiểm375×812,768×1024,1280×800: không cuộn ngang, button/input>=44px. Đã mở ba ảnh mock và ảnh live để xem bố cục. Ảnh mock `p3-fix-03-verify-375.png`, `-768.png`, `-1280.png` lưu ở docs/phase3-screenshots; số nhỏ trong mock là wei fixture, không giả làm on-chain. Ảnh fullPage có chiều cao lớn hơn viewport. Không ghi đè ảnh cũ.

### Resource limits và giới hạn còn lại

Mặc định200RPC requests (bao gồm retry),50000logs (gồm creation/duplicates),60giây, range<=10000block, logical concurrency1, retry1/request, timeout8giây/request; cấu hình budget trong strict CLI, browser dùng default. Quá budget=>INCOMPLETE; không tăng vô hạn hoặc polling quét lại tự động. HTTP bị abort khi timeout/cancel; không bảo đảm server RPC dừng mọi công việc đã nhận.

RPC trust, ABI/source provenance local, chưa đối chiếu weight từng voter/getPastVotes, reorg sau verdict, và payload JSON không streaming-limited vẫn là giới hạn đã biết. Không tuyên bố audit/source-verified hoặc finality tuyệt đối. Chưa benchmark RPC công khai, chưa Sepolia, chưa kiểm chứng runtime thay RPC config trong browser (key/reset đã review code, đổi reference policy/route đã browser test). Build vẫn có chunk warning và dependency audit cũ chưa giải quyết. Không thêm fallback/indexer/backend hoặc thay governance.

### File scope và trạng thái

Thêm4 file shared;7 file frontend (adapter/hook/page,3 test/fixture,1 browser spec);4 file CLI (adapter,legacy-main,strict test,fixture);4 PNG và1JSON evidence. Sửa main.ts, App.tsx, route.ts, ProposalDetail.tsx và3 tài liệu liên quan. Không đổi Solidity, Solidity tests/invariant, ABI generated, deploy script, dependency/lockfile hoặc các tests trước đây. CLAUDE.md/AGENTS/README/workflow và mọi thay đổi bàn giao khác giữ nguyên.

Chưa commit/push/deploy/broadcast. Dừng chờ Mạnh/ChatGPT review P3-FIX-03B; không triển khai P3-FIX-04.



## P3-FIX-04 — Frontend Data Reliability (14/11/2026, Codex)

**PASS_CANDIDATE — chờ Mạnh/ChatGPT nghiệm thu.** P3-FIX-03B đã được Owner nghiệm thu local với giới hạn ghi nhận. Không tự đóng Phase3 hoặc bắt đầu Phase4.

### Đối chiếu đặc tả 5.1–5.4

| Requirement | Trước bước04 | Sau triển khai |
|---|---|---|
| RPC chính/fallback, retry hữu hạn (5.3) | Có timeout/retry, chưa fallback | Fallback opt-in, kiểm chain/code/token, đổi phiên/cache khi đổi endpoint |
| Block/chain/thời điểm cập nhật (5.3) | Có block/chain, thiếu timestamp thành công | Timestamp từ query dataUpdatedAt và block lần đọc đủ thành công; loading/refreshing/stale/error |
| Voting power dự kiến khi Pending (5.1) | Chỉ ghi chưa chốt | getVotes tại block đang đọc, nhãn dự kiến và cảnh báo có thể đổi |
| Error/retry và account change (5.2–5.4) | P3-FIX-01 đã có | Giữ guard; thêm reset context endpoint/freshness và test late response |
| Proposal filtering (5.1) | Trong trang10ID, đã ACCEPTED WITH LIMITATIONS | Giữ nguyên; PDF không ấn định global filtering, UI tiếp tục ghi rõ phạm vi |

Filter toàn lịch sử, tự failback định kỳ, indexer/backend mới không phải phần bắt buộc được triển khai ở bước này. Không thay governance.

### RPC fallback và cấu hình

- `VITE_RPC_URL` giữ primary; thêm tùy chọn `VITE_RPC_FALLBACK_URLS`, danh sách URL cách nhau dấu phẩy, tối đa2fallback (3nguồn tổng cộng), dedupe. `.env.example` để trống, **không điền endpoint thật thay Owner**, không sửa .env.local.
- URL phải HTTP(S), không username/password/fragment. VITE_* là dữ liệu công khai; chỉ cấu hình endpoint Owner cho phép, rồi build lại.
- Nếu không có fallback, không chạy thêm probe/bootstrap; giữ cơ chế đọc primary hiện tại.
- Khi có fallback: probe lần lượt primary→fallback. Mỗi candidate kiểm eth_chainId31337, bytecode GovVote/GovToken và GovVote.token() bằng ABI. Probe timeout8s/request, tối đa4read/candidate; không retry probe vô hạn. URL sai chain không được đọc tiếp bytecode/data.
- SessionApp tạo WagmiProvider/QueryClient riêng theo endpoint/epoch. Transport error kích hoạt chuyển sang candidate kế tiếp một lần; contract revert không tự chuyển nguồn. Khi đổi nguồn, nội dung cũ bị tháo, không dùng cache/tx hooks cũ cho phiên mới. Callback probe/response cũ bị generation/abort guard chặn.
- Banner hiển thị primary/fallback và RPC origin, có nút Thử lại RPC chính. Hết candidate: thông báo không còn endpoint khả dụng; phục hồi do người dùng yêu cầu, không có vòng failback tự động.
- Các read đã gửi của phiên thường có thể hoàn tất muộn; chúng không cập nhật cache/hiển thị của session mới. Probe/verification có AbortSignal; không bảo đảm server dừng mọi công việc đã nhận.

### Verification không trộn nguồn

`frontend/src/lib/verificationFallback.ts` bọc browser adapter; **không sửa shared core/runner hoặc CLI**. Mỗi source chạy runVerification từ đầu, tự chọn H/hash, đọc creation/logs/storage/quorum/state và kiểm lại anchor. Chỉ failover sau RPC_ERROR hoặc endpoint sai chain/không có code; MISMATCH/INCOMPLETE về evidence không bị che bằng thử nguồn khác.

Ngân sách requests/logs/thời gian còn lại được trừ sau từng attempt; không reset budget để thử vô hạn. Progress thể hiện attempt hiện tại, không cộng evidence từ lần trước. UI xóa result khi bắt đầu source mới và overview ghi RPC source của chính result. Primary luôn được thử trước khi Verify, kể cả session đọc thông thường đang ở fallback. Banner giải thích nguồn verification riêng.

Nếu phiên đọc thông thường đổi nguồn làm provider bị remount trong lúc verify, lần cũ bị hủy và UI mới về IDLE; người dùng bấm Verify lại. Không giữ badge VERIFIED cũ hoặc ghép data để tự kết luận. CLI vẫn strict một nguồn như03B, không thêm fallback CLI.

### Data freshness

- `freshness.tsx` lấy timestamp từ dataUpdatedAt của các query bắt buộc đã đọc đủ thành công, không dùng Date.now làm timestamp giả. Timestamp là lần hoàn tất đọc (query cuối trong nhóm), ISO UTC/Z, không phải thời gian hiện tại/finality.
- Có data-state loading/refreshing/stale-error/ready (giá trị kỹ thuật stale/error); nhãn UI tiếng Việt. Error hoặc refresh chưa đủ không tiến timestamp. Hiển thị block của lần thành công, không gắn timestamp cũ với block mới.
- Memory được scope theo endpoint/account/trang; App/session key bảo vệ account/chain/endpoint. Đổi scope không dùng timestamp A như của B. Query disabled (ví chưa kết nối, quorum Pending hoặc chain rỗng) không ngăn nhóm query thực sự cần đọc hoàn tất.
- Có trên list/detail/create/dashboard, gồm nhánh loading/error. Khi generic guard hoặc endpoint boundary chặn trang, timestamp trang bị ẩn; không giả làm dữ liệu vừa thành công. Verification chỉ ghi thời điểm hoàn tất thành công trong phiên khi verdict VERIFIED.

### Expected voting power

Pending đọc GovToken.getVotes(address) tại block hiển thị, không dùng balance. Giá trị ghi rõ “dự kiến, chưa chốt”, giải thích có thể thay đổi trước snapshot. Sau snapshot dùng getVotingPowerAt/getPastVotes của proposal như trước, không dùng giá trị dự kiến để bật vote khi Pending. Browser chứng minh A111.000→B222.000 GOV dự kiến, rồi historical60.000 GOV sau snapshot; sai chain vẫn khóa vote.

### Kiểm thử và bằng chứng

| Check | Kết quả |
|---|---|
| Frontend typecheck | PASS exit0 |
| Frontend Vitest | **137/137 PASS**,9file;127trước giữ nguyên +10reliability mới |
| CLI strict/legacy | **17/17 PASS**, source/tests không sửa ở04 |
| Playwright production validation | **34/34 PASS**,58,7s, giữ nguyên toàn bộ cases01/02/03 |
| Playwright reliability profile | **11/11 PASS**,12,1s |
| Responsive cuối sau sửa nhãn/khoảng cách link | **3/3 PASS**,375×812/768×1024/1280×800 |
| Production build | PASS, JS chính653,19kB/gzip195,52kB; giữ cảnh báo>500kB |
| Foundry | **53/53 PASS**,4suite, không sửa Solidity |
| forge fmt --check / build --sizes | PASS; signature cache ngoài workspace vẫn read-only warning, không ảnh hưởng exit0 |
| git diff --check + rà untracked | PASS; không generated build/dependencies lọt danh sách commit |

Unit reliability: cấu hình fallback URL; primary ưu tiên/fallback hữu hạn; probe sai chain; freshness không tiến khi error/fetch/placeholder; reset account/chain/endpoint; strict verification restart nguồn mới; không che MISMATCH; probe cũ bị hủy.

Browser cases mới: primary tốt không gọi fallback; primary lỗi→fallback→manual recover; cả hai lỗi; fallback sai chain (chỉ eth_chainId); strict verification đọc lại context/evidence nguồn mới; freshness giữ nguyên khi đồng hồ chạy/error và cập nhật sau retry; Pending/current vs historical/account/chain;3responsive; late primary không ghi đè fallback.

Lệnh:
- `npm --prefix frontend run typecheck`, `npm --prefix frontend test`, `npm --prefix frontend run build`.
- Từ frontend: `node node_modules/@playwright/test/cli.js test --config playwright.validation.config.ts` (production profile).
- Reliability: `node node_modules/@playwright/test/cli.js test --config playwright.reliability.config.ts`. Config này build vào /tmp riêng với primary.invalid/fallback.invalid **chỉ là endpoint fixture bị route mock**. Không đổi production dist/.env.local, không forward network tới các domain đó. validation config cũ chỉ tách profile mới ra; không bỏ/sửa assertion test cũ.
- CLI: từ scripts/verify, `node --import tsx --test --test-isolation=none test/verify.test.ts test/strict.test.ts`.
- Browser/CLI localhost fixtures chạy ngoài sandbox vì sandbox chặn loopback; không gọi Anvil/Sepolia hoặc gửi giao dịch. Foundry chạy EVM test cô lập.

Ảnh mới (mock, không on-chain): docs/phase3-screenshots/p3-fix-04-pending-375.png, -768.png, -1280.png. Đã mở kiểm bố cục; dữ liệu/URL là fixture. Không cuộn ngang; có fallback banner, timestamp và expected power. FullPage nên ảnh cao hơn viewport.

### Giới hạn và scope

Chưa có fallback RPC thật do Owner cung cấp, nên multi-endpoint integration chỉ xác minh bằng mocks; production để fallback trống. Probe chain/code/token không chứng minh source bytecode chính xác hoặc RPC trung thực. Failover/probe có thể mất hơn8giây vì nhiều read/candidate và candidate kế tiếp; hữu hạn, không retry vô hạn. Timestamp không phải chứng nhận chain finality; khi trang bị unmount không giữ history timestamp cũ. Core03B và các giới hạn RPC trust/weight/reorg/JSONpayload giữ nguyên. Filter vẫn trong trang; bundle warning/dependency audit cũ chưa giải quyết. Không nâng/cài dependency, không sửa contract, delegation hoặc voting rules.

Thêm8file frontend: ReliableApp, endpoint, freshness, verificationFallback, reliability.test, reliability config, fallback-server và p3-fix-04 spec; thêm3PNG. Sửa các source/config/test config liên quan, .env.example và2tài liệu này. Không sửa shared verification, CLI, tests cũ, file tracked hoặc .env.local trong04. Các3tracked modified thuộc checkpoint trước giữ nguyên. Không stage/commit/push/reset/seed/deploy/broadcast. Dừng chờ Owner/ChatGPT; không tự đóng Phase3/chuyển Phase4.


## P3-FINAL-01 — Full Regression, Security & Pre-commit Review (14/11/2026, Codex)

**Đề xuất: READY_FOR_COMMIT_REVIEW, phạm vi local Phase 3.** Đây là kết quả kỹ thuật để Owner/ChatGPT nghiệm thu, không phải Owner đã chấp thuận commit hoặc public deployment. P3-FIX-01 ACCEPTED; 02/03B/04 ACCEPTED WITH LIMITATIONS theo chỉ thị Owner của nhiệm vụ này. Những checkpoint PASS_CANDIDATE phía trên là lịch sử trước quyết định đó.

### A. Repository State

Preflight: main, HEAD `c9240a57bf6ba8bcb8152b41a0909d7a99dab188`, 108 untracked, 3 tracked modified, index rỗng, khớp yêu cầu. Đã đọc AGENTS/CLAUDE/PROGRESS, PDF v1.1 (4.5,5.1–5.4), các báo cáo Phase 1/2 và source frontend/shared/CLI. Không sửa contract, test contract, dependency/lockfile, cấu hình .env.local, template hoặc chain 8545. Frontend/shared vẫn chưa commit.

Sơ đồ phạm vi:

```text
frontend/ (React, viem, injected wallet)
  ├─ normal reads → endpoint probe / scoped cache / freshness
  └─ Verification UI → frontend adapter → shared/verification/{runner,core,http}
scripts/verify/ → strict adapter → cùng shared runner/core
                 legacy adapter → tally-only (banner phân biệt)
docs/phase3-final-evidence/ + phase3-screenshots/p3-final-*/ → bằng chứng mới
```

### B. Specification Compliance — requirement traceability matrix

PASS dưới đây chỉ áp dụng local Anvil được Owner chấp thuận. PARTIAL giữ đúng ngoại lệ đã ghi nhận, không sửa nội dung PDF để kết luận đáp ứng public deployment.

| Spec | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| 5.1–5.2 | Connect/disconnect, xem không ví | ConnectBar, injected connector; đọc RPC độc lập wallet | Original01, validation01 | PASS (mock EIP-1193) |
| 5.2,5.4 | Sai chain chặn ghi, switch | canWrite, useTx/assertCurrent, banner | Original01, validation01/04 | PASS local; Sepolia NOT VERIFIED |
| 5.1–5.2 | balance/votes/delegates và delegate | WalletDashboard, simulate→write→receipt | Original02, ảnh dashboard | PASS |
| 5.1,5.4 | Threshold, title/description UTF-8 | CreateProposal, TextEncoder, giới hạn đọc contract | Vitest, Original02/03 | PASS |
| 5.1 | List title/state/tally/deadline | ProposalList, reads theo block | validation02, Original04 | PASS |
| 5.1 | Pending/Active/Closed filter | canonical state; trong trang tối đa10 ID, nhãn rõ | validation02, proposalList unit | PARTIAL: phạm vi trang, Owner đã chấp nhận02 |
| 5.1,5.3 | Pagination/bounded reads | bigint window10 ID trước khi tạo query | unit+validation02 large-count | PASS |
| 5.1 | Detail metadata, snapshot/deadline | ProposalDetail, state từ contract | Original02/04 | PASS |
| 5.1–5.2,5.4 | Vote For/Against, hasVoted, Pending | simulate/write; historical power; Pending khóa | Original02, validation01/04, unit | PASS |
| 5.1 | Current/historical/expected power | getVotes, getVotingPowerAt; Pending ghi dự kiến | validation04 + power unit | PASS |
| 2.5,5.1,5.4 | Quorum, participation, kết quả | For+Against; historical quorum; Pending estimate ghi rõ | unit, validation02/03, original | PASS |
| 5.2 | IDLE→SIGNATURE→PENDING→SUCCESS/ERROR | useTx/txMachine, hash giữ khi receipt revert | txMachine unit, Original01/02 | PASS trong môi trường đã test |
| 5.2,5.4 | Error tiếng Việt, retry, không zero giả | ReadError, errors.ts, guards | unit, Original01, validation01 | PASS; lỗi RPC lạ giữ technical details gốc |
| 5.3 | Primary/fallback phù hợp | Opt-in tối đa2 fallback; manual primary retry; endpoint boundary | reliability12 | PARTIAL: multi-endpoint thật chưa có; đã chấp nhận04 |
| 5.3 | Cache/refetch/block/timestamp | dataUpdatedAt, block/scope; invalidate sau success | validation01/04, freshness unit | PASS; timestamp không phải finality |
| 4.5,5.1,5.4 | Verification event/tally/quorum/state | Shared core/runner + UI + strict CLI tại H | core/runner unit, strict CLI, validation03 | PASS với giới hạn03B |
| 4.5 | Source/provenance và tự kiểm | LOCAL_DEPLOYMENT_EVIDENCE, code/token/creation check, lệnh strict CLI | validation03, strict-anvil.json | PARTIAL: không Etherscan/source-verified ở local; Owner chấp nhận03B |
| 5.1–5.2 | Link explorer transaction/contract | Local hiện hash/address và giải thích không explorer | Original02/04, source review | PARTIAL: Anvil không explorer; public links thuộc Phase4 |
| 5.3 | VITE_* chỉ dữ liệu công khai | Env example, ignore env.local; origin RPC đã redact trong verify | config/CLI tests, secret scope scan | PASS với config local hiện tại |
| 5.4, Phase3 DoD | Responsive 3 viewport | List cards/table, wrap, min44px controls | Original04, validation03/04, final UI3 | PASS; 48 ảnh mới |
| 5.4 | Ví thật/2 ví trên public chain | Chưa thực hiện | Không dùng Sepolia/MetaMask thật | NOT VERIFIED; Phase4 |

Không có FAIL còn mở trong regression cuối. “PASS” không chứng minh chống mọi provider race hoặc RPC giả mạo. Điều kiện public/source-verified vẫn PARTIAL/NOT VERIFIED như bảng.

### C. Contract Verification

Chạy thật tại repo: `forge build`, `forge build --sizes`, `forge test -vv`, `forge fmt --check`, `forge snapshot --check`: **tất cả exit0**, **53/53 PASS**, 4suite (4token +39vote +3fuzz +7invariant). Snapshot kiểm lại đúng baseline; không sửa `.gas-snapshot`. Warning signature cache ở ngoài workspace không ghi được vẫn tồn tại, không làm lệnh fail. Không đo lại coverage ở nhiệm vụ này; không dùng kết quả này để tuyên bố coverage mới.

### D. Frontend Verification

Node v24.19.0/npm11.17.0, Foundry1.7.1. `npm run typecheck`: PASS. `npm test`: **137/137 PASS,9file**, giữ nguyên test/assertion cũ. Production `npm run build`: PASS, JS chính khoảng654kB/gzip196kB; warning chunk>500kB còn tồn tại. Hai ABI generated đã parse và đối chiếu bằng giá trị với `out/GovVote.sol/GovVote.json` và `out/GovToken.sol/GovToken.json`: khớp; không ghi lại ABI.

Hai sửa lỗi thực tế trong FINAL:

1. **Medium, continuity fallback:** trước đây normal read failover chỉ kiểm chain/code/token, có thể chọn RPC cùng chain ID/address nhưng khác lịch sử. Thêm `createContinuityProbe` trong endpoint.ts và dùng instance theo config trong ReliableApp. Nguồn đầu tiên pin hash tại max(latest−12,0); nguồn kế tiếp/manual return phải trả cùng number/hash tại anchor đó. Candidate khác hash hoặc thiếu block bị loại. Thêm đúng1 reliability browser case. Không thêm dịch vụ hoặc sửa governance.
2. **Low, decoded read revert UI:** lần đầu Original E2E đạt11/12; test “lỗi contract khi đọc: proposal không tồn tại → ProposalNotFound bằng tiếng Việt” FAIL vì role=alert có tiêu đề + cùng lỗi lặp hai lần + retry. ReadError dedupe thông báo, với nhóm toàn decoded custom revert chỉ hiện nội dung lỗi một lần, không retry lỗi contract xác định. Mixed/unknown/RPC error vẫn có retry. Assertion cũ giữ nguyên. Chạy lại Original12/12, validation34/34 và reliability12/12 PASS.

Không sửa test để hợp thức hóa lỗi. Không có test Vitest mới trong FINAL; thêm4 browser tests được mô tả bên dưới.

### E. Browser & E2E Results

| Suite cuối | Số test | Kết quả | Evidence |
|---|---:|---|---|
| Production validation01/02/03B | 34 | PASS,59,0s | phase3-final-evidence/validation.log |
| Reliability04 | 12 | PASS,14,7s (11cũ+1mới) | reliability.log |
| Final UI (RPC error+wrong chain) | 3 | PASS,5,2s | ui.log |
| Original Phase3 E2E, source cuối | 12 | PASS,25,8s | original-e2e-current.log |

**61 browser tests PASS** (4suite, không cộng lại những lần rerun). Cộng với53Foundry+137Vitest+17CLI là268 lượt test trong các suite cuối, không phải268 kịch bản độc lập.

Test mới, tên chính xác và phạm vi:

- `cùng chain ID/contract nhưng khác lịch sử: từ chối fallback`: primary đã hoạt động/pin anchor, sau đó lỗi; fallback giữ chain/contract nhưng hash khác; UI báo không còn endpoint, không hiện proposal-count. PASS.
- `final RPC error và wrong chain responsive 375`, `... 768`, `... 1280`: RPC error có thông báo và retry; ví mock chain1 có banner; không overflow ở375×812/768×1024/1280×800; lưu6PNG. **3/3 PASS**.

Original E2E cô lập: port8546 trống trước khi start; bind127.0.0.1, chain31337, Anvil public unlocked accounts; deploy/seed/delegate/propose/vote chỉ trong copy `/tmp/govvote-final-a38k8vrd`. Lib và node_modules dùng lại chỉ để đọc. Tất cả CLI/RPC/wallet-forward dùng8546, preview4175. Chỉ copy tạm sửa literal port8545→8546 trong route fixture01 và4173→4175 trong test/config; không sửa assertion, không lưu các port này vào config repo. Tự terminate đúng process Anvil mới ở finally.

8545 chỉ đọc block trước/sau: **0x1c5d→0x1c5d (7261→7261)**. Chưa có reset/seed/tx nào gửi8545. Không Sepolia. Anvil startup stdout bị bỏ để không lưu private keys mặc định. Lần dựng đầu timeout8s khi `anvil_mine` hàng nghìn block; đã tăng riêng timeout của thao tác mine fixture lên60s. Đây là timeout setup, không thay timeout production. Lần E2E kế tiếp11/12 phát hiện ReadError như trên; sau sửa đạt12/12. Lượt xác nhận trên đúng source cuối (giữ retry cho unknown revert) tiếp tục12/12; ảnh18của lượt này lưu p3-final-original-current, giữ18ảnh lượt PASS trước trong p3-final-original. Không giấu hai lần chưa PASS này.

Original02 chứng minh delegate→create→For/Against→receipt/refetch→tallystorage→legacyCLI; hash giao dịch và kết quả legacy lượt cuối nằm trong original-e2e-current.log. Đó vẫn là **legacy tally-only**, không đổi tên thành full verification. Strict CLI có kiểm thử độc lập ở mụcF.

### F. Verification Core & CLI

CLI typecheck PASS; **17/17 PASS**, gồm9legacy +8strict/config fixtures. Lệnh tương đương test script trên Node24: `node --import tsx --test --test-isolation=none test/verify.test.ts test/strict.test.ts` (tránh process-isolation của local HTTP fixture). Không bỏ test cũ.

Strict real read-only regression trên Anvil8545: proposal1, latest7261, H7249, C12, hash `0x5d47b51cfd5f8dc19b9d41a1d2555016ee3f01ff61c2236321131ffd12dce90d`; **VERIFIED,18requests**,3unique votes, For600.000/Against250.000GOV, quorum100.000, expected/contract Succeeded. `phase3-final-evidence/strict-anvil.json` chứa context/evidence/calculated đầy đủ, không ghi đè evidence03B cũ.

Strict runner đọc storage tại H, ProposalCreated, VoteCast từ createdBlock tới H; sort block/txIndex/logIndex; dedupe identical logs, reject voter trùng/conflicting logs; đối chiếu metadata/tally/quorum ceiling/state và hash anchor cuối. Không VERIFIED khi thiếu required evidence, Pending snapshot chưa chốt, resource limit hoặc anchor đổi. RPC_ERROR khác MISMATCH; VERIFIED tại Active/Defeated không có nghĩa thông qua hoặc kết quả cuối cùng. UI reset khi route/policy/run đổi, bỏ completion cũ.

Giới hạn giữ nguyên: RPC có thể nói sai nhất quán logs+storage; không cryptographic receipt/state proofs; không kiểm getPastVotes từng voter; không đọc lại canonical hash cho từng block VoteCast; không chứng minh payload HTTP/JSON parse có giới hạn cứng trước khi cấp phát bộ nhớ. Không dùng câu “full trustless verification”.

### G. RPC & Wallet Safety

- Normal HTTP transport timeout8s, retryCount0; Query retry1, delay500ms. Tổng một query lỗi có thể khoảng16,5s, không hứa toàn UI xong trong8s. Poll block1s là hoạt động đã cấu hình, không phải retry loop. Read-error manual retry chỉ refetch query lỗi; nút disabled khi đang fetch.
- Normal candidate tối đa3nguồn; có fallback mới bootstrap probe. Sau FINAL mỗi candidate tối đa4reads chain/code/token (8s/read) +2blockreads chung8s; tổng xấu có thể khoảng40s/candidate/120s cho3candidate, cộng thời gian request đã lỗi trước failover. Hữu hạn nhưng UX có thể chờ lâu. Không tự failback lặp vô hạn.
- Strict:200requests,50.000logs,60s tổng,8s/request,retry1,range≤10.000blocks; failover frontend chạy lại từ đầu từng nguồn, chia sẻ budget còn lại. RPC_ERROR/wrong-chain/no-code có thể thử nguồn sau; MISMATCH không bị che. CLI strict một nguồn.
- Anchor normal theo config tồn tại trong memory session. Nếu primary chết trước khi pin, fallback đầu tiên trở thành nguồn tin cậy đầu tiên. Anchor không tự tiến theo head; hai fork cùng anchor nhưng tách nhánh sau đó vẫn có thể qua probe. Reorg hợp lệ tại anchor cũng có thể làm từ chối nguồn tốt. Reload mất anchor. Đây là **trust-on-first-use (tin nguồn đầu tiên)** và continuity tối thiểu, không phải consensus hoặc chứng minh mọi lịch sử giống nhau. Có thể cân nhắc anchor mới hơn/provenance độc lập trong thiết kế riêng, không tự triển khai Phase4.
- Endpoint switch unmount provider/queryclient/tx hooks; late response/probe không cập nhật phiên mới; không dùng cache của RPC trước làm evidence RPC sau. Có test old completion và restart verification.
- Session guard dùng generation và live account/chain; A→B và A→B→A đều hủy run cũ nếu provider phát event. Disconnect xóa UI session; đổi chain/account trong simulate bị kiểm lại trước writeContract. busy chặn double-click trong run hiện tại; receipt cũ không callback/refetch phiên mới.
- **Không bảo đảm tuyệt đối:** có khoảng thời gian giữa assert và provider xử lý write; đổi ví khi popup đã mở không thể hủy chữ ký/provider broadcast; event provider có thể tới muộn hoặc thiếu. Hủy/ẩn UI không hủy giao dịch đã được ví gửi. Sau đổi phiên người dùng có thể tạo request khác trong khi popup cũ còn mở; không tuyên bố chống duplicate giữa các session tuyệt đối. Contract hasVoted và receipt/revert là kiểm soát cuối.

### H. Security Findings — dependency classification và secrets

`npm audit --json --ignore-scripts` chỉ đọc registry, không audit fix/install/update:

- **Frontend27:16high/11moderate/0critical**. Raw report: frontend-audit.json. Các output log lưu dưới evidence chỉ chuẩn hóa trailing whitespace, không đổi nội dung/kết quả. Đây là số package findings gồm lan truyền qua dependency, không phải27 advisory độc lập. Wagmi2.19.5 là direct dependency bị đánh moderate do chuỗi phụ thuộc; không chính xác nếu gọi mọi finding là package gián tiếp.
- Audit high của `viem` trỏ **viem2.23.2 nested trong @walletconnect/utils**, không phải frontend direct viem2.57.13. `ws8.18.0` nằm dưới Reown/WalletConnect. Các nhánh MetaMask SDK/Coinbase/Reown/WalletConnect đến từ connectors được cài qua wagmi; app chỉ chọn injected.
- Advisory gốc: ws memory disclosure/DoS (GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p), decode-uri-component DoS (GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f), zod oversized-collection memory exhaustion (GHSA-mrhx-c7xc-m3w5), uuid buffer bounds (GHSA-w5hq-g745-h8pq). Zod3.22.4/3.25.76, decode-uri-component0.2.2, uuid9.0.1 có trong tree theo raw audit.
- Kiểm tra module thực sự được emit bằng Vite production `generateBundle/chunk.modules`, cùng config và source cuối: **không có module của các node bị audit ws/zod/decode-uri-component/uuid/nested viem, SDK/WalletConnect/Reown trong bundle hiện tại**; wagmi core hooks có23module nhưng advisory lan truyền qua connectors không dùng. Chi tiết từng node/matches ở runtime-audit.json. Kết luận ảnh hưởng runtime thấp hơn tree audit cho build injected hiện tại là **suy luận về reachability (đường code có thể tới)**, chưa phải exploit test hoặc chứng nhận an toàn; vẫn giữ severity registry, không hạ high thành “đã sửa”. Dependency được cài vẫn là rủi ro supply chain/build và việc thêm connector sau này đổi kết luận này.
- CLI audit: **0** vulnerability tại thời điểm chạy; raw cli-audit.json.
- Npm đề xuất nâng wagmi major ở nhiều nhánh; không tự nângv3. Owner phải chốt phương án xử lý/accept rủi ro và regression trước public deployment.

Security review source/test: React escape title/description, không dangerouslySetInnerHTML; XSS E2E PASS; UTF-8 threshold/byte input checks; explicit account/chain simulate→write; generation receipt guard; tx hash giữ khi mined revert; retry/time/log/request budgets và fail-closed verdict. Không thấy lỗi high mới có thể tái hiện trong scope local đã kiểm; điều đó không loại trừ lỗ hổng chưa phát hiện.

Rà **toàn bộ candidate tracked modified + untracked**, không chỉ git diff: UTF-8, whitespace/CR, file loại, patterns private key/secret/mnemonic assignment, đọc lại env/config/fixtures. Không phát hiện secret thật trong phạm vi commit. Public Anvil addresses/tx hashes/fixture hashes và ví test không phải secret thật. Không in nội dung .env.local; xác nhận bị ignore và không chứa signer trong code frontend/CLI. VITE_* vẫn public khi build; phải audit lại env trước public release. README template có ví dụ `--private-key`, chỉ là placeholder lịch sử ngoài GroupA, không dùng trong phiên.

### I. UI/UX Results

48PNG **mới**, không ghi đè ảnh trước:18Original lượt PASS đầu trong `phase3-screenshots/p3-final-original/`,18Original source cuối trong `p3-final-original-current/`;12supplement trong `p3-final-supplement/` (verification/reliability/RPCerror/wrongchain ×3viewport). Đã mở ảnh mẫu ở kích thước thật và contact sheet30ảnh của lượt PASS đầu/supplement; lượt source cuối kiểm lại bằng assertions Original04 và mở thêm ảnh list mobile; automatic overflow assertions PASS tại375×812,768×1024,1280×800. List/detail/create/wallet/verify/error/wrongchain đều có bằng chứng mới. Long text/hash wrap; mobile cards/tablet-desktop table; controls chính≥44px theo browser checks. Wrongchain supplement chụp banner khi trang còn loading; Original01 và reliability kiểm thêm switch/khóa vote, không lấy ảnh banner làm bằng chứng mọi read đã hoàn tất.

Không tuyên bố accessibility audit toàn diện hoặc mobile MetaMask thật. Lỗi RPC lạ có thể còn chi tiết tiếng Anh của viem đi kèm thông báo/ngữ cảnh tiếng Việt; giữ nguyên nguyên nhân thay vì biến lỗi thành dữ liệu rỗng.

### J. Git Pre-commit Plan

Danh sách **từng file chính xác** và SHA256 (trừ manifest tự tham chiếu) ở `docs/phase3-final-manifest.json`; dựa `git ls-files --others --exclude-standard` cộng `git diff --name-only`, không glob stage. Manifest phân nhóm:

- **A, Phase3:** frontend (source/ABI/scripts/tests/config/lockfiles), shared/verification, CLI strict adapter/legacy migration/test fixtures, docs/phase2b-verify-report.md phần bổ sung và toàn bộ report/evidence/PNG Phase3. Generated ABI là artifact có kiểm soát cần commit; dist/out/broadcast không cần commit.
- **B, AI workflow:** AGENTS.md, CLAUDE.md, docs/PROGRESS.md. Owner quyết định commit riêng hay kèm; chưa có convention attribution Codex được chốt.
- **C, templates:** README.md, .github/workflows/test.yml; đề xuất để ngoài commit Phase3, xử lý riêng Phase4 theo Owner.
- **D, excluded:** .env*, node_modules,dist,test-results,playwright-report,out,cache,broadcast,temp logs/setup ở/tmp và secrets. .env.example công khai là ngoại lệ được GroupA giữ. Không stage ignored/generated runtime outputs.

Đề xuất sau khi Owner duyệt: review A trước; nếu chia commit thì shared core+CLI adapter/tests và frontend consumers phải có dependency order, không commit frontend thiếu shared; B riêng nếu Owner muốn; C chưa đưa vào. Stage đúng từng path từ manifest, kiểm diff staged rồi test cần thiết, commit message/attribution phải được Owner chốt theo AGENTS. **Phiên này index vẫn rỗng, không stage/commit/push/merge.** Manifest là snapshot scope hiện tại, không tự cho phép file mới về sau; cần kiểm lại status nếu workspace đổi.

### K. Outstanding Risks

1. High registry dependency findings còn mở; chưa exploit-test, chưa được chấp thuận public release.
2. Wallet provider popup/event timing và tx đã broadcast không thể app hủy; MetaMask thật NOT VERIFIED.
3. Trust single RPC, shared/dishonest RPC, fork sau anchor, partial/capped logs, reorg giữa nhiều reads; không proof/weight từng voter. Thiếu log làm lệch tally →MISMATCH; nếu RPC đồng thời sửa storage nhất quán thì không phát hiện được.
4. Payload JSON quá lớn có thể cấp phát trước budget; test resource limits không chứng minh chống memory exhaustion tuyệt đối.
5. Fallback thật NOT VERIFIED vì Owner chưa cung cấp URL; config fallback mặc định trống. Thời gian failover nhiều candidate có thể dài hơn8s đáng kể.
6. Filter trong trang, source explorer/Sepolia/public tx links chưa có; đã ghi rõ ngoại lệ local. Bundle>500kB còn cảnh báo.
7. Nguyên nhân exit137 của phiên cũ vẫn chưa xác minh, không suy ra đã hết rủi ro từ regression lần này. Chain Anvil8545 ở memory và có thể mất khi tắt.

### L. Phase 4 Readiness

Có đủ bằng chứng để **review commit Phase3 local**, chưa chấp thuận public deployment và không tự bắt đầu Phase4. Trước Phase4 Owner cần duyệt kết quả/manifest, convention commit Codex; quyết định dependency remediation/acceptance; cấp cấu hình RPC phù hợp và kiểm provenance/explorer cho chain thật; phê duyệt mạng/signer/keystore/deploy parameters riêng; chạy wallet thật/multiendpoint thật và regression sau thay cấu hình/deps. Phần strict verify4.5 đã được Owner chuyển vào03B và hoàn thành local, không còn ghi toàn bộ phần đó là TODO Phase4. Các giới hạn nâng cao còn lại không tự coi thành yêu cầu mới của v1.1.

### M. Final Verdict

**READY_FOR_COMMIT_REVIEW — chỉ phạm vi Phase3 local và các ngoại lệ Owner đã chấp thuận.** Contract53, Vitest137, CLI17, browser61 đều PASS trong lượt cuối; typecheck/build/fmt/sizes/snapshot PASS. Hai lỗi thực tế đã sửa và regression chứng minh; không còn test fail chưa xử lý. Rủi ro đã phân loại, phạm vi file được liệt kê, chưa phát hiện secret trong scope. Không đồng nghĩa Owner đã nghiệm thu hoặc cho phép commit/deploy. DỪNG chờ Owner và ChatGPT.
