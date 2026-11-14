// Không có GOV_PROPOSAL_ID: tương thích CLI legacy, chỉ đối chiếu tally.
// Strict: GOV_PROPOSAL_ID=<id> npm run verify. Không đọc key hoặc ký giao dịch.
import { verificationCodec } from "./adapter.ts";
import { createHttpRequest, rpcSource } from "../../../shared/verification/http.ts";
import { runVerification, verificationExit } from "../../../shared/verification/runner.ts";
import { addressValid } from "../../../shared/verification/core.ts";
import type { VerificationInput, VerificationBudget } from "../../../shared/verification/core.ts";
async function main() {
  if (!process.env.GOV_PROPOSAL_ID) {
    console.log("LEGACY TALLY ONLY — không phải strict verification mục 4.5.");
    await import("./legacy-main.ts");
    return;
  }
  const url = process.env.GOV_RPC_URL ?? "http://127.0.0.1:8545";
  const decimal = (value: string) => (/^\d+$/.test(value) ? BigInt(value) : -1n);
  const budget: Partial<VerificationBudget> = {};
  const fields = {
    GOV_VERIFY_MAX_REQUESTS: "maxRequests",
    GOV_VERIFY_MAX_LOGS: "maxLogs",
    GOV_VERIFY_MAX_MS: "maxDurationMs",
    GOV_VERIFY_RETRIES: "retries",
    GOV_VERIFY_TIMEOUT_MS: "requestTimeoutMs",
  } as const;
  for (const [env, key] of Object.entries(fields))
    if (process.env[env] !== undefined) budget[key] = Number(process.env[env]);
  if (process.env.GOV_VERIFY_RANGE !== undefined)
    budget.rangeSize = decimal(process.env.GOV_VERIFY_RANGE);
  const input: VerificationInput = {
    chainId: 31337n,
    govVote: process.env.GOV_VOTE ?? "",
    govToken: process.env.GOV_TOKEN,
    proposalId: decimal(process.env.GOV_PROPOSAL_ID),
    confirmations: decimal(process.env.GOV_CONFIRMATIONS ?? "12"),
    rpcSource: rpcSource(url),
    budget,
  };
  const result = await runVerification(input, createHttpRequest(url), verificationCodec);
  // URL origin đã loại credentials/path/query; không in thông báo lỗi transport có thể chứa URL bí mật.
  console.log("STRICT VERIFICATION — LOCAL ANVIL; không Etherscan source-verified");
  const printable = {
    ...result,
    input: {
      ...result.input,
      govVote: addressValid(result.input.govVote) ? result.input.govVote : "[địa chỉ không hợp lệ]",
      govToken:
        result.input.govToken === undefined
          ? undefined
          : addressValid(result.input.govToken)
            ? result.input.govToken
            : "[địa chỉ không hợp lệ]",
    },
  };
  console.log(
    JSON.stringify(
      printable,
      (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
  process.exitCode = verificationExit(result.status);
}
main().catch(() => {
  console.error("Không thể hoàn tất CLI verification.");
  process.exitCode = 2;
});
