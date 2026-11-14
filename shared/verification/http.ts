// JSON-RPC chỉ đọc; AbortSignal của runner hủy HTTP khi timeout/cancel.
import { VerificationProblem, type RpcRequest } from "./runner.ts";
const methods = new Set([
  "eth_chainId",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_call",
  "eth_getLogs",
]);
export function rpcSource(url: string): string {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return "RPC cấu hình";
  }
}
export function createHttpRequest(url: string): RpcRequest {
  let id = 0;
  return async (method, params, signal) => {
    if (!methods.has(method))
      throw new VerificationProblem(
        "INVALID_INPUT",
        "INVALID_INPUT",
        "Chỉ cho phép RPC read-only.",
      );
    const requestId = ++id;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
      signal,
    });
    if (!response.ok) throw new Error("RPC HTTP failure");
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== "object")
      throw new VerificationProblem(
        "INCOMPLETE",
        "MISSING_DATA",
        "RPC không trả JSON-RPC response hợp lệ.",
      );
    const body = raw as Record<string, unknown>;
    if (body.id !== requestId || body.jsonrpc !== "2.0")
      throw new VerificationProblem(
        "INCOMPLETE",
        "MISSING_DATA",
        "JSON-RPC response sai request ID hoặc version.",
      );
    if (body.error) throw new Error("RPC returned error");
    if (!Object.hasOwn(body, "result"))
      throw new VerificationProblem("INCOMPLETE", "MISSING_DATA", "RPC thiếu trường result.");
    return body.result;
  };
}
