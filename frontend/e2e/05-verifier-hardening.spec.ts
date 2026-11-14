// Kiểm verifier UI/CLI trên Anvil thật; chỉ intercept các case RPC lỗi, không dùng ví hay signer.
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { GOV_VOTE, GOV_TOKEN, RPC_URL } from "./helpers.ts";
const verdict = (page: import("@playwright/test").Page) => page.getByTestId("verify-verdict");
test("P4-B2: UI và strict CLI VERIFIED trên Anvil thật, state pin hash H", async ({ page }) => {
  const reads: unknown[][] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(RPC_URL).origin || request.method() !== "POST")
      return;
    const body = request.postDataJSON() as { method?: string; params?: unknown[] };
    if (["eth_call", "eth_getCode"].includes(body.method ?? "")) reads.push(body.params ?? []);
  });
  await page.goto("/#/verify/1");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(verdict(page)).toHaveAttribute("data-status", "VERIFIED");
  const pinned = reads.filter((params) => typeof params[1] === "object");
  expect(pinned).toHaveLength(11);
  const selector = pinned[0]![1];
  expect(selector).toMatchObject({
    blockHash: expect.stringMatching(/^0x[0-9a-f]{64}$/i),
    requireCanonical: true,
  });
  for (const params of pinned) expect(params[1]).toEqual(selector);
  const stdout = execFileSync(process.execPath, ["--import", "tsx", "src/main.ts"], {
    cwd: resolve(process.cwd(), "../scripts/verify"),
    env: { ...process.env, GOV_RPC_URL: RPC_URL, GOV_VOTE, GOV_TOKEN, GOV_PROPOSAL_ID: "1" },
    encoding: "utf8",
  });
  const result = JSON.parse(stdout.slice(stdout.indexOf("{"))) as {
    status: string;
    context: { hash: string };
  };
  expect(result.status).toBe("VERIFIED");
  expect(result.context.hash).toBe((selector as { blockHash: string }).blockHash);
});
test("P4-B2: RPC không hỗ trợ EIP-1898 => UI INCOMPLETE, không fallback số block", async ({
  page,
}) => {
  let refused = 0;
  await page.route(
    (url) => url.origin === new URL(RPC_URL).origin,
    async (route) => {
      // Chỉ xử lý JSON-RPC POST; để CORS preflight đi tới Anvil bình thường.
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON() as {
        id: number;
        method: string;
        params: unknown[];
      };
      if (["eth_call", "eth_getCode"].includes(body.method) && typeof body.params[1] === "object") {
        refused++;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: "EIP-1898 unsupported" },
          }),
        });
      } else await route.continue();
    },
  );
  await page.goto("/#/verify/1");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(verdict(page)).toHaveAttribute("data-status", "INCOMPLETE");
  await expect(verdict(page)).toContainText("EIP-1898");
  expect(refused).toBe(1);
});
test("P4-B2: body RPC vượt 5 MiB => UI INCOMPLETE/RESOURCE_LIMIT", async ({ page }) => {
  await page.route(
    (url) => url.origin === new URL(RPC_URL).origin,
    async (route) => {
      // Chỉ xử lý JSON-RPC POST; để CORS preflight đi tới Anvil bình thường.
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON() as { id: number; method: string };
      if (body.method === "eth_chainId")
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x7a69" }).padEnd(
            5 * 1024 * 1024 + 1,
          ),
        });
      else await route.continue();
    },
  );
  await page.goto("/#/verify/1");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(verdict(page)).toHaveAttribute("data-status", "INCOMPLETE");
  await expect(verdict(page)).toContainText("RESOURCE_LIMIT");
});
