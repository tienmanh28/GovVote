// CLI qua HTTP fixture thật để kiểm EIP-1898 và giữ exit 3 cho INCOMPLETE.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rpcFixture } from "./rpcFixture.ts";
const exec = promisify(execFile);
for (const rejectMethod of [undefined, "eth_getCode", "eth_call"])
  test(`CLI EIP-1898: ${rejectMethod ?? "hash hợp lệ"}`, async () => {
    const m = rpcFixture();
    const calls: { method: string; params: unknown[] }[] = [];
    const server = createServer(async (req, res) => {
      let text = "";
      for await (const chunk of req) text += String(chunk);
      const body = JSON.parse(text) as { id: number; method: string; params: unknown[] };
      calls.push(body);
      const reply =
        body.method === rejectMethod
          ? { error: { code: -32602, message: "blockHash unsupported" } }
          : { result: await m.request(body.method, body.params) };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, ...reply }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      let stdout = "",
        code = 0;
      try {
        stdout = (
          await exec(process.execPath, ["--import", "tsx", "src/main.ts"], {
            env: {
              ...process.env,
              GOV_PROPOSAL_ID: "1",
              GOV_VOTE: m.f.input.govVote,
              GOV_TOKEN: m.f.input.govToken,
              GOV_RPC_URL: `http://127.0.0.1:${address.port}`,
            },
          })
        ).stdout;
      } catch (error) {
        const e = error as { stdout: string; code: number };
        stdout = e.stdout;
        code = e.code;
      }
      assert.equal(code, rejectMethod ? 3 : 0);
      assert.match(stdout, new RegExp(`"status": "${rejectMethod ? "INCOMPLETE" : "VERIFIED"}"`));
      if (rejectMethod) assert.match(stdout, /EIP-1898/);
      const reads = calls.filter((c) => ["eth_call", "eth_getCode"].includes(c.method));
      assert.ok(reads.length > 0);
      for (const c of reads)
        assert.deepEqual(c.params[1], { blockHash: m.f.context.hash, requireCanonical: true });
      if (rejectMethod) assert.equal(calls.filter((c) => c.method === rejectMethod).length, 1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
