import { expect, test, type Page } from "@playwright/test";
import { decodeFunctionData, encodeFunctionResult } from "viem";
import { govVoteAbi } from "../src/abi/govVote.ts";
import { govTokenAbi } from "../src/abi/govToken.ts";
import { loadEnv } from "vite";
const env = loadEnv("production", process.cwd(), "VITE_");
const TOKEN = env.VITE_GOV_TOKEN!;
const A = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const B = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const GOV = 10n ** 18n;

type Control = {
  mode: "ok" | "error" | "hang" | "missing";
  requests: number;
  chainRequests: number;
  held: string;
  release?: () => void;
  holding: boolean;
};
async function rpcMock(page: Page): Promise<Control> {
  const c: Control = { mode: "ok", requests: 0, chainRequests: 0, held: "", holding: false };
  // Fulfill every HTTP(S) request except the local static app; no RPC is forwarded.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "4173") return route.continue();
    c.requests++;
    const body = route.request().postDataJSON();
    for (const req of Array.isArray(body) ? body : [body])
      if (req.method === "eth_chainId") c.chainRequests++;
    if (c.mode === "hang") return; // Browser fetch remains pending until its AbortController timeout.
    const respond = async (request: { id: number; method: string; params?: unknown[] }) => {
      if (c.mode === "error")
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32000, message: "RPC đang gián đoạn" },
        };
      const { method, params = [] } = request;
      let result: unknown;
      if (method === "eth_chainId") result = "0x7a69";
      else if (method === "eth_blockNumber") result = "0x64";
      else if (method === "eth_getCode") result = c.mode === "missing" ? "0x" : "0x6000";
      else if (method === "eth_call") {
        const call = params[0] as { data: `0x${string}`; to: string };
        const abi = call.to.toLowerCase() === TOKEN.toLowerCase() ? govTokenAbi : govVoteAbi;
        const decoded = decodeFunctionData({ abi, data: call.data });
        const name = decoded.functionName;
        const account = String(decoded.args?.[0] ?? A);
        if (c.held === name && account.toLowerCase() === A.toLowerCase()) {
          c.holding = true;
          await new Promise<void>((resolve) => {
            c.release = resolve;
          });
        }
        const value =
          name === "token"
            ? TOKEN
            : name === "delegates"
              ? account
              : name === "balanceOf" || name === "getVotes"
                ? (account.toLowerCase() === A.toLowerCase() ? 111n : 222n) * GOV
                : name === "delegate"
                  ? undefined
                  : 0n;
        result = encodeFunctionResult({ abi, functionName: name as never, result: value as never });
      } else throw new Error(`RPC không được phép: ${method}`);
      return { jsonrpc: "2.0", id: request.id, result };
    };
    const response = Array.isArray(body)
      ? await Promise.all(body.map(respond))
      : await respond(body);
    await route
      .fulfill({ contentType: "application/json", body: JSON.stringify(response) })
      .catch(() => {});
  });
  return c;
}
async function wallet(page: Page) {
  await page.addInitScript(
    ({ account }) => {
      let address = account;
      let chainId = "0x7a69";
      let connected = false;
      let sends = 0;
      const listeners: Record<string, ((arg: unknown) => void)[]> = {};
      const emit = (event: string, arg: unknown) => listeners[event]?.forEach((f) => f(arg));
      Object.assign(window, {
        ethereum: {
          request: async ({ method }: { method: string }) => {
            if (method === "eth_requestAccounts") {
              connected = true;
              return [address];
            }
            if (method === "eth_accounts") return connected ? [address] : [];
            if (method === "eth_chainId") return chainId;
            if (method === "wallet_getPermissions") return [];
            if (method === "wallet_revokePermissions") {
              connected = false;
              return null;
            }
            if (method === "eth_sendTransaction") {
              sends++;
              throw Object.assign(new Error("Rejected by mock"), { code: 4001 });
            }
            throw new Error(`Ví giả không hỗ trợ: ${method}`);
          },
          on: (event: string, fn: (arg: unknown) => void) => {
            (listeners[event] ??= []).push(fn);
          },
          removeListener: (event: string, fn: (arg: unknown) => void) => {
            listeners[event] = listeners[event]?.filter((f) => f !== fn) ?? [];
          },
        },
        validationWallet: {
          account: (next: string) => {
            address = next;
            emit("accountsChanged", [address]);
          },
          chain: () => {
            chainId = "0x1";
            emit("chainChanged", chainId);
          },
          sends: () => sends,
        },
      });
    },
    { account: A },
  );
}
async function connect(page: Page) {
  await wallet(page);
  await page.goto("/#/wallet");
  await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
  await expect(page.getByTestId("balance")).toHaveText("111 GOV");
}
async function change(page: Page, address: string) {
  await page.evaluate(
    (value) =>
      (
        window as unknown as { validationWallet: { account(v: string): void } }
      ).validationWallet.account(value),
    address,
  );
}
test("RPC error → tiếng Việt; retry sau phục hồi", async ({ page }) => {
  const c = await rpcMock(page);
  c.mode = "error";
  await page.goto("/#/");
  await expect(page.getByRole("alert")).toContainText("Không đọc được dữ liệu");
  await expect(page.getByRole("alert")).toContainText("RPC đang gián đoạn");
  c.mode = "ok";
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByTestId("proposal-count")).toHaveText("Tổng: 0 proposal");
});
test("RPC liên tục lỗi: retry hữu hạn, không spinner", async ({ page }) => {
  const c = await rpcMock(page);
  c.mode = "error";
  await page.goto("/#/");
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await page.waitForTimeout(1500);
  const before = c.chainRequests;
  await page.waitForTimeout(1500);
  expect(c.chainRequests).toBe(before);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect.poll(() => c.chainRequests).toBeGreaterThan(before);
  await page.waitForTimeout(1500);
  expect(c.chainRequests - before).toBe(2);
});
test("RPC timeout: thoát loading, báo lỗi sau timeout và retry", async ({ page }) => {
  const c = await rpcMock(page);
  c.mode = "hang";
  await page.goto("/#/");
  await expect(page.getByRole("alert")).toContainText("Không đọc được dữ liệu", { timeout: 23000 });
  expect(c.chainRequests).toBe(2);
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeEnabled();
});
test("bytecode rỗng: đúng nguyên nhân", async ({ page }) => {
  const c = await rpcMock(page);
  c.mode = "missing";
  await page.goto("/#/");
  await expect(page.getByTestId("config-error")).toContainText(
    "Không có bytecode tại VITE_GOV_VOTE",
  );
});
test("A → B → A: dữ liệu đúng account; disconnect xóa phiên", async ({ page }) => {
  await rpcMock(page);
  await connect(page);
  await change(page, B);
  await expect(page.getByTestId("balance")).toHaveText("222 GOV");
  await expect(page.getByTestId("votes")).toHaveText("222 GOV");
  await change(page, A);
  await expect(page.getByTestId("balance")).toHaveText("111 GOV");
  await page.getByRole("button", { name: "Ngắt kết nối" }).click();
  await expect(page.getByTestId("balance")).toHaveCount(0);
  await expect(page.getByTestId("wallet-address")).toHaveCount(0);
});
test("đổi chain: khóa delegate", async ({ page }) => {
  await rpcMock(page);
  await connect(page);
  await page.evaluate(() =>
    (window as unknown as { validationWallet: { chain(): void } }).validationWallet.chain(),
  );
  await expect(page.getByTestId("wrong-chain")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delegate cho chính mình" })).toBeDisabled();
});
test("query A hoàn tất sau B: không ghi đè dữ liệu B", async ({ page }) => {
  const c = await rpcMock(page);
  c.held = "balanceOf";
  await wallet(page);
  await page.goto("/#/wallet");
  await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
  await expect.poll(() => c.holding).toBe(true);
  await change(page, B);
  await expect(page.getByTestId("balance")).toHaveText("222 GOV");
  c.release!();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("balance")).toHaveText("222 GOV");
});
for (const action of ["account", "chain", "disconnect"] as const)
  test(`${action} khi simulate đang chờ: không gọi eth_sendTransaction`, async ({ page }) => {
    const c = await rpcMock(page);
    await connect(page);
    c.held = "delegate";
    await page.getByRole("button", { name: "Delegate cho chính mình" }).click();
    await expect.poll(() => c.holding).toBe(true);
    if (action === "account") {
      await change(page, B);
      await expect(page.getByTestId("balance")).toHaveText("222 GOV");
    } else if (action === "chain") {
      await page.evaluate(() =>
        (window as unknown as { validationWallet: { chain(): void } }).validationWallet.chain(),
      );
      await expect(page.getByTestId("wrong-chain")).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Ngắt kết nối" }).click();
      await expect(page.getByTestId("balance")).toHaveCount(0);
    }
    c.release!();
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() =>
        (window as unknown as { validationWallet: { sends(): number } }).validationWallet.sends(),
      ),
    ).toBe(0);
    await expect(page.getByTestId("tx-status")).toHaveCount(0);
  });
