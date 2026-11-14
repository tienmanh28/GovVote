import { afterEach, expect, test, vi } from "vitest";
import { runVerification, verificationExit } from "../../shared/verification/runner.ts";
import { createHttpRequest, rpcSource } from "../../shared/verification/http.ts";
import { verificationCodec } from "../src/lib/verificationAdapter.ts";
import { rpcFixture } from "./verificationRpcFixture.ts";
import { hash } from "../../shared/verification/fixtures.ts";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test("runner full RPC evidence tại H và kiểm lại anchor", async () => {
  const m = rpcFixture();
  const result = await runVerification(m.f.input, m.request, verificationCodec);
  expect(result.status).toBe("VERIFIED");
  expect(result.requests).toBe(18);
  expect(m.control.headReads).toBe(2);
  expect(result.context?.head).toBe(100n);
  expect(result.evidence?.quorum?.pastTotalSupply).toBe(1000n);
  expect(m.calls.filter((c) => c.method === "eth_call").every((c) => c.params[1] === "0x64")).toBe(
    true,
  );
});
for (const [name, flag, status] of [
  ["RPC failure", "fail", "RPC_ERROR"],
  ["reorg", "reorg", "INCOMPLETE"],
  ["malformed log", "malformed", "INCOMPLETE"],
  ["missing ProposalCreated", "missingCreation", "INCOMPLETE"],
  ["no bytecode", "noCode", "INVALID_INPUT"],
  ["missing storage ABI", "missingResult", "INCOMPLETE"],
  ["silent missing votes", "missingVotes", "MISMATCH"],
] as const)
  test(`runner ${name}`, async () => {
    const m = rpcFixture();
    m.control[flag] = true;
    const r = await runVerification(m.f.input, m.request, verificationCodec);
    expect(r.status).toBe(status);
    expect(r.status).not.toBe("VERIFIED");
  });
test("confirmations chưa đủ", async () => {
  const m = rpcFixture();
  m.f.input.confirmations = 112n;
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  expect(r.reason).toBe("NOT_CONFIRMED");
});
test("wrong chain không đọc contract", async () => {
  const m = rpcFixture();
  const r = await runVerification(m.f.input, async () => "0x1", verificationCodec);
  expect(r.reason).toBe("WRONG_CHAIN");
  expect(r.requests).toBe(1);
});
for (const budget of [{ maxRequests: 1 }, { maxLogs: 1 }, { rangeSize: 1n, maxRequests: 20 }])
  test(`resource budget ${Object.keys(budget).join()}`, async () => {
    const m = rpcFixture();
    m.f.input.budget = budget;
    const r = await runVerification(m.f.input, m.request, verificationCodec);
    expect(r.status).toBe("INCOMPLETE");
    expect(r.reason).toBe("RESOURCE_LIMIT");
    expect(r.requests).toBeLessThanOrEqual(budget.maxRequests ?? 200);
  });
test("range liên tục và đúng block kể cả lịch sử dài", async () => {
  const m = rpcFixture();
  m.f.context.head = 30000n;
  m.f.context.latest = 30012n;
  m.f.context.hash = hash(30000);
  m.f.evidence.contractState = 2n;
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  expect(r.status).toBe("VERIFIED");
  expect(r.evidence?.ranges).toEqual([
    { from: 10n, to: 10009n },
    { from: 10010n, to: 20009n },
    { from: 20010n, to: 30000n },
  ]);
});
test("timeout có retry hữu hạn và abort request", async () => {
  vi.useFakeTimers();
  const m = rpcFixture();
  m.f.input.budget = { requestTimeoutMs: 100, retries: 1, maxDurationMs: 1000 };
  let calls = 0,
    aborts = 0;
  const pending = runVerification(
    m.f.input,
    async (_m, _p, signal) => {
      calls++;
      signal?.addEventListener("abort", () => {
        aborts++;
      });
      return new Promise(() => {});
    },
    verificationCodec,
  );
  await vi.advanceTimersByTimeAsync(201);
  const r = await pending;
  expect(r.status).toBe("RPC_ERROR");
  expect(r.reason).toBe("RPC_TIMEOUT");
  expect(calls).toBe(2);
  expect(aborts).toBe(2);
});
test("time budget không bị retry vô hạn", async () => {
  vi.useFakeTimers();
  const m = rpcFixture();
  m.f.input.budget = { maxDurationMs: 50, requestTimeoutMs: 100 };
  const pending = runVerification(m.f.input, () => new Promise(() => {}), verificationCodec);
  await vi.advanceTimersByTimeAsync(51);
  expect((await pending).reason).toBe("RESOURCE_LIMIT");
});
test("request cũ bị hủy khi chạy request mới", async () => {
  const m = rpcFixture();
  const abort = new AbortController();
  const old = runVerification(m.f.input, () => new Promise(() => {}), verificationCodec, {
    signal: abort.signal,
  });
  abort.abort();
  expect((await old).reason).toBe("CANCELLED");
  expect((await runVerification(m.f.input, m.request, verificationCodec)).status).toBe("VERIFIED");
});
test("exit policy strict", () => {
  expect(
    ["VERIFIED", "MISMATCH", "INCOMPLETE", "RPC_ERROR", "INVALID_INPUT"].map((s) =>
      verificationExit(s as never),
    ),
  ).toEqual([0, 1, 3, 2, 2]);
});
test("HTTP adapter read-only và không chấp nhận missing result", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1 }) })),
  );
  const request = createHttpRequest("http://local.test");
  await expect(request("eth_sendTransaction", [])).rejects.toThrow(/read-only/);
  await expect(request("eth_chainId", [])).rejects.toThrow(/result/);
});
test("RPC source che credentials/path/query", () => {
  expect(rpcSource("https://user:secret@example.com/private?key=secret")).toBe(
    "https://example.com",
  );
});
test("proposal ID không tồn tại => INVALID_INPUT, không quét logs", async () => {
  const m = rpcFixture();
  m.f.input.proposalId = 3n;
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  expect(r.status).toBe("INVALID_INPUT");
  expect(m.calls.some((c) => c.method === "eth_getLogs")).toBe(false);
});
test("proposal tồn tại latest nhưng chưa tồn tại H => INCOMPLETE", async () => {
  const m = rpcFixture();
  const selector = verificationCodec.encode("gov", "proposalCount", []);
  const r = await runVerification(
    m.f.input,
    async (method, params, signal) => {
      if (method === "eth_call" && (params[0] as { data: string }).data === selector)
        return `0x${(params[1] === "0x70" ? 1n : 0n).toString(16).padStart(64, "0")}`;
      return m.request(method, params, signal);
    },
    verificationCodec,
  );
  expect(r.status).toBe("INCOMPLETE");
  expect(r.reason).toBe("NOT_CONFIRMED");
  expect(m.calls.some((c) => c.method === "eth_getLogs")).toBe(false);
});
