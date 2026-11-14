// Bằng chứng UI mới, RPC/EIP-1193 hoàn toàn mocked; không gửi transaction.
import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import { rpcFixture } from "../tests/verificationRpcFixture.ts";
const env = loadEnv("production", process.cwd(), "VITE_");
for (const [width, height] of [[375, 812], [768, 1024], [1280, 800]]) test(`final RPC error và wrong chain responsive ${width}`, async ({ page }) => {
  await page.setViewportSize({ width: width!, height: height! });
  const mock = rpcFixture();
  mock.f.input.govVote = env.VITE_GOV_VOTE!;
  mock.f.input.govToken = env.VITE_GOV_TOKEN!;
  mock.f.context.token = env.VITE_GOV_TOKEN!;
  let fail = true;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "4173") return route.continue();
    const body = route.request().postDataJSON();
    try {
      if (fail) throw new Error("RPC đang gián đoạn");
      const result = await mock.request(body.method, body.params);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }) });
    } catch {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "RPC đang gián đoạn" } }) });
    }
  });
  await page.goto("/#/");
  await expect(page.getByRole("alert")).toContainText("RPC đang gián đoạn");
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`rpc-error-${width}.png`), fullPage: true });
  fail = false;
  await page.addInitScript(() => {
    let connected = false;
    Object.assign(window, { ethereum: {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts") connected = true;
        if (method === "eth_accounts" || method === "eth_requestAccounts") return connected ? ["0x0000000000000000000000000000000000000001"] : [];
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_getPermissions") return [];
        throw new Error("Mock forbids wallet request");
      }, on: () => {}, removeListener: () => {},
    } });
  });
  await page.reload();
  await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
  await expect(page.getByTestId("wrong-chain")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`wrong-chain-${width}.png`), fullPage: true });
});
