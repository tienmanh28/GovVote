// Mọi RPC đều mocked. Không dùng Anvil, ví, signer hoặc transaction.
import { test, expect, type Page } from "@playwright/test";
import { loadEnv } from "vite";
import { rpcFixture } from "../tests/verificationRpcFixture.ts";
const env = loadEnv("production", process.cwd(), "VITE_");
async function setup(page: Page) {
  const m = rpcFixture();
  m.f.input.govVote = env.VITE_GOV_VOTE!;
  m.f.input.govToken = env.VITE_GOV_TOKEN!;
  m.f.context.token = env.VITE_GOV_TOKEN!;
  m.f.evidence.created!.address = m.f.input.govVote;
  for (const v of m.f.evidence.votes!) v.address = m.f.input.govVote;
  const control = {
    hold: false,
    held: false,
    release: () => {},
    oldMissing: false,
    hang: false,
    methods: [] as string[],
  };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "4173") return route.continue();
    const body = route.request().postDataJSON() as {
      id: number;
      method: string;
      params: unknown[];
    };
    control.methods.push(body.method);
    if (control.hang && body.method !== "eth_blockNumber") return;
    let result: unknown;
    try {
      if (body.method === "eth_blockNumber") result = `0x${m.f.context.latest.toString(16)}`;
      else {
        const filter = body.params[0] as { topics?: string[] } | undefined;
        const voteRequest =
          body.method === "eth_getLogs" &&
          filter?.topics?.[0] !== undefined &&
          body.params[0] !== undefined &&
          String((body.params[0] as { fromBlock: string; toBlock: string }).fromBlock) !==
            String((body.params[0] as { fromBlock: string; toBlock: string }).toBlock);
        if (control.hold && voteRequest) {
          control.hold = false;
          control.held = true;
          await new Promise<void>((resolve) => {
            control.release = resolve;
          });
          result = control.oldMissing ? [] : await m.request(body.method, body.params);
        } else result = await m.request(body.method, body.params);
      }
      await route
        .fulfill({
          contentType: "application/json",
          body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
        })
        .catch(() => {});
    } catch {
      await route
        .fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32000, message: "Fixture RPC unavailable" },
          }),
        })
        .catch(() => {});
    }
  });
  return { m, control };
}
const verdict = (page: Page) => page.getByTestId("verify-verdict");
async function verify(page: Page) {
  await page.goto("/#/verify/1");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
}
test("strict UI VERIFIED tại H, read-only không yêu cầu ví", async ({ page }) => {
  const { control } = await setup(page);
  await verify(page);
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
  await expect(page.getByTestId("verification-page")).toContainText(
    "Kết quả bỏ phiếu chưa cuối cùng tại H.",
  );
  await expect(page.getByTestId("verification-page")).toContainText("LOCAL", { ignoreCase: true });
  expect(
    control.methods.every((m) =>
      [
        "eth_blockNumber",
        "eth_chainId",
        "eth_getBlockByNumber",
        "eth_getCode",
        "eth_call",
        "eth_getLogs",
      ].includes(m),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => typeof (window as { ethereum?: unknown }).ethereum)).toBe(
    "undefined",
  );
});
test("RPC_ERROR và Retry phục hồi", async ({ page }) => {
  const { m } = await setup(page);
  m.control.fail = true;
  await verify(page);
  await expect(verdict(page)).toHaveAttribute("data-status", "RPC_ERROR");
  m.control.fail = false;
  await page.getByRole("button", { name: "Retry — Thử lại" }).click();
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
});
for (const [name, flag, status] of [
  ["missing ProposalCreated", "missingCreation", "INCOMPLETE"],
  ["missing votes không khớp storage", "missingVotes", "MISMATCH"],
  ["malformed event", "malformed", "INCOMPLETE"],
  ["reorg", "reorg", "INCOMPLETE"],
] as const)
  test(`UI ${name} không VERIFIED`, async ({ page }) => {
    const { m } = await setup(page);
    m.control[flag] = true;
    await verify(page);
    await expect(verdict(page)).toHaveAttribute("data-status", status);
  });
test("Pending chưa chốt snapshot không VERIFIED", async ({ page }) => {
  const { m } = await setup(page);
  m.f.context.latest = 37n;
  m.f.context.head = 25n;
  m.f.evidence.contractState = 0n;
  await verify(page);
  await expect(verdict(page)).toHaveAttribute("data-status", "INCOMPLETE");
  await expect(verdict(page)).toContainText("SNAPSHOT_NOT_FINALIZED");
});
test("progress trong khi quét; không badge VERIFIED sớm", async ({ page }) => {
  const { control } = await setup(page);
  control.hold = true;
  await verify(page);
  await expect.poll(() => control.held).toBe(true);
  await expect(verdict(page)).toHaveAttribute("data-status", "RUNNING");
  await expect(page.getByTestId("verify-progress")).toContainText("1 logs");
  control.release();
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
});
test("lần cũ hoàn tất sau lần mới không ghi đè verdict", async ({ page }) => {
  const { control } = await setup(page);
  control.hold = true;
  control.oldMissing = true;
  await verify(page);
  await expect.poll(() => control.held).toBe(true);
  await page.getByRole("button", { name: "Chạy lại" }).click();
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
  control.release();
  await page.waitForTimeout(300);
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
});
test("đổi route xóa verdict cũ", async ({ page }) => {
  await setup(page);
  await verify(page);
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
  await page.evaluate(() => {
    location.hash = "/verify/2";
  });
  await expect(
    page.getByRole("heading", { name: "Xác minh proposal #2", exact: true }),
  ).toBeVisible();
  await expect(verdict(page)).toHaveAttribute("data-status", "IDLE");
});
test("đổi reference policy xóa verdict, chạy lại ở H mới", async ({ page }) => {
  await setup(page);
  await verify(page);
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
  await page.getByLabel("Số block phía sau H (confirmations)").fill("13");
  await expect(verdict(page)).toHaveAttribute("data-status", "IDLE");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
  await expect(page.getByTestId("verification-page")).toContainText("99");
});
test("RPC timeout hiển thị RPC_ERROR, retry hữu hạn", async ({ page }) => {
  const { control } = await setup(page);
  control.hang = true;
  await verify(page);
  await expect(verdict(page)).toHaveAttribute("data-status", "RPC_ERROR", { timeout: 23000 });
  expect(control.methods.filter((m) => m === "eth_chainId")).toHaveLength(2);
});
test("VERIFIED khi Defeated không bị gọi là thông qua", async ({ page }) => {
  const { m } = await setup(page);
  m.f.context.head = 7226n;
  m.f.context.latest = 7238n;
  m.f.evidence.contractState = 3n;
  m.f.evidence.votes![0]!.weight = 40n;
  m.f.evidence.proposal!.forVotes = 40n;
  await verify(page);
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
  await expect(page.getByTestId("verification-page")).toContainText("Không thông qua (Defeated)");
});
for (const [width, height] of [
  [375, 812],
  [768, 1024],
  [1280, 800],
])
  test(`verification responsive ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await setup(page);
    await verify(page);
    await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator("button:visible,input:visible")
        .evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 44)),
    ).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`verify-${width}.png`), fullPage: true });
  });
