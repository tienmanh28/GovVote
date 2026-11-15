// Kiểm policy bằng dữ liệu fixture, không gọi endpoint hoặc thêm quyền mạng dự phòng.
import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { configuredRpcUrls, securityHeaders, formatHeaders } from "../src/lib/securityPolicy.ts";

test("CSP chỉ nhận origin primary/fallback, loại path/query và gộp origin trùng", () => {
  const urls = configuredRpcUrls({
    VITE_RPC_URL: "https://rpc.example/one?token=fixture",
    VITE_RPC_FALLBACK_URLS: "https://rpc.example/two,https://other.example:9443/read",
  });
  const policy = securityHeaders(urls)["Content-Security-Policy"]!;
  expect(policy).toContain("connect-src 'self' https://rpc.example https://other.example:9443");
  expect(policy).not.toMatch(/token|fixture|\*/);
  expect(policy).not.toContain("unsafe-inline");
  expect(policy).not.toContain("unsafe-eval");
});
test("template public đóng mạng ngoài; build local chỉ thêm RPC mặc định", () => {
  const template = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  expect(template).toBe(formatHeaders(securityHeaders()));
  expect(securityHeaders(configuredRpcUrls({}))["Content-Security-Policy"]).toContain(
    "connect-src 'self' http://127.0.0.1:8545;",
  );
});
test("không nhận credentials, scheme khác HTTP(S), fragment hoặc quá hai fallback", () => {
  for (const url of ["https://user:pass@example.com", "file:///tmp/a", "https://rpc.example/#x"])
    expect(() => securityHeaders([url])).toThrow();
  expect(() =>
    configuredRpcUrls({ VITE_RPC_FALLBACK_URLS: "http://a,http://b,http://c" }),
  ).toThrow();
});
test("header chống sniff/referrer/nhúng và quyền thiết bị bị chặn", () => {
  const headers = securityHeaders();
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect(headers["Referrer-Policy"]).toBe("no-referrer");
  expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  expect(headers["Permissions-Policy"]).toContain("camera=()");
});
