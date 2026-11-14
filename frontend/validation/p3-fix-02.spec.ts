// Không forwarding: tất cả RPC được trả bằng fixture, không thay đổi chain.
import { test, expect, type Page } from "@playwright/test";
import { decodeFunctionData, encodeFunctionResult } from "viem";
import { loadEnv } from "vite";
import { govVoteAbi } from "../src/abi/govVote.ts";
const token = loadEnv("production", process.cwd(), "VITE_").VITE_GOV_TOKEN!;
const GOV = 10n ** 18n;
async function fixture(page: Page, count = 12n) {
 const c = { count, block: 100n, fail: false, hold: false, holding: false, release: () => {}, ledger: [] as { name: string; id: bigint; block: bigint }[] };
 await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === "127.0.0.1" && url.port === "4173") return route.continue();
  const body = route.request().postDataJSON();
  async function respond(req: { id: number; method: string; params?: unknown[] }) {
   const { method, params = [] } = req; let result: unknown;
   if (method === "eth_chainId") result = "0x7a69";
   else if (method === "eth_blockNumber") result = `0x${c.block.toString(16)}`;
   else if (method === "eth_getCode") result = "0x6000";
   else if (method === "eth_call") {
    const { data } = params[0] as { data: `0x${string}` };
    const { functionName: name, args } = decodeFunctionData({ abi: govVoteAbi, data });
    const id = BigInt(String(args?.[0] ?? 0));
    const block = typeof params[1] === "string" && params[1] !== "latest" ? BigInt(params[1]) : c.block;
    c.ledger.push({ name, id, block });
    if (name === "getProposal" && c.fail) return { id: req.id, jsonrpc: "2.0", error: { code: -32000, message: "Danh sách RPC lỗi" } };
    const snapshot = id % 3n === 0n ? 100n : id % 3n === 1n ? 90n : 80n;
    const deadline = id % 3n === 0n ? 105n : id % 3n === 1n ? 110n : 90n;
    if (name === "getProposal" && id === 12n && block === 100n && c.hold) {
     c.holding = true; await new Promise<void>((resolve) => { c.release = resolve; });
    }
    if (name === "token") result = token;
    else if (name === "proposalCount") result = c.count;
    else if (name === "state") result = block <= snapshot ? 0 : block <= deadline ? 1 : id % 2n === 0n ? 2 : 3;
    else if (name === "quorumVotes") {
     if (block <= snapshot) throw new Error("Đã gọi quorum trước snapshot");
     result = 100_000n * GOV;
    } else if (name === "getProposal") result = { proposer: token, title: `Proposal ${id} block ${block}`, description: "Fixture", createdBlock: 1n, snapshotBlock: snapshot, deadlineBlock: deadline, forVotes: (block <= snapshot ? 0n : id === 1n || id === 2n ? 60_000n : block > deadline && id % 2n === 1n ? 50_000n : 120_000n) * GOV, againstVotes: (block <= snapshot ? 0n : id === 1n ? 39_999n : id === 2n ? 40_000n : block > deadline && id % 2n === 1n ? 70_000n : 0n) * GOV };
    else throw new Error(`Không hỗ trợ ${name}`);
    result = encodeFunctionResult({ abi: govVoteAbi, functionName: name as never, result: result as never });
   } else throw new Error(`RPC không được phép: ${method}`);
   return { jsonrpc: "2.0", id: req.id, result };
  }
  const response = Array.isArray(body) ? await Promise.all(body.map(respond)) : await respond(body);
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(response) }).catch(() => {});
 });
 return c;
}
const links = (page: Page) => page.locator('a[href^="#/proposal/"]:visible');
test("rỗng và một proposal", async ({ page }) => {
 const c = await fixture(page, 0n); await page.goto("/#/");
 await expect(page.getByText("Chưa có proposal nào.")).toBeVisible(); expect(c.ledger.filter((x) => x.name === "getProposal")).toHaveLength(0);
 c.count = 1n; c.block++;
 await expect(links(page)).toHaveText(["Proposal 1 block 101"]);
});
test("phân trang trước RPC; filter canonical; quorum ngưỡng", async ({ page }) => {
 const c = await fixture(page); await page.goto("/#/");
 await expect(links(page)).toHaveCount(10);
 expect(c.ledger.filter((x) => x.name === "getProposal").map((x) => x.id)).toEqual([12n,11n,10n,9n,8n,7n,6n,5n,4n,3n]);
 expect(c.ledger.filter((x) => ["proposalCount", "getProposal", "state", "quorumVotes"].includes(x.name))).toHaveLength(27);
 expect(c.ledger.filter((x) => x.name === "quorumVotes").every((x) => x.id % 3n !== 0n)).toBe(true);
 await page.getByLabel("Trạng thái trong trang:").selectOption("pending"); await expect(links(page)).toHaveCount(4);
 await page.getByLabel("Trạng thái trong trang:").selectOption("active"); await expect(links(page)).toHaveCount(3);
 await page.getByLabel("Trạng thái trong trang:").selectOption("closed"); await expect(links(page)).toHaveCount(3);
 await page.getByRole("button", { name: "Trang cũ hơn" }).click(); await expect(page.getByTestId("page-number")).toHaveText("Trang 2 / 2");
 await expect(links(page)).toHaveCount(1);
 await page.getByLabel("Trạng thái trong trang:").selectOption("all"); await expect(links(page)).toHaveCount(2);
 await expect(page.getByTestId("proposal-table")).toContainText("99,99% · Chưa đạt");
 await expect(page.getByTestId("proposal-table")).toContainText("100,00% · Đã đạt");
 await page.getByLabel("Trạng thái trong trang:").selectOption("pending");
 await expect(page.getByText("Không có proposal khớp bộ lọc trong trang này.")).toBeVisible();
 await page.getByRole("button", { name: "Trang mới hơn" }).click(); await expect(links(page)).toHaveCount(4);
 c.block = 101n; await expect(links(page)).toHaveCount(0);
 await expect(page.getByText("Không có proposal khớp bộ lọc trong trang này.")).toBeVisible();
 await page.getByLabel("Trạng thái trong trang:").selectOption("active"); await expect(links(page)).toHaveCount(7);
 await expect(page.getByTestId("proposal-table")).toContainText("120,00% · Đã đạt");
});
test("RPC list failure và retry", async ({ page }) => {
 const c = await fixture(page); c.fail = true; await page.goto("/#/");
 await expect(page.getByRole("alert")).toContainText("Danh sách RPC lỗi");
 c.fail = false; await page.getByRole("button", { name: "Thử lại" }).click(); await expect(links(page)).toHaveCount(10);
});
test("dữ liệu block cũ hoàn tất muộn không ghi đè block mới", async ({ page }) => {
 const c = await fixture(page); c.hold = true; await page.goto("/#/");
 await expect.poll(() => c.holding).toBe(true); c.block = 101n;
 await expect(links(page).first()).toHaveText("Proposal 12 block 101");
 c.release(); await page.waitForTimeout(300);
 await expect(links(page).first()).toHaveText("Proposal 12 block 101");
});
for (const [width,height] of [[375,812],[768,1024],[1280,800]]) test(`responsive ${width}×${height}`, async ({ page }) => {
 await page.setViewportSize({ width: width!, height: height! }); await fixture(page); await page.goto("/#/"); await expect(links(page)).toHaveCount(10);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 expect(await page.locator('button:visible, select:visible').evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 44))).toBe(true);
 await page.screenshot({ path: test.info().outputPath(`list-${width}.png`), fullPage: true });
});

 test("N rất lớn vẫn chỉ tải 10 proposal", async ({ page }) => {
  const c = await fixture(page, 10n ** 30n); await page.goto("/#/");
  await expect(links(page)).toHaveCount(10);
  expect(c.ledger.filter((x) => x.name === "getProposal")).toHaveLength(10);
  expect(c.ledger.filter((x) => ["proposalCount", "getProposal", "state", "quorumVotes"].includes(x.name)).length).toBeLessThanOrEqual(31);
 });
