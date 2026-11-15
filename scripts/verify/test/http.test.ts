// HTTP chunked thật: CLI phải giữ exit 0 ở biên 5 MiB, exit 3 khi payload vượt ngân sách.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_MAX_RESPONSE_BYTES } from "../../../shared/verification/http.ts";
import { rpcFixture } from "./rpcFixture.ts";
const exec = promisify(execFile);
for (const [size, advertised] of [
  [DEFAULT_MAX_RESPONSE_BYTES, false],
  [DEFAULT_MAX_RESPONSE_BYTES + 1, false],
  [DEFAULT_MAX_RESPONSE_BYTES + 1, true],
] as const)
  test(`CLI body ${size} bytes, Content-Length=${advertised}`, async () => {
    const m = rpcFixture();
    const server = createServer(async (req, res) => {
      let text = "";
      for await (const chunk of req) text += String(chunk);
      const body = JSON.parse(text) as { id: number; method: string; params: unknown[] };
      const result = await m.request(body.method, body.params);
      let reply = JSON.stringify({ jsonrpc: "2.0", id: body.id, result });
      if (body.method === "eth_chainId") reply = reply.padEnd(size);
      res.writeHead(200, {
        "content-type": "application/json",
        ...(advertised ? { "content-length": Buffer.byteLength(reply) } : {}),
      });
      // Chia chunk thay vì trả một buffer duy nhất để đi qua đường đọc streaming thực tế.
      for (let offset = 0; offset < reply.length; offset += 16384)
        res.write(reply.slice(offset, offset + 16384));
      res.end();
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
      const over = size > DEFAULT_MAX_RESPONSE_BYTES;
      assert.equal(code, over ? 3 : 0);
      assert.match(stdout, new RegExp(`"status": "${over ? "INCOMPLETE" : "VERIFIED"}"`));
      if (over) assert.match(stdout, /RESOURCE_LIMIT/);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
