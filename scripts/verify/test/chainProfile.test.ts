// HTTP fixture chỉ nghe loopback: kiểm cả hai CLI mà không gọi mạng blockchain công khai.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rpcFixture } from "./rpcFixture.ts";
import { CHAIN_PROFILES } from "../../../shared/chains.ts";
const exec = promisify(execFile);
async function withRpc(
  run: (url: string, calls: { method: string; params: unknown[] }[]) => Promise<void>,
  strict: boolean,
  actual = "0xaa36a7",
) {
  const fixture = rpcFixture();
  const calls: { method: string; params: unknown[] }[] = [];
  fixture.f.context.latest = fixture.f.context.head + CHAIN_PROFILES.sepolia.confirmations;
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += String(chunk);
    const request = JSON.parse(body);
    calls.push(request);
    let result;
    if (request.method === "eth_chainId") result = actual;
    else if (strict) result = await fixture.request(request.method, request.params);
    else if (request.method === "eth_blockNumber") result = "0xa4";
    else if (request.method === "eth_getCode") result = "0x6000";
    else if (request.method === "eth_call") result = `0x${"0".repeat(64)}`;
    else if (request.method === "eth_getLogs") result = [];
    else throw new Error(`RPC fixture không biết ${request.method}`);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}`, calls);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
async function cli(strict: boolean, chainId: string, url: string) {
  const env = {
    ...process.env,
    GOV_CHAIN_ID: chainId,
    GOV_RPC_URL: url,
    GOV_VOTE: rpcFixture().f.input.govVote,
    GOV_PROPOSAL_ID: strict ? "1" : "",
    GOV_CONFIRMATIONS: undefined,
  };
  try {
    const output = await exec(process.execPath, ["--import", "tsx", "src/main.ts"], { env });
    return { code: 0, ...output };
  } catch (error) {
    return error as { code: number; stdout: string; stderr: string };
  }
}
for (const strict of [true, false]) {
  const mode = strict ? "strict" : "legacy";
  for (const id of ["1", "137", "0", "-1", "oops"])
    test(`${mode}: chain ${id} exit 2 trước RPC`, async () => {
      await withRpc(async (url, calls) => {
        const result = await cli(strict, id, url);
        assert.equal(result.code, 2);
        assert.match(result.stderr, /bị từ chối/);
        assert.deepEqual(calls, []);
      }, strict);
    });
  test(`${mode}: Sepolia fixture VERIFIED và mặc định 64 confirmations`, async () => {
    await withRpc(async (url, calls) => {
      const result = await cli(strict, "11155111", url);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /VERIFIED/);
      if (strict) {
        assert.match(result.stdout, /PUBLIC_TESTNET_DEPLOYMENT_EVIDENCE/);
        assert.match(result.stdout, /"confirmations": "64"/);
        assert.match(result.stdout, /"head": "100"/);
      } else {
        assert.match(result.stdout, /164 \/ 100 \(chờ 64 block xác nhận\)/);
        assert.ok(calls.some((call) => call.method === "eth_getCode" && call.params[1] === "0x64"));
      }
    }, strict);
  });
  test(`${mode}: RPC thực trả mainnet bị chặn ngay sau eth_chainId`, async () => {
    await withRpc(
      async (url, calls) => {
        const result = await cli(strict, "11155111", url);
        assert.equal(result.code, 2);
        assert.match(result.stdout + result.stderr, /mainnet bị chặn/);
        assert.deepEqual(
          calls.map((call) => call.method),
          ["eth_chainId"],
        );
      },
      strict,
      "0x1",
    );
  });
}
