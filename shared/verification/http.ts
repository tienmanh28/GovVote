// JSON-RPC chỉ đọc; AbortSignal của runner hủy HTTP khi timeout/cancel.
import { RpcResponseError, VerificationProblem, type RpcRequest } from "./runner.ts";
const methods = new Set([
  "eth_chainId",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_call",
  "eth_getLogs",
]);
// Chặn payload quá lớn trước JSON.parse; áp dụng chung cho browser và strict CLI.
export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export type HttpRequestOptions = { maxResponseBytes?: number };
export function rpcSource(url: string): string {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return "RPC cấu hình";
  }
}
export function createHttpRequest(url: string, options: HttpRequestOptions = {}): RpcRequest {
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0)
    throw new VerificationProblem(
      "INVALID_INPUT",
      "INVALID_INPUT",
      "Giới hạn byte HTTP không hợp lệ.",
    );
  let id = 0;
  return async (method, params, signal) => {
    if (!methods.has(method))
      throw new VerificationProblem(
        "INVALID_INPUT",
        "INVALID_INPUT",
        "Chỉ cho phép RPC read-only.",
      );
    const requestId = ++id;
    // Controller riêng cho phép hủy mạng khi vượt byte budget, kể cả caller không truyền signal.
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    let response: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("RPC HTTP failure");
      const tooLarge = () =>
        new VerificationProblem(
          "INCOMPLETE",
          "RESOURCE_LIMIT",
          `RPC response vượt giới hạn ${maxResponseBytes} bytes trước khi parse JSON.`,
        );
      // Header chỉ giúp từ chối sớm; luôn đếm byte thực vì Content-Length có thể nói dối.
      const length = response.headers.get("content-length");
      if (length !== null && /^\d+$/.test(length) && Number(length) > maxResponseBytes)
        throw tooLarge();
      reader = response.body?.getReader();
      if (!reader) throw new Error("RPC response không có body");
      // Một buffer tăng dần có trần: không giữ mảng hàng triệu chunk nhỏ từ nguồn không tin cậy.
      let bytes = new Uint8Array(Math.min(maxResponseBytes, 64 * 1024));
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        controller.signal.throwIfAborted();
        if (done) break;
        // Kiểm trước khi giữ chunk: tổng buffer chỉ được phép tối đa maxResponseBytes.
        if (value.byteLength > maxResponseBytes - total) throw tooLarge();
        if (total + value.byteLength > bytes.length) {
          const grown = new Uint8Array(
            Math.min(maxResponseBytes, Math.max(total + value.byteLength, bytes.length * 2)),
          );
          grown.set(bytes.subarray(0, total));
          bytes = grown;
        }
        bytes.set(value, total);
        total += value.byteLength;
      }
      const raw: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(0, total)));
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
      if (body.error) {
        // Chỉ giữ code số, không đưa message/URL nhạy cảm do RPC trả vào kết quả.
        const code = (body.error as { code?: unknown }).code;
        throw new RpcResponseError(typeof code === "number" ? code : undefined);
      }
      if (!Object.hasOwn(body, "result"))
        throw new VerificationProblem("INCOMPLETE", "MISSING_DATA", "RPC thiếu trường result.");
      return body.result;
    } catch (error) {
      controller.abort();
      // Không chờ cancel promise của nguồn không tin cậy; runner vẫn quản lý timeout/cancel.
      const cancelled = reader ? reader.cancel() : response?.body?.cancel();
      void cancelled?.catch(() => {});
      throw error;
    } finally {
      reader?.releaseLock();
      signal?.removeEventListener("abort", abort);
    }
  };
}
