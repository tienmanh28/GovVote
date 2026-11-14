// Fixture HTTP dùng ABI thật: chứng minh pin hash và từ chối endpoint không hỗ trợ EIP-1898.
import { afterEach, expect, test, vi } from "vitest";
import { createHttpRequest } from "../../shared/verification/http.ts";
import { runVerification } from "../../shared/verification/runner.ts";
import { verificationCodec } from "../src/lib/verificationAdapter.ts";
import { rpcFixture } from "./verificationRpcFixture.ts";

afterEach(() => vi.unstubAllGlobals());
function httpFixture(rejectMethod?: string, code = -32602) {
  const m = rpcFixture();
  const calls: { method: string; params: unknown[] }[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      id: number;
      method: string;
      params: unknown[];
    };
    calls.push(body);
    const reply =
      body.method === rejectMethod
        ? { error: { code, message: "blockHash unsupported" } }
        : { result: await m.request(body.method, body.params) };
    return Response.json({ jsonrpc: "2.0", id: body.id, ...reply });
  });
  return { ...m, calls, request: createHttpRequest("http://fixture.test") };
}
test("HTTP fixture EIP-1898 đúng hash H => VERIFIED", async () => {
  const m = httpFixture();
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  expect(r.status).toBe("VERIFIED");
  for (const c of m.calls.filter((c) => ["eth_call", "eth_getCode"].includes(c.method)))
    expect(c.params[1]).toEqual({ blockHash: m.f.context.hash, requireCanonical: true });
});
for (const method of ["eth_getCode", "eth_call"])
  test(`RPC từ chối EIP-1898 cho ${method} => INCOMPLETE, không fallback số block`, async () => {
    const m = httpFixture(method);
    const r = await runVerification(m.f.input, m.request, verificationCodec);
    expect(r.status).toBe("INCOMPLETE");
    expect(r.reason).toBe("MISSING_DATA");
    expect(r.message).toMatch(/không hỗ trợ.*EIP-1898/);
    expect(m.calls.filter((c) => c.method === method)).toHaveLength(1);
    expect(m.calls.some((c) => c.method === method && typeof c.params[1] === "string")).toBe(false);
  });
test("RPC từ chối hash không khả dụng => INCOMPLETE", async () => {
  const m = httpFixture("eth_getCode", -32001);
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  expect(r.status).toBe("INCOMPLETE");
  expect(r.message).toMatch(/hash có thể không khả dụng/);
});
test("EIP-1898 vẫn kiểm anchor đổi hash cuối lượt => ANCHOR_CHANGED", async () => {
  const m = httpFixture();
  m.control.reorg = true;
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  expect(r.status).toBe("INCOMPLETE");
  expect(r.reason).toBe("ANCHOR_CHANGED");
});
test("đổi confirmations chọn hash H mới mà vẫn VERIFIED", async () => {
  // Regression cho fixture động và policy H; không cố định vào H=100 của dữ liệu mẫu.
  const m = httpFixture();
  m.f.input.confirmations = 13n;
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  expect(r.status).toBe("VERIFIED");
  expect(r.context?.head).toBe(99n);
  for (const c of m.calls.filter((c) => ["eth_call", "eth_getCode"].includes(c.method)))
    expect(c.params[1]).toEqual({ blockHash: r.context!.hash, requireCanonical: true });
});
