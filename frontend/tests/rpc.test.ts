// Render server: kiểm nhánh UI lỗi mà không chạy ví, RPC hoặc gửi giao dịch.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const f = vi.hoisted(() => ({ errorAt: "", message: "RPC trả lỗi", code: "0x1234", calls: [] as Record<string, unknown>[] }));
vi.mock("../src/appContext.ts", () => ({
 useAppConfig: () => ({ chainId: 31337, govVote: "0x1111111111111111111111111111111111111111", govToken: "0x2222222222222222222222222222222222222222", rpcUrl: "http://127.0.0.1:8545" }),
 useWallet: () => ({ address: "0x3333333333333333333333333333333333333333", isConnected: true, canWrite: true, wrongChain: false }),
}));
vi.mock("../src/lib/useTx.ts", () => ({ useTx: () => ({ state: { status: "IDLE" }, run: vi.fn() }) }));
vi.mock("@tanstack/react-query", async (original) => ({ ...await original<object>(), useQuery: () => query("rpc", 31337) }));
function query(name: string, data: unknown) {
 return { data: f.errorAt === name ? undefined : data, error: f.errorAt === name ? new Error(f.message) : null, isLoading: false, isFetching: false, refetch: vi.fn() };
}
vi.mock("wagmi", () => ({
 useConfig: () => ({}), usePublicClient: () => ({}),
 useBytecode: () => query("bytecode", f.code),
 useBlockNumber: () => query("block", 100n),
 useReadContracts: () => query("batch", []),
 useReadContract: (args: Record<string, unknown>) => {
  f.calls.push(args);
  const name = String(args.functionName);
  const data = name === "token" ? "0x2222222222222222222222222222222222222222" : name === "getProposal" ? { snapshotBlock: 1n } : name === "delegates" ? "0x0000000000000000000000000000000000000000" : 0n;
  return query(name, data);
 },
}));
import { BlockGuard } from "../src/components/BlockGuard.tsx";
import { ConfigGuard } from "../src/components/ConfigGuard.tsx";
import { WalletDashboard } from "../src/pages/WalletDashboard.tsx";
import { CreateProposal } from "../src/pages/CreateProposal.tsx";
import { ProposalDetail } from "../src/pages/ProposalDetail.tsx";
import { ProposalList } from "../src/pages/ProposalList.tsx";
beforeEach(() => { f.errorAt = ""; f.code = "0x1234"; f.calls = []; f.message = "RPC trả lỗi"; });
for (const name of ["rpc", "bytecode", "token"]) {
 for (const message of ["Connection refused", "RPC timeout", "RPC trả lỗi"]) {
  test(`ConfigGuard ${name}: ${message}`, () => {
   f.errorAt = name; f.message = message;
   const html = renderToStaticMarkup(createElement(ConfigGuard, { children: "OK" }));
   expect(html).toContain(message); expect(html).toContain("Thử lại"); expect(html).not.toContain("Đang kiểm tra");
   if (name === "bytecode") expect(html).not.toContain("Không có bytecode");
  });
 }
}
test("bytecode rỗng khác lỗi RPC", () => {
 f.code = "0x";
 expect(renderToStaticMarkup(createElement(ConfigGuard, { children: "OK" }))).toContain("Không có bytecode tại VITE_GOV_VOTE");
});
for (const [name, render] of [
 ["block", () => createElement(BlockGuard, { children: "OK" })],
 ["balanceOf", () => createElement(WalletDashboard)],
 ["getVotes", () => createElement(CreateProposal)],
 ["state", () => createElement(ProposalDetail, { id: 1n })],
 ["batch", () => createElement(ProposalList)],
] as const) test(`${name}: read thất bại có lỗi và retry`, () => {
 f.errorAt = name;
 const html = renderToStaticMarkup(render());
 expect(html).toContain("RPC trả lỗi"); expect(html).toContain("Thử lại");
 for (const args of f.calls) {
  expect(args.chainId).toBe(31337);
  expect(args.query ?? {}).not.toHaveProperty("placeholderData");
 }
});

test("Thử lại chỉ refetch query bị lỗi", async () => {
 const { ReadError } = await import("../src/components/ReadError.tsx");
 const failed = vi.fn(); const healthy = vi.fn();
 const view = ReadError({ queries: [{ error: new Error("RPC"), refetch: failed }, { error: null, refetch: healthy }] });
 const children = view.props.children;
 const retry = children[1];
 retry.props.onClick();
 expect(failed).toHaveBeenCalledTimes(1); expect(healthy).not.toHaveBeenCalled();
});
