// Mỗi nguồn chạy một runner hoàn chỉnh. Chỉ chuyển sau lỗi endpoint, không che mismatch evidence.
import type { VerificationInput, VerificationResult } from "../../../shared/verification/core.ts";
import { DEFAULT_BUDGET, type VerificationProgress } from "../../../shared/verification/runner.ts";
import { rpcSource } from "../../../shared/verification/http.ts";
import { verifyInBrowser } from "./verificationAdapter.ts";
export async function verifyWithFallback(
  input: VerificationInput,
  urls: string[],
  options: {
    signal?: AbortSignal;
    onProgress?: (p: VerificationProgress) => void;
    onSource?: (url: string) => void;
  },
  verify = verifyInBrowser,
): Promise<VerificationResult> {
  const budget = { ...DEFAULT_BUDGET, ...input.budget },
    start = Date.now();
  let spent = 0,
    logs = 0;
  let last: VerificationResult | undefined;
  for (const url of [...new Set(urls)]) {
    if (options.signal?.aborted) break;
    const remaining = budget.maxDurationMs - (Date.now() - start);
    if (remaining <= 0 || spent >= budget.maxRequests || logs >= budget.maxLogs)
      return {
        input,
        status: "INCOMPLETE",
        reason: "RESOURCE_LIMIT",
        message: "Đã hết ngân sách khi chuyển nguồn RPC.",
        requests: spent,
        processedLogs: logs,
      };
    options.onSource?.(url);
    last = await verify(
      {
        ...input,
        rpcSource: rpcSource(url),
        budget: {
          ...budget,
          maxRequests: budget.maxRequests - spent,
          maxLogs: budget.maxLogs - logs,
          maxDurationMs: remaining,
        },
      },
      url,
      options,
    );
    spent += last.requests;
    logs += last.processedLogs;
    if (
      last.status !== "RPC_ERROR" &&
      !(
        last.status === "INVALID_INPUT" &&
        (last.reason === "WRONG_CHAIN" || last.reason === "NO_CODE")
      )
    )
      return last;
  }
  return last
    ? { ...last, message: `Không còn endpoint khả dụng. ${last.message}` }
    : {
        input,
        status: "INCOMPLETE",
        reason: "CANCELLED",
        message: "Đã hủy kiểm chứng.",
        requests: spent,
        processedLogs: logs,
      };
}
