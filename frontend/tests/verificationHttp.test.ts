// Payload fixture chia chunk để kiểm ngân sách byte trước parse, kể cả header khai báo sai.
import { afterEach, expect, test, vi } from "vitest";
import { createHttpRequest, DEFAULT_MAX_RESPONSE_BYTES } from "../../shared/verification/http.ts";
import { runVerification } from "../../shared/verification/runner.ts";
import { verificationCodec } from "../src/lib/verificationAdapter.ts";
import { rpcFixture } from "./verificationRpcFixture.ts";
afterEach(() => vi.unstubAllGlobals());
const limit = 4096;
function bodyFixture(size: number, contentLength?: string, invalid = false) {
  const m = rpcFixture();
  const cancelled = vi.fn();
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    signal = init.signal;
    const body = JSON.parse(String(init.body)) as { id: number; method: string; params: unknown[] };
    const result = await m.request(body.method, body.params);
    if (body.method !== "eth_chainId")
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    const raw = new TextEncoder().encode(
      JSON.stringify({ jsonrpc: "2.0", id: body.id, result, note: "ế" }),
    );
    const bytes = new Uint8Array(size).fill(32);
    if (invalid) bytes[0] = 123;
    else bytes.set(raw);
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === bytes.length) {
          // Response quá lớn còn đang tải: giữ stream mở để kiểm cancel thật, không nới assertion.
          if (size <= limit) controller.close();
          return;
        }
        const end = Math.min(offset + 1023, bytes.length);
        controller.enqueue(bytes.slice(offset, end));
        offset = end;
      },
      cancel: cancelled,
    });
    return new Response(stream, {
      headers: contentLength === undefined ? {} : { "content-length": contentLength },
    });
  });
  return {
    ...m,
    cancelled,
    signal: () => signal,
    request: createHttpRequest("http://fixture.test", { maxResponseBytes: limit }),
  };
}
for (const [name, size, header, invalid] of [
  ["body vượt ngưỡng không có Content-Length", limit + 1, undefined, false],
  ["Content-Length nhỏ nhưng body thật vượt ngưỡng", limit + 1, "1", false],
  ["Content-Length vượt ngưỡng từ chối sớm", limit + 1, String(limit + 1), false],
  ["body vượt ngưỡng và JSON sai vẫn chặn trước parse", limit + 1, undefined, true],
] as const)
  test(`${name} => INCOMPLETE/RESOURCE_LIMIT và hủy request`, async () => {
    const m = bodyFixture(size, header, invalid);
    const r = await runVerification(m.f.input, m.request, verificationCodec);
    expect(r.status).toBe("INCOMPLETE");
    expect(r.reason).toBe("RESOURCE_LIMIT");
    expect(r.message).toMatch(/trước khi parse JSON/);
    expect(m.signal()?.aborted).toBe(true);
    expect(m.cancelled).toHaveBeenCalledTimes(1);
    expect(r.requests).toBe(1);
  });
for (const header of [undefined, String(limit)])
  test(`body đúng ngưỡng (${header ?? "không header"}) => VERIFIED`, async () => {
    const m = bodyFixture(limit, header);
    const r = await runVerification(m.f.input, m.request, verificationCodec);
    expect(r.status).toBe("VERIFIED");
    expect(m.signal()?.aborted).toBe(false);
  });
test("mặc định 5 MiB nhận body đúng ngưỡng mà không dùng response.json", async () => {
  expect(DEFAULT_MAX_RESPONSE_BYTES).toBe(5 * 1024 * 1024);
  const json = vi.spyOn(Response.prototype, "json");
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x7a69" }).padEnd(
          DEFAULT_MAX_RESPONSE_BYTES,
        ),
      ),
  );
  try {
    expect(await createHttpRequest("http://fixture.test")("eth_chainId", [])).toBe("0x7a69");
    expect(json).not.toHaveBeenCalled();
  } finally {
    json.mockRestore();
  }
});
test("ngưỡng byte cấu hình không hợp lệ bị từ chối", () => {
  for (const maxResponseBytes of [0, -1, 1.5, Infinity, NaN])
    expect(() => createHttpRequest("http://fixture.test", { maxResponseBytes })).toThrow(
      /không hợp lệ/,
    );
});
