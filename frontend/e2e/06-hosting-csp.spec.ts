// Header thật từ preview artifact; chỉ Anvil local, không gọi Cloudflare hoặc RPC công khai.
import { test, expect } from "@playwright/test";
import { ACCOUNTS, installFakeWallet, RPC_URL } from "./helpers.ts";

test("CSP cho phép các trang chính và ví injected ở ba kích thước", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("GOVVOTE_CSP_VIOLATION")) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) =>
      console.error("GOVVOTE_CSP_VIOLATION", event.effectiveDirective, event.blockedURI),
    );
  });
  await installFakeWallet(page, { account: ACCOUNTS.alice });
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  expect(headers["content-security-policy"]).toContain(new URL(RPC_URL).origin);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  await page.getByRole("button", { name: "Kết nối MetaMask", exact: true }).click();
  await expect(page.getByTestId("wallet-address")).toBeVisible();
  for (const [width, height] of [
    [375, 812],
    [768, 1024],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    for (const route of ["/", "/create", "/wallet", "/proposal/1", "/verify/1"]) {
      await page.goto(`/#${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByTestId("verify-verdict")).toHaveAttribute("data-status", "VERIFIED");
    expect(violations).toEqual([]);
  }
});

test("CSP thực sự chặn inline script và origin loopback ngoài allowlist", async ({ page }) => {
  await page.goto("/");
  // Probe âm cố ý sinh hai violation; tách khỏi ca trang hợp lệ, không nới policy để làm test xanh.
  await page.evaluate(() => {
    const observed = { inline: false, connect: false, executed: false };
    Object.assign(window, { __cspProbe: observed });
    document.addEventListener("securitypolicyviolation", (event) => {
      if (event.blockedURI === "inline") observed.inline = true;
      if (
        event.effectiveDirective === "connect-src" &&
        event.blockedURI.startsWith("http://127.0.0.1:65534")
      )
        observed.connect = true;
    });
    const script = document.createElement("script");
    script.textContent = "window.__cspProbe.executed = true";
    document.body.append(script);
    // Nếu policy lỗi cũng chỉ tới loopback chưa dùng, không đụng RPC public.
    void fetch("http://127.0.0.1:65534/no-rpc").catch(() => {});
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __cspProbe: unknown }).__cspProbe))
    .toEqual({ inline: true, connect: true, executed: false });
});
