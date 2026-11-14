import { afterEach, expect, test, vi } from "vitest";
import { makeWagmiConfig } from "../src/config.ts";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test("RPC không phản hồi: transport timeout sau 8 giây, không tự gửi lại HTTP", async () => {
 vi.useFakeTimers();
 const fetcher = vi.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
  init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
 }));
 vi.stubGlobal("fetch", fetcher);
 const config = makeWagmiConfig({ chainId: 31337, rpcUrl: "http://127.0.0.1:8545", govVote: "0x1111111111111111111111111111111111111111", govToken: "0x2222222222222222222222222222222222222222" });
 let failure: unknown;
 const pending = config.getClient().request({ method: "eth_chainId" }).catch((error: unknown) => { failure = error; });
 await vi.advanceTimersByTimeAsync(7_999);
 expect(failure).toBeUndefined();
 await vi.advanceTimersByTimeAsync(2);
 await pending;
 expect(failure).toBeInstanceOf(Error);
 expect((failure as Error).message).toMatch(/timed out|timeout/i);
 expect(fetcher).toHaveBeenCalledTimes(1);
});

test("thông báo giữ chi tiết lỗi RPC, không chỉ shortMessage", async () => {
 const { BaseError } = await import("viem");
 const { toUserMessage } = await import("../src/errors.ts");
 const error = new BaseError("RPC request failed", { details: "RPC đang gián đoạn" });
 expect(toUserMessage(error)).toContain("RPC đang gián đoạn");
 expect(toUserMessage(error)).toContain("RPC request failed");
});
