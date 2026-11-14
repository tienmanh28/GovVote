// Integration strict CLI trên HTTP server giả; không gọi blockchain hoặc signer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runVerification, verificationExit } from "../../../shared/verification/runner.ts";
import { verificationCodec } from "../src/adapter.ts";
import { rpcFixture } from "./rpcFixture.ts";
const exec = promisify(execFile);
test("strict CLI codec và core dùng evidence đầy đủ", async () => {
  const m = rpcFixture();
  const r = await runVerification(m.f.input, m.request, verificationCodec);
  assert.equal(r.status, "VERIFIED");
  assert.equal(r.calculated?.quorum, 100n);
});
test("strict exit codes tách mismatch/incomplete/RPC", () => {
  assert.deepEqual(
    ["VERIFIED", "MISMATCH", "INCOMPLETE", "RPC_ERROR", "INVALID_INPUT"].map((s) =>
      verificationExit(s as never),
    ),
    [0, 1, 3, 2, 2],
  );
});
for (const [status, flag, code] of [
  ["VERIFIED", undefined, 0],
  ["MISMATCH", "missingVotes", 1],
  ["INCOMPLETE", "missingCreation", 3],
  ["RPC_ERROR", "fail", 2],
] as const)
  test(`strict CLI HTTP fixture ${status}, exit ${code}`, async () => {
    const m = rpcFixture();
    if (flag) m.control[flag] = true;
    const server = createServer(async (req, res) => {
      let requestId = 1;
      try {
        let text = "";
        for await (const chunk of req) text += String(chunk);
        const body = JSON.parse(text) as { id: number; method: string; params: unknown[] };
        requestId = body.id;
        const result = await m.request(body.method, body.params);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
      } catch {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            error: { code: -32000, message: "Fixture RPC error" },
          }),
        );
      }
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      let stdout = "",
        exit = 0;
      try {
        stdout = (
          await exec(process.execPath, ["--import", "tsx", "src/main.ts"], {
            env: {
              ...process.env,
              GOV_VOTE: m.f.input.govVote,
              GOV_TOKEN: m.f.input.govToken,
              GOV_PROPOSAL_ID: "1",
              GOV_CONFIRMATIONS: "12",
              GOV_RPC_URL: `http://127.0.0.1:${address.port}`,
            },
          })
        ).stdout;
      } catch (error) {
        const e = error as { stdout: string; code: number };
        stdout = e.stdout;
        exit = e.code;
      }
      assert.equal(exit, code);
      assert.match(stdout, new RegExp(`"status": "${status}"`));
      assert.match(stdout, /STRICT VERIFICATION/);
      assert.match(stdout, /không Etherscan source-verified/);
      if (status === "VERIFIED") {
        for (const field of [
          "chainId",
          "govVote",
          "proposalId",
          "rpcSource",
          "head",
          "hash",
          "confirmations",
          "forVotes",
          "againstVotes",
          "quorum",
          "expectedState",
          "contractState",
        ])
          assert.match(stdout, new RegExp(`"${field}"`));
      }
      assert.ok(
        m.calls.every(
          (c) => !["eth_sendTransaction", "anvil_mine", "evm_revert"].includes(c.method),
        ),
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
test("strict invalid input không in credentials RPC", async () => {
  let stdout = "",
    code = 0;
  try {
    stdout = (
      await exec(process.execPath, ["--import", "tsx", "src/main.ts"], {
        env: {
          ...process.env,
          GOV_PROPOSAL_ID: "0",
          GOV_RPC_URL:
            "http://fixture-user:fixture-password@localhost:1/private?token=fixture-value",
        },
      })
    ).stdout;
  } catch (error) {
    const e = error as { stdout: string; code: number };
    stdout = e.stdout;
    code = e.code;
  }
  assert.equal(code, 2);
  assert.match(stdout, /INVALID_INPUT/);
  assert.doesNotMatch(stdout, /fixture-password|fixture-value|fixture-user|\/private/);
});
test("CLI legacy/strict không echo input cấu hình nhạy cảm không hợp lệ", async () => {
  for (const proposal of ["1", ""]) {
    let stdout = "",
      stderr = "",
      code = 0;
    try {
      const out = await exec(process.execPath, ["--import", "tsx", "src/main.ts"], {
        env: {
          ...process.env,
          GOV_PROPOSAL_ID: proposal,
          GOV_VOTE: "fixture-sensitive-address",
          GOV_RPC_URL: "http://fixture-user:fixture-password@localhost:1/private",
        },
      });
      stdout = out.stdout;
      stderr = out.stderr;
    } catch (error) {
      const e = error as { stdout: string; stderr: string; code: number };
      stdout = e.stdout;
      stderr = e.stderr;
      code = e.code;
    }
    assert.equal(code, 2);
    assert.doesNotMatch(
      stdout + stderr,
      /fixture-sensitive-address|fixture-user|fixture-password|\/private/,
    );
  }
});
