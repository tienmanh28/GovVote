// Fixture và SSR (render HTML không trình duyệt): tuyệt đối không truy cập RPC public.
import { createElement as h } from "react";
import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CHAIN_PROFILES, chainProfile, explorerLink } from "../../shared/chains.ts";
import { inputValid } from "../../shared/verification/core.ts";
import { fixture } from "../../shared/verification/fixtures.ts";
import { runVerification } from "../../shared/verification/runner.ts";
import { rpcFixture } from "./verificationRpcFixture.ts";
import { verificationCodec } from "../src/lib/verificationAdapter.ts";
import { parseEnv, makeChain, type AppConfig } from "../src/config.ts";
import { AppConfigContext } from "../src/appContext.ts";
import { probeEndpoint, createContinuityProbe } from "../src/lib/endpoint.ts";
import { ConfigGuard } from "../src/components/ConfigGuard.tsx";
import { ExplorerValue, TxStatusView } from "../src/components/ui.tsx";

const env = { VITE_GOV_VOTE: fixture().input.govVote, VITE_GOV_TOKEN: fixture().input.govToken! };
const sepolia = CHAIN_PROFILES.sepolia;
function config(chainId: number): AppConfig {
  return {
    chainId,
    rpcUrl: "http://127.0.0.1:18549",
    govVote: env.VITE_GOV_VOTE as `0x${string}`,
    govToken: env.VITE_GOV_TOKEN as `0x${string}`,
  };
}

test("Sepolia qua inputValid và nhận đúng metadata; local giữ 12 confirmations", () => {
  expect(inputValid({ ...fixture().input, chainId: BigInt(sepolia.chainId) })).toBe(true);
  expect(sepolia).toMatchObject({
    chainId: 11155111,
    name: "Sepolia",
    explorerUrl: "https://sepolia.etherscan.io",
    confirmations: 64n,
    provenance: "PUBLIC_TESTNET_DEPLOYMENT_EVIDENCE",
  });
  expect(CHAIN_PROFILES.local.confirmations).toBe(12n);
  expect(CHAIN_PROFILES.local.provenance).toBe("LOCAL_DEPLOYMENT_EVIDENCE");
});
for (const id of [1, 137, 0, -1, "abc", Number.NaN])
  test(`từ chối chain ${String(id)} trước mọi RPC`, async () => {
    expect(chainProfile(id)).toBeUndefined();
    const request = vi.fn();
    const input = { ...fixture().input, chainId: id as unknown as bigint };
    expect(inputValid(input)).toBe(false);
    const result = await runVerification(input, request, verificationCodec);
    expect(result.status).toBe("INVALID_INPUT");
    expect(result.message).toContain("bị từ chối");
    expect(request).not.toHaveBeenCalled();
  });
test("runner Sepolia VERIFIED bằng fixture, khoảng lùi 64 và provenance public", async () => {
  const m = rpcFixture();
  m.f.context.latest = m.f.context.head + sepolia.confirmations;
  const result = await runVerification(
    { ...m.f.input, chainId: BigInt(sepolia.chainId), confirmations: sepolia.confirmations },
    async (method, params, signal) =>
      method === "eth_chainId" ? "0xaa36a7" : m.request(method, params, signal),
    verificationCodec,
  );
  expect(result.status).toBe("VERIFIED");
  expect(result.context).toMatchObject({ head: 100n, provenance: sepolia.provenance });
});
test("RPC mainnet chỉ được đọc eth_chainId rồi bị chặn", async () => {
  const request = vi.fn().mockResolvedValue("0x1");
  const result = await runVerification(fixture().input, request, verificationCodec);
  expect(result.reason).toBe("WRONG_CHAIN");
  expect(result.message).toContain("mainnet bị chặn");
  expect(request.mock.calls).toEqual([["eth_chainId", [], expect.any(AbortSignal)]]);
});
for (const id of ["1", "137", "0", "-1", "oops"])
  test(`VITE_CHAIN_ID ${id} có lỗi tiếng Việt; ConfigGuard không mount RPC`, () => {
    const parsed = parseEnv({ ...env, VITE_CHAIN_ID: id });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(" ")).toMatch(/VITE_CHAIN_ID.*bị từ chối/);
    // Không provider wagmi: bất kỳ hook RPC nào bị mount sẽ ném lỗi và làm test fail.
    const html = renderToStaticMarkup(
      h(
        AppConfigContext.Provider,
        { value: config(Number(id)) },
        h(ConfigGuard, { children: h("p", null, "Không được hiện") }),
      ),
    );
    expect(html).toContain("Lỗi cấu hình");
    expect(html).toContain("bị từ chối");
    expect(html).not.toContain("Không được hiện");
  });
test("viem chain dùng URL fixture được cấp, Sepolia thiếu URL bị từ chối", () => {
  expect(parseEnv({ ...env, VITE_CHAIN_ID: String(sepolia.chainId) }).ok).toBe(false);
  const parsed = parseEnv({
    ...env,
    VITE_CHAIN_ID: String(sepolia.chainId),
    VITE_RPC_URL: config(sepolia.chainId).rpcUrl,
  });
  expect(parsed.ok).toBe(true);
  for (const p of Object.values(CHAIN_PROFILES)) {
    const chain = makeChain(config(p.chainId));
    expect(chain.id).toBe(p.chainId);
    expect(chain.rpcUrls.default.http).toEqual([config(p.chainId).rpcUrl]);
  }
});
for (const p of Object.values(CHAIN_PROFILES))
  test(`${p.name}: link tx và contract chỉ có khi profile có explorer`, () => {
    const hash = `0x${"ab".repeat(32)}` as const;
    const html = renderToStaticMarkup(
      h(
        AppConfigContext.Provider,
        { value: config(p.chainId) },
        h(TxStatusView, { state: { status: "SUCCESS", hash } }),
        h(ExplorerValue, { kind: "address", value: env.VITE_GOV_VOTE }),
      ),
    );
    expect(html.includes("<a ")).toBe(!!p.explorerUrl);
    expect(html).toContain(hash);
    if (p.explorerUrl) {
      expect(html).toContain(`${p.explorerUrl}/tx/${hash}`);
      expect(html).toContain(`${p.explorerUrl}/address/${env.VITE_GOV_VOTE}`);
      expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
      expect(html.match(/target="_blank"/g)).toHaveLength(2);
    }
    expect(explorerLink(p, "tx", "javascript:alert(1)")).toBeUndefined();
  });

// Owner yêu cầu tách rõ chain được phép khỏi lỗi địa chỉ, không sửa assertion test cũ.
test("cấu hình Sepolia được nhận; thiếu địa chỉ chỉ sinh hai lỗi địa chỉ", () => {
  const rpc = "http://127.0.0.1:18549";
  const missing = parseEnv({ VITE_CHAIN_ID: "11155111", VITE_RPC_URL: rpc });
  expect(missing.ok).toBe(false);
  if (!missing.ok) {
    expect(missing.errors).toHaveLength(2);
    expect(missing.errors.every((error) => /Thiếu VITE_GOV_(VOTE|TOKEN)/.test(error))).toBe(true);
    expect(missing.errors.join(" ")).not.toContain("VITE_CHAIN_ID");
  }
  expect(parseEnv({ ...env, VITE_CHAIN_ID: "11155111", VITE_RPC_URL: rpc }).ok).toBe(true);
});
test("cấu hình mainnet vẫn có lỗi chain không được hỗ trợ", () => {
  const parsed = parseEnv({ ...env, VITE_CHAIN_ID: "1" });
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) {
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0]).toMatch(/VITE_CHAIN_ID.*mainnet bị chặn/);
  }
});

// Probe cũng là điểm vào RPC: cấu hình ngoài allowlist phải bị chặn trước fetch.
test("endpoint probe từ chối mainnet trước fetch", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  try {
    await expect(probeEndpoint(config(1).rpcUrl, config(1))).rejects.toThrow(/mainnet bị chặn/);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
for (const profile of Object.values(CHAIN_PROFILES))
  test(`${profile.name}: continuity anchor lấy confirmations của profile`, async () => {
    const m = rpcFixture({ allowUnpinnedReads: true });
    m.f.context.latest = 100n + profile.confirmations;
    vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const result =
        body.method === "eth_chainId"
          ? `0x${profile.chainId.toString(16)}`
          : await m.request(body.method, body.params);
      return Response.json({ id: body.id, jsonrpc: "2.0", result });
    });
    try {
      const cfg = config(profile.chainId);
      await createContinuityProbe()(cfg.rpcUrl, cfg);
      expect(
        m.calls
          .filter((call) => call.method === "eth_getBlockByNumber")
          .map((call) => call.params[0]),
      ).toEqual(["latest", "0x64"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
