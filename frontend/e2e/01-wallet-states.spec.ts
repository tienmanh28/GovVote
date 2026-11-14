// Trạng thái ví và lỗi hiển thị trên trình duyệt thật (Bước 3, 6).
import { expect, test } from "@playwright/test";
import { ACCOUNTS, installFakeWallet } from "./helpers.ts";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("máy tính không có window.ethereum: hướng dẫn cài MetaMask, vẫn xem được proposal", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.getByTestId("wallet-desktop-guide")).toContainText("Chưa phát hiện MetaMask");
  await expect(page.getByTestId("proposal-count")).toContainText("proposal");
});

test("điện thoại không có window.ethereum: hướng dẫn mở trong trình duyệt của app MetaMask", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/#/");
  const guide = page.getByTestId("wallet-mobile-guide");
  await expect(guide).toContainText("Trình duyệt này không có ví");
  await expect(guide.getByRole("link")).toHaveAttribute("href", "https://metamask.app.link/dapp/127.0.0.1:4173/");
  await ctx.close();
});

test("sai chain: hiện cảnh báo, bấm nút thì gọi wallet_switchEthereumChain và cảnh báo biến mất", async ({ page }) => {
  await installFakeWallet(page, { account: ACCOUNTS.alice });
  await page.goto("/#/");
  await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
  await expect(page.getByTestId("wallet-address")).toBeVisible();
  // Người dùng tự đổi mạng trong ví sang Ethereum mainnet (chainId 1).
  await page.evaluate(() => (window as unknown as { __fakeWallet: { setChain(h: string): void } }).__fakeWallet.setChain("0x1"));
  await expect(page.getByTestId("wrong-chain")).toContainText("chainId 1");
  await page.getByRole("button", { name: "Chuyển sang mạng Anvil (31337)" }).click();
  await expect(page.getByTestId("wrong-chain")).toHaveCount(0);
  const calls = await page.evaluate(() => (window as unknown as { __fakeWallet: { calls: string[] } }).__fakeWallet.calls);
  expect(calls).toContain("wallet_switchEthereumChain");
});

test("người dùng từ chối ký (4001): thông báo tiếng Việt, trạng thái ERROR", async ({ page }) => {
  await installFakeWallet(page, { account: ACCOUNTS.alice });
  await page.goto("/#/wallet");
  await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
  await expect(page.getByTestId("balance")).toBeVisible();
  await page.evaluate(() => (window as unknown as { __fakeWallet: { rejectNextSend(): void } }).__fakeWallet.rejectNextSend());
  await page.getByRole("button", { name: "Delegate cho chính mình" }).click();
  await expect(page.getByTestId("tx-status")).toHaveAttribute("data-status", "ERROR");
  await expect(page.getByTestId("tx-error")).toHaveText("Bạn đã từ chối giao dịch trong ví");
});

test("lỗi contract khi đọc: proposal không tồn tại → ProposalNotFound bằng tiếng Việt", async ({ page }) => {
  await page.goto("/#/proposal/999");
  await expect(page.getByRole("alert")).toHaveText("Không tìm thấy proposal #999.");
});

test("VITE_GOV_VOTE không có bytecode: hiện lỗi cấu hình thay vì dữ liệu rỗng", async ({ page }) => {
  // Chặn đúng lời gọi eth_getCode tới RPC và trả "0x" (giả lập địa chỉ sai / Anvil đã khởi động lại).
  await page.route(
    (url) => url.port === "8545",
    async (route) => {
      const body = route.request().postDataJSON() as { id: number; method: string } | undefined;
      if (body?.method === "eth_getCode") {
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x" }) });
        return;
      }
      await route.continue();
    },
  );
  await page.goto("/#/");
  await expect(page.getByTestId("config-error")).toContainText("Không có bytecode tại VITE_GOV_VOTE");
  await expect(page.getByTestId("proposal-count")).toHaveCount(0);
});
