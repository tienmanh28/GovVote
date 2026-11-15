// CSP lấy đúng origin RPC lúc build; không wildcard hoặc lộ path/query có thể chứa credential.
export function configuredRpcUrls(env: Record<string, string | undefined>): string[] {
  const primary = env.VITE_RPC_URL?.trim() || "http://127.0.0.1:8545";
  const fallback = [
    ...new Set(
      (env.VITE_RPC_FALLBACK_URLS ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ].filter((v) => v !== primary);
  if (fallback.length > 2) throw new Error("Chỉ cho phép tối đa hai RPC fallback.");
  return [primary, ...fallback];
}

export function securityHeaders(rpcUrls: readonly string[] = []): Record<string, string> {
  const origins = [
    ...new Set(
      rpcUrls.map((value) => {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash)
          throw new Error("RPC cấu hình CSP phải là HTTP(S), không credentials hoặc fragment.");
        return url.origin;
      }),
    ),
  ];
  const csp = [
    // Chặn nguồn mặc định và script ngoài bundle; không cần inline/eval cho app production.
    "default-src 'self'",
    "script-src 'self'",
    // Tailwind xuất CSS tệp; React cập nhật thanh quorum qua CSSOM, không cần cho phép style chèn thô.
    "style-src 'self'",
    "style-src-attr 'none'",
    "img-src 'self'",
    "font-src 'self'",
    // Chỉ fetch/RPC được mã hiện tại dùng; link điều hướng MetaMask/explorer không phải connect-src.
    ["connect-src 'self'", ...origins].join(" "),
    // Không iframe, plugin, media, worker hay submit form qua mạng trong ứng dụng hiện tại.
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "media-src 'none'",
    "worker-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // Không cần quyền thiết bị hoặc Payment Request; ví injected dùng API riêng của extension.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  };
}

// Cùng định dạng được Pages đọc và preview phục vụ, tránh kiểm CSP giả qua meta không có frame-ancestors.
export function formatHeaders(headers: Record<string, string>): string {
  return (
    "# Sinh policy build từ các origin RPC được cấu hình; không sửa dist bằng tay.\n/*\n" +
    Object.entries(headers)
      .map(([name, value]) => `  ${name}: ${value}`)
      .join("\n") +
    "\n"
  );
}
