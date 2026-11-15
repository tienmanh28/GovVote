// Probe endpoint trước khi dùng: chain, hai bytecode và token liên kết phải đúng.
import { requireChainProfile } from "../../../shared/chains.ts";
import { createHttpRequest } from "../../../shared/verification/http.ts";
import { verificationCodec } from "./verificationAdapter.ts";
import type { AppConfig } from "../config.ts";
export function endpoints(cfg: AppConfig): string[] {
  return [...new Set([cfg.primaryRpcUrl ?? cfg.rpcUrl, ...(cfg.fallbackRpcUrls ?? [])])];
}
export async function probeEndpoint(
  url: string,
  cfg: AppConfig,
  signal?: AbortSignal,
): Promise<void> {
  // Cả caller ngoài parseEnv cũng phải qua allowlist trước khi chạm RPC.
  requireChainProfile(cfg.chainId);
  const request = createHttpRequest(url);
  async function read(method: string, params: unknown[]) {
    const c = new AbortController();
    const abort = () => c.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 8000);
    try {
      if (signal?.aborted) throw new Error("cancel");
      return await request(method, params, c.signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  if (BigInt(String(await read("eth_chainId", []))) !== BigInt(cfg.chainId))
    throw new Error("RPC sai chain ID");
  for (const address of [cfg.govVote, cfg.govToken])
    if (!/^0x(?:[0-9a-f]{2})+$/i.test(String(await read("eth_getCode", [address, "latest"]))))
      throw new Error("RPC không có bytecode contract");
  const raw = await read("eth_call", [
    { to: cfg.govVote, data: verificationCodec.encode("gov", "token", []) },
    "latest",
  ]);
  const token = verificationCodec.decode("gov", "token", String(raw));
  if (String(token).toLowerCase() !== cfg.govToken.toLowerCase())
    throw new Error("RPC trỏ sai GovToken");
}
export async function selectEndpoint(
  urls: string[],
  cfg: AppConfig,
  signal?: AbortSignal,
  probe = probeEndpoint,
): Promise<string> {
  for (const url of urls) {
    if (signal?.aborted) throw new Error("Đã hủy chuyển RPC");
    try {
      await probe(url, cfg, signal);
      if (signal?.aborted) throw new Error("cancel");
      return url;
    } catch {
      if (signal?.aborted) throw new Error("Đã hủy chuyển RPC");
    }
  }
  throw new Error("Không còn endpoint RPC khả dụng. Kiểm tra cấu hình/mạng rồi thử lại.");
}
// Chain ID/address không đủ: nguồn kế tiếp phải khớp một anchor lịch sử đã quan sát.
// Anchor đầu tiên vẫn là trust-on-first-use; không chứng minh RPC độc lập là trung thực.
export function createContinuityProbe() {
  let anchor: { number: bigint; hash: string } | undefined;
  return async (url: string, cfg: AppConfig, signal?: AbortSignal) => {
    await probeEndpoint(url, cfg, signal);
    const controller = new AbortController(),
      abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 8000);
    try {
      const request = createHttpRequest(url);
      const latest = (await request(
        "eth_getBlockByNumber",
        ["latest", false],
        controller.signal,
      )) as { number: string; hash: string };
      const height = BigInt(latest.number);
      // Anchor chuyển nguồn dùng cùng khoảng lùi mặc định với verifier của chain.
      const confirmations = requireChainProfile(cfg.chainId).confirmations;
      const number = anchor?.number ?? (height > confirmations ? height - confirmations : 0n);
      const block = (await request(
        "eth_getBlockByNumber",
        [`0x${number.toString(16)}`, false],
        controller.signal,
      )) as { number: string; hash: string };
      if (!block || BigInt(block.number) !== number || !/^0x[0-9a-f]{64}$/i.test(block.hash))
        throw new Error("Thiếu anchor RPC");
      if (anchor && anchor.hash.toLowerCase() !== block.hash.toLowerCase())
        throw new Error("RPC khác lịch sử tại anchor đã biết");
      if (signal?.aborted) throw new Error("cancel");
      anchor = { number, hash: block.hash };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}
