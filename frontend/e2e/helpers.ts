// Tiện ích cho E2E: đọc .env.local, gọi RPC Anvil, và cài một ví EIP-1193 GIẢ vào `window.ethereum`.
//
// Ví giả KHÔNG chứa private key. Nó chỉ:
//   - trả lời các method của ví (eth_requestAccounts, eth_accounts, eth_chainId, wallet_switchEthereumChain…);
//   - chuyển tiếp mọi request eth_* khác (kể cả eth_sendTransaction) tới Anvil. Anvil tự ký vì các account
//     demo là account dev đã được Anvil mở khóa sẵn, giống `cast send --unlocked` ở Phase 1.
import type { Page } from "@playwright/test";
import { createPublicClient, http, type Address } from "viem";
import { loadEnv } from "vite";
import { govVoteAbi } from "../src/abi/govVote.ts";

const env = loadEnv("production", process.cwd(), "VITE_");
export const RPC_URL = env.VITE_RPC_URL || "http://127.0.0.1:8545";
export const GOV_VOTE = env.VITE_GOV_VOTE as Address;
export const GOV_TOKEN = env.VITE_GOV_TOKEN as Address;

/** Account dev của Anvil (địa chỉ công khai, đã có trong docs/phase1-demo-report.md). */
export const ACCOUNTS = {
  alice: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  bob: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  charlie: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
} as const satisfies Record<string, Address>;

export async function rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result as T;
}

/** Tiến block trên Anvil (giống `cast rpc anvil_mine n` ở Phase 1). */
export async function mine(blocks: number): Promise<void> {
  await rpc("anvil_mine", [`0x${blocks.toString(16)}`]);
}

export const publicClient = createPublicClient({ transport: http(RPC_URL) });

export async function readProposal(id: bigint) {
  return publicClient.readContract({ address: GOV_VOTE, abi: govVoteAbi, functionName: "getProposal", args: [id] });
}

type FakeWalletOptions = { account: Address; chainId?: number };

/**
 * Cài ví giả vào trang. Phải gọi TRƯỚC page.goto.
 * Trạng thái "đã kết nối" lưu ở localStorage để wagmi tự kết nối lại sau khi tải lại trang.
 * Điều khiển từ test qua window.__fakeWallet: setChain(hex), rejectNextSend(), calls (danh sách method đã gọi).
 */
export async function installFakeWallet(page: Page, { account, chainId = 31337 }: FakeWalletOptions): Promise<void> {
  await page.exposeFunction("__anvilRpc", async (method: string, params: unknown[]) => {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    return (await res.json()) as { result?: unknown; error?: { code: number; message: string; data?: unknown } };
  });

  await page.addInitScript(
    ({ account, chainIdHex }) => {
      type Listener = (arg: unknown) => void;
      const listeners: Record<string, Listener[]> = {};
      const emit = (event: string, arg: unknown) => (listeners[event] ?? []).forEach((fn) => fn(arg));
      const KEY = "__fakeWalletConnected";
      let chainId = chainIdHex;
      let rejectNext = false;
      const calls: string[] = [];
      const err = (code: number, message: string, data?: unknown) => Object.assign(new Error(message), { code, data });
      const connected = () => window.localStorage.getItem(KEY) === "1";

      const provider = {
        async request({ method, params }: { method: string; params?: unknown[] }) {
          calls.push(method);
          switch (method) {
            case "eth_requestAccounts":
              window.localStorage.setItem(KEY, "1");
              emit("connect", { chainId });
              return [account];
            case "eth_accounts":
              return connected() ? [account] : [];
            case "eth_chainId":
              return chainId;
            case "net_version":
              return String(parseInt(chainId, 16));
            case "wallet_switchEthereumChain": {
              const next = (params?.[0] as { chainId: string }).chainId;
              chainId = next;
              emit("chainChanged", next);
              return null;
            }
            case "wallet_addEthereumChain":
              return null;
            case "wallet_requestPermissions":
              window.localStorage.setItem(KEY, "1");
              return [{ parentCapability: "eth_accounts" }];
            case "wallet_getPermissions":
              return connected() ? [{ parentCapability: "eth_accounts" }] : [];
            case "wallet_revokePermissions":
              window.localStorage.removeItem(KEY);
              return null;
          }
          if (method === "eth_sendTransaction" && rejectNext) {
            rejectNext = false;
            throw err(4001, "User rejected the request.");
          }
          if (method.startsWith("eth_")) {
            const w = window as unknown as { __anvilRpc: (m: string, p: unknown[]) => Promise<{ result?: unknown; error?: { code: number; message: string; data?: unknown } }> };
            const r = await w.__anvilRpc(method, params ?? []);
            if (r.error) throw err(r.error.code, r.error.message, r.error.data);
            return r.result;
          }
          throw err(4200, `Ví giả không hỗ trợ ${method}`);
        },
        on(event: string, fn: Listener) {
          (listeners[event] ??= []).push(fn);
          return provider;
        },
        removeListener(event: string, fn: Listener) {
          listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
          return provider;
        },
      };

      Object.assign(window, {
        ethereum: provider,
        __fakeWallet: {
          calls,
          setChain(hex: string) {
            chainId = hex;
            emit("chainChanged", hex);
          },
          rejectNextSend() {
            rejectNext = true;
          },
        },
      });
    },
    { account, chainIdHex: `0x${chainId.toString(16)}` },
  );
}

/** Mở trang và bấm "Kết nối MetaMask" (nếu chưa kết nối). */
export async function connect(page: Page, hash = "#/"): Promise<void> {
  await page.goto(`/${hash}`);
  const button = page.getByRole("button", { name: "Kết nối MetaMask" });
  if (await button.isVisible({ timeout: 5_000 }).catch(() => false)) await button.click();
  await page.getByTestId("wallet-address").waitFor();
}
