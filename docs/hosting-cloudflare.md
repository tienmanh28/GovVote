# Chuẩn bị Cloudflare Pages — CHƯA deploy

PR-C chỉ chuẩn bị build/header và kiểm local. Không tạo project, kết nối tài khoản, gọi API Cloudflare hoặc deploy. Dashboard, domain, chứng chỉ TLS và MetaMask thật **chưa xác minh**; chỉ Owner thực hiện E2/F1 sau duyệt. Sepolia chưa deploy, không tự điền RPC hoặc địa chỉ như thể đã có deployment.

## Cấu hình build lấy từ repo

| Mục | Giá trị Owner thiết lập khi đã duyệt deploy |
|---|---|
| Repository/branch | repo GovVote, branch main sau khi Owner merge A → B → C |
| Root directory | `frontend` |
| Build command | `npm ci --ignore-scripts && npm run build` |
| Build output directory | `dist` (tính từ root frontend) |
| Node | **24.19.0**, cùng `.github/workflows/ci.yml`; `frontend/.node-version` đã ghim, có thể đặt NODE_VERSION cùng giá trị |
| ABI | Hai module `frontend/src/abi/` đã track; không cần Foundry hoặc broadcast trong build Pages |

Không nâng npm dependency trong PR-C. Khi contract đổi phải sync/review ABI trước commit theo quy trình riêng. Pages chỉ nhận build static đã được Owner duyệt.

Biến build cần có, dùng placeholder, không điền credential:

| Biến | Ý nghĩa |
|---|---|
| `VITE_CHAIN_ID` | `<SUPPORTED_CHAIN_ID>`: 31337 hoặc 11155111 theo deployment thật đã xác minh |
| `VITE_RPC_URL` | `<PUBLIC_READ_RPC_URL>`: RPC HTTP(S) được Owner chọn, hosting thật phải HTTPS, không secret/credential |
| `VITE_RPC_FALLBACK_URLS` | tùy chọn tối đa hai URL, phân cách dấu phẩy, cùng chain/contract đã kiểm; để trống nếu không có |
| `VITE_GOV_TOKEN` | `<GOV_TOKEN_ADDRESS>` từ receipt đã kiểm |
| `VITE_GOV_VOTE` | `<GOV_VOTE_ADDRESS>` từ receipt đã kiểm |

VITE_* nằm trong bundle công khai. Không đưa private key, mnemonic, API key, URL có credential vào dashboard VITE env hoặc repo. Không tự chọn một Sepolia RPC công khai trong E1. Default127.0.0.1:8545 chỉ dành local, không dùng cho người truy cập Pages. Sepolia profile chỉ được kiểm bằng fixture ở D0; website thật cần deployment và bước Owner duyệt riêng.

## Các bước dashboard Owner tự làm sau này

1. **Chưa làm trong E1:** Owner duyệt việc tạo/kết nối Pages project; kết nối repo có thể tự kích hoạt build/deploy, không bấm trong lúc chỉ chuẩn bị.
2. Khi đã được duyệt, vào Workers & Pages, chọn Pages/Git integration và repo; UI/dashboard thực tế chưa xác minh trong nhiệm vụ này. Chọn main và root/build/output/Node theo bảng, không dùng preset chạy deploy contract.
3. Thiết lập env công khai cho production và preview riêng; kiểm chain, địa chỉ và origin RPC bằng mắt. Chỉ dùng deployment đã hậu kiểm, không đưa key vào VITE_*.
4. Owner cho phép mới bắt đầu build/deploy. Kiểm build log, `dist/index.html`, assets và `dist/_headers`; nếu đổi RPC phải **build lại**, không sửa tay dist. Có thể tải artifact để kiểm trước quyết định publish theo giao diện Pages; khả năng thao tác dashboard chưa kiểm thực tế.
5. Sau deploy được duyệt: kiểm HTTP response có CSP/nosniff/referrer/permissions, route hash, RPC/CORS, wallet và ba viewport; domain/TLS/CDN/MetaMask F1 phải ghi bằng chứng mới. Không coi kiểm local là chứng minh Pages đã cấu hình đúng.

Cloudflare có cơ chế chọn phiên bản runtime qua env/file; `_headers` áp cho static assets. Tham khảo chính thức: [Build image](https://developers.cloudflare.com/pages/configuration/build-image/), [Headers](https://developers.cloudflare.com/pages/configuration/headers/). Đây là tài liệu chuẩn bị, không xác nhận dashboard đã chạy.

## CSP và nguồn mạng thực sự cần

Rà `frontend/src/config.ts`, `components/ReliableApp.tsx`, `lib/endpoint.ts`, `lib/useVoteVerification.ts`, `shared/verification/http.ts`: nguồn đọc là **VITE_RPC_URL** và fallback được cấu hình, không có RPC public cố định, IPFS, analytics, remote font hoặc WebSocket đang dùng. Wagmi chỉ tạo injected connector. Link MetaMask download/deep-link và explorer là điều hướng, không cần đưa vào connect-src. RPC riêng của extension MetaMask không đồng nhất với nguồn đọc frontend; cơ chế injection thực tế để F1 kiểm.

`frontend/public/_headers` là template đóng mạng ngoài (`connect-src 'self'`). Plugin Vite sinh **dist/_headers** với danh sách origin primary/fallback của chính build; chỉ HTTP(S), không credentials/fragment, không wildcard; bỏ path/query khỏi CSP và gộp origin trùng. CSP ở mức origin, không chứng minh RPC trung thực hoặc giới hạn method/path. Policy runtime không mở thêm origin từ input trang; đổi env cần rebuild.

| Directive/header | Vì sao |
|---|---|
| default-src 'self' | khóa nguồn mặc định về site |
| script-src 'self' | chỉ bundle/chunk cùng site, không inline/eval |
| style-src 'self'; style-src-attr 'none' | Tailwind xuất CSS tệp; React cập nhật bar qua CSSOM, không cho style thô chèn vào HTML |
| img-src/font-src 'self' | không có ảnh/font remote cần dùng; không tự thêm data/blob/host rộng |
| connect-src 'self' + đúng RPC origins | HTTP RPC thực sự dùng; không cho toàn bộ https hoặc domain chưa chọn |
| frame-src/frame-ancestors/object-src 'none' | không iframe/plugin và chống trang bị nhúng |
| media-src/worker-src 'none' | không có tính năng media hoặc worker cần mở |
| base-uri/form-action 'none' | không đổi base URL hoặc gửi form ra mạng ngoài flow JS hiện tại |
| X-Content-Type-Options: nosniff | không suy đoán JS/CSS từ MIME sai |
| Referrer-Policy: no-referrer | không gửi route/context sang link ngoài |
| Permissions-Policy | tắt camera/microphone/geolocation/payment/USB không dùng |

Không thêm CSP report endpoint vì chưa có nơi nhận report được Owner chọn; không có request giám sát ra ngoài. HTTPS Pages + HTTP RPC ngoài localhost có thể bị mixed-content chặn; cần URL HTTPS đã được Owner chọn, không nới CSP để che lỗi cấu hình.

## Routing và preview

App dùng **hash routing** (`#/`, `#/create`, `#/proposal/1`): fragment không gửi lên server, tài nguyên luôn ở `/` và `/assets`. **Không cần `_redirects`**, tránh wildcard rewrite nhầm JS/CSS. Pages cũng có SPA fallback mặc định khi không có 404.html; xem [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/). Nếu sau này đổi sang history routing, phải review fallback riêng.

Vite preview mặc định không thực thi `_headers`. Plugin trong vite.config.ts đọc chính file dist/_headers và gắn vào response HTTP khi preview, gồm frame-ancestors vốn không có hiệu lực qua meta. Không có worker/function/deploy API trong plugin. `vite build && vite preview` kiểm artifact policy thật local; không mô phỏng toàn bộ CDN Pages.

## Bằng chứng và giới hạn

Vitest mới kiểm origin/cấu hình template/không wildcard hoặc inline/eval và security headers. Playwright mới kiểm các trang chính ở 375×812, 768×1024, 1280×800, ví EIP-1193 giả, strict VERIFIED, không securitypolicyviolation trong flow hợp lệ. Probe âm riêng cố ý tạo hai violation (inline script + origin loopback ngoài allowlist), chứng minh policy thật sự chặn, không phải test xanh vì thiếu header. Không gọi RPC public hoặc API Cloudflare.

Kết quả thực được ghi trong `docs/PROGRESS.md` và `docs/p4-e1-evidence/` sau khi chạy. MetaMask thật/mobile wallet injection, URL RPC public/CORS, Pages dashboard/headers/CDN/domain/TLS **chưa xác minh**, để F1/Owner kiểm. CSP không bảo vệ khi bundle cùng origin bị thay bằng mã độc hoặc RPC được cho phép nói dối nhất quán; không thay contract/on-chain verification hoặc bảo đảm finality.
