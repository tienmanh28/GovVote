import { test, expect, type Page } from "@playwright/test";
import { decodeFunctionData, encodeFunctionResult } from "viem";
import { loadEnv } from "vite";
import { govTokenAbi } from "../src/abi/govToken.ts";
import { govVoteAbi } from "../src/abi/govVote.ts";
import { rpcFixture } from "../tests/verificationRpcFixture.ts";
const env = loadEnv("production", process.cwd(), "VITE_"),
  GOV = 10n ** 18n;
async function setup(page: Page) {
  const m = rpcFixture();
  m.f.input.govVote = env.VITE_GOV_VOTE!;
  m.f.input.govToken = env.VITE_GOV_TOKEN!;
  m.f.context.token = env.VITE_GOV_TOKEN!;
  m.f.evidence.created!.address = m.f.input.govVote;
  m.f.evidence.proposal!.forVotes = 60000n * GOV;
  m.f.evidence.proposal!.againstVotes = 40000n * GOV;
  m.f.evidence.votes![0]!.weight = 60000n * GOV;
  m.f.evidence.votes![1]!.weight = 40000n * GOV;
  for (const v of m.f.evidence.votes!) v.address = m.f.input.govVote;
  m.f.evidence.quorum = {
    pastTotalSupply: 1000000n * GOV,
    quorumBps: 1000n,
    contractQuorum: 100000n * GOV,
  };
  const c = {
    holdPrimary: false,
    held: false,
    release: () => {},
    primary: false,
    secondary: false,
    wrongSecondary: false,
    wrongHistory: false,
    failLogsPrimary: false,
    failData: false,
    block: 100n,
    calls: [] as { source: string; method: string; name?: string }[],
  };
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && u.port === "4174") return route.continue();
    const source = u.hostname;
    const body = route.request().postDataJSON() as {
      id: number;
      method: string;
      params: unknown[];
    };
    let name: string | undefined;
    let result: unknown;
    try {
      if (
        (source === "primary.invalid" && c.primary) ||
        (source === "fallback.invalid" && c.secondary) ||
        (source === "primary.invalid" && c.failLogsPrimary && body.method === "eth_getLogs")
      )
        throw Error();
      if (body.method === "eth_chainId" && source === "fallback.invalid" && c.wrongSecondary)
        result = "0x1";
      else if (
        body.method === "eth_getBlockByNumber" &&
        source === "fallback.invalid" &&
        c.wrongHistory
      )
        result = {
          number: body.params[0] === "latest" ? "0x70" : body.params[0],
          hash: `0x${"f".repeat(64)}`,
        };
      else if (body.method === "eth_blockNumber") result = `0x${c.block.toString(16)}`;
      else if (body.method === "eth_call") {
        const call = body.params[0] as { to: string; data: `0x${string}` };
        const abi =
          call.to.toLowerCase() === m.f.context.token.toLowerCase() ? govTokenAbi : govVoteAbi;
        const decoded = decodeFunctionData({ abi, data: call.data });
        name = decoded.functionName;
        if (c.failData && name === "getProposal") {
          c.calls.push({ source, method: body.method, name });
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              error: { code: 3, message: "execution reverted" },
            }),
          });
          return;
        }
        const account = String(decoded.args?.[0] ?? "").toLowerCase();
        if (
          [
            "getVotes",
            "balanceOf",
            "delegates",
            "totalSupply",
            "getVotingPowerAt",
            "hasVoted",
          ].includes(name)
        ) {
          const value =
            name === "getVotes"
              ? (account.endsWith("02") ? 222000n : 111000n) * GOV
              : name === "balanceOf"
                ? 999000n * GOV
                : name === "delegates"
                  ? "0x0000000000000000000000000000000000000000"
                  : name === "totalSupply"
                    ? 1000000n * GOV
                    : name === "getVotingPowerAt"
                      ? 60000n * GOV
                      : false;
          result = encodeFunctionResult({
            abi,
            functionName: name as never,
            result: value as never,
          });
        } else if (name === "getProposal" && source === "primary.invalid" && c.holdPrimary) {
          c.holdPrimary = false;
          c.held = true;
          await new Promise<void>((resolve) => {
            c.release = resolve;
          });
          result = encodeFunctionResult({
            abi: govVoteAbi,
            functionName: "getProposal",
            result: { ...m.f.evidence.proposal!, title: "Late primary data" } as never,
          });
        } else if (name === "getProposal" && c.block <= 25n)
          result = encodeFunctionResult({
            abi: govVoteAbi,
            functionName: "getProposal",
            result: { ...m.f.evidence.proposal!, forVotes: 0n, againstVotes: 0n } as never,
          });
        else if (name === "state")
          result = encodeFunctionResult({
            abi: govVoteAbi,
            functionName: "state",
            result: c.block <= 25n ? 0 : 1,
          });
        else result = await m.request(body.method, body.params);
      } else result = await m.request(body.method, body.params);
      c.calls.push({ source, method: body.method, name });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
      });
    } catch {
      c.calls.push({ source, method: body.method, name });
      await route
        .fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32603, message: "Fixture unavailable" },
          }),
        })
        .catch(() => {});
    }
  });
  return c;
}
async function wallet(page: Page) {
  await page.addInitScript(() => {
    let address = "0x0000000000000000000000000000000000000001",
      connected = false;
    const listeners: Record<string, ((v: unknown) => void)[]> = {};
    Object.assign(window, {
      ethereum: {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_requestAccounts") {
            connected = true;
            return [address];
          }
          if (method === "eth_accounts") return connected ? [address] : [];
          if (method === "eth_chainId") return "0x7a69";
          if (method === "wallet_getPermissions") return [];
          if (method === "wallet_revokePermissions") {
            connected = false;
            return null;
          }
          throw Error("Mock forbids request");
        },
        on: (e: string, f: (v: unknown) => void) => {
          (listeners[e] ??= []).push(f);
        },
        removeListener: (e: string, f: (v: unknown) => void) => {
          listeners[e] = listeners[e]?.filter((x) => x !== f) ?? [];
        },
      },
      reliabilityWallet: {
        account: () => {
          address = "0x0000000000000000000000000000000000000002";
          listeners.accountsChanged?.forEach((f) => f([address]));
        },
        chain: () => listeners.chainChanged?.forEach((f) => f("0x1")),
      },
    });
  });
}
test("primary ưu tiên, fallback không bị gọi khi primary tốt", async ({ page }) => {
  const c = await setup(page);
  await page.goto("/#/");
  await expect(page.getByTestId("proposal-count")).toContainText("2 proposal");
  expect(c.calls.some((x) => x.source === "fallback.invalid")).toBe(false);
});
test("primary lỗi => fallback hợp lệ; phục hồi primary bằng retry", async ({ page }) => {
  const c = await setup(page);
  c.primary = true;
  await page.goto("/#/");
  await expect(page.getByText("RPC đang dùng (fallback):", { exact: false })).toBeVisible();
  await expect(page.getByTestId("proposal-count")).toContainText("2 proposal");
  c.primary = false;
  await page.getByRole("button", { name: "Thử lại RPC chính" }).click();
  await expect(page.getByText("RPC đang dùng (primary):", { exact: false })).toBeVisible();
});
for (const wrong of [false, true])
  test(`không còn endpoint, fallback wrong chain=${wrong}`, async ({ page }) => {
    const c = await setup(page);
    c.primary = true;
    c.secondary = !wrong;
    c.wrongSecondary = wrong;
    await page.goto("/#/");
    await expect(page.getByRole("alert")).toContainText("Không còn endpoint");
    if (wrong)
      expect(c.calls.filter((x) => x.source === "fallback.invalid").map((x) => x.method)).toEqual([
        "eth_chainId",
      ]);
    c.primary = false;
    await page.getByRole("button", { name: "Thử lại RPC chính" }).click();
    await expect(page.getByTestId("proposal-count")).toBeVisible();
  });
test("verification fallback đọc lại context và evidence từ đầu ở nguồn mới", async ({ page }) => {
  const c = await setup(page);
  c.failLogsPrimary = true;
  await page.goto("/#/verify/1");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByTestId("verify-verdict")).toHaveAttribute("data-status", "VERIFIED");
  await expect(page.getByTestId("verification-page")).toContainText("http://fallback.invalid:8545");
  const calls = c.calls.filter((x) => x.source === "fallback.invalid");
  expect(calls[0]!.method).toBe("eth_chainId");
  expect(calls.filter((x) => x.method === "eth_getBlockByNumber")).toHaveLength(4);
  expect(calls.filter((x) => x.method === "eth_getLogs")).toHaveLength(2);
});
test("freshness không tiến khi lỗi/đồng hồ chạy; retry cập nhật thành công", async ({ page }) => {
  const c = await setup(page);
  await page.goto("/#/");
  const stamp = page.getByTestId("data-freshness");
  await expect(stamp).toHaveAttribute("data-state", "ready");
  const before = await stamp.textContent();
  await page.waitForTimeout(1200);
  expect(await stamp.textContent()).toBe(before);
  c.failData = true;
  c.block = 101n;
  await expect(stamp).toHaveAttribute("data-state", "stale/error");
  await expect(stamp).toContainText(before!.match(/\d{4}-\d{2}-\d{2}T[^ ]+/)![0]);
  c.failData = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(stamp).toHaveAttribute("data-state", "ready");
  await expect(stamp).toContainText("block 101");
});
test("Pending getVotes dự kiến, đổi account, snapshot historical và sai chain", async ({
  page,
}) => {
  const c = await setup(page);
  c.block = 20n;
  await wallet(page);
  await page.goto("/#/proposal/1");
  await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
  await expect(page.getByTestId("my-power")).toContainText("111.000 GOV (dự kiến, chưa chốt)");
  await page.evaluate(() =>
    (window as unknown as { reliabilityWallet: { account(): void } }).reliabilityWallet.account(),
  );
  await expect(page.getByTestId("my-power")).toContainText("222.000 GOV (dự kiến, chưa chốt)");
  c.block = 26n;
  await expect(page.getByTestId("my-power")).toHaveText("60.000 GOV");
  await page.evaluate(() =>
    (window as unknown as { reliabilityWallet: { chain(): void } }).reliabilityWallet.chain(),
  );
  await expect(page.getByTestId("wrong-chain")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bỏ phiếu For (Đồng ý)" })).toBeDisabled();
});
for (const [width, height] of [
  [375, 812],
  [768, 1024],
  [1280, 800],
])
  test(`reliability responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    const c = await setup(page);
    c.primary = true;
    c.block = 20n;
    await wallet(page);
    await page.goto("/#/proposal/1");
    await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
    await expect(page.getByTestId("my-power")).toContainText("dự kiến, chưa chốt");
    await expect(page.getByTestId("data-freshness")).toHaveAttribute("data-state", "ready");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: test.info().outputPath(`reliability-${width}.png`),
      fullPage: true,
    });
  });

test("endpoint cũ trả muộn không ghi đè fallback", async ({ page }) => {
  const c = await setup(page);
  await page.goto("/#/");
  await expect(page.getByTestId("data-freshness")).toHaveAttribute("data-state", "ready");
  c.holdPrimary = true;
  c.block = 101n;
  await expect.poll(() => c.held).toBe(true);
  c.primary = true;
  await expect(page.getByText("RPC đang dùng (fallback):", { exact: false })).toBeVisible();
  await expect(page.getByTestId("data-freshness")).toHaveAttribute("data-state", "ready");
  c.release();
  await page.waitForTimeout(300);
  await expect(page.locator("main")).not.toContainText("Late primary data");
});

test("cùng chain ID/contract nhưng khác lịch sử: từ chối fallback", async ({ page }) => {
  const c = await setup(page);
  await page.goto("/#/");
  await expect(page.getByTestId("data-freshness")).toHaveAttribute("data-state", "ready");
  c.wrongHistory = true;
  c.primary = true;
  await expect(page.getByRole("alert")).toContainText("Không còn endpoint");
  await expect(page.getByTestId("proposal-count")).toHaveCount(0);
});
