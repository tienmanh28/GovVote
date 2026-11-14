// Mỗi cấu hình/ID/confirmations là một phiên. Kết quả cũ không được hiển thị trong phiên mới.
import { useCallback, useEffect, useRef, useState } from "react";
import { verifyWithFallback } from "./verificationFallback.ts";
import { endpoints } from "./endpoint.ts";
import { rpcSource } from "../../../shared/verification/http.ts";
import type { VerificationInput, VerificationResult } from "../../../shared/verification/core.ts";
import type { VerificationProgress } from "../../../shared/verification/runner.ts";
import { useAppConfig } from "../appContext.ts";
export function useVoteVerification(id: bigint, confirmations: string) {
  const cfg = useAppConfig();
  const key = `${cfg.primaryRpcUrl ?? ""}:${(cfg.fallbackRpcUrls ?? []).join(",")}:${cfg.rpcUrl}:${cfg.chainId}:${cfg.govVote}:${cfg.govToken}:${id}:${confirmations}`;
  const current = useRef(key);
  current.current = key;
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ key: string; result: VerificationResult }>();
  const [progress, setProgress] = useState<{ key: string; value: VerificationProgress }>();
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [key],
  );
  const run = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const version = ++generation.current;
    const input: VerificationInput = {
      chainId: BigInt(cfg.chainId),
      govVote: cfg.govVote,
      govToken: cfg.govToken,
      proposalId: id,
      confirmations: /^\d+$/.test(confirmations) ? BigInt(confirmations) : 0n,
      rpcSource: rpcSource(cfg.rpcUrl),
    };
    setState({
      key,
      result: {
        input,
        status: "RUNNING",
        message: "Đang đọc bằng chứng on-chain…",
        requests: 0,
        processedLogs: 0,
      },
    });
    setProgress({ key, value: { requests: 0, ranges: 0, logs: 0 } });
    const active = () =>
      current.current === key && generation.current === version && !abort.signal.aborted;
    const result = await verifyWithFallback(input, endpoints(cfg), {
      signal: abort.signal,
      onSource: (url) => {
        if (active()) {
          setState({
            key,
            result: {
              input: { ...input, rpcSource: rpcSource(url) },
              status: "RUNNING",
              message: `Đang kiểm chứng từ đầu với ${rpcSource(url)}…`,
              requests: 0,
              processedLogs: 0,
            },
          });
          setProgress({ key, value: { requests: 0, ranges: 0, logs: 0 } });
        }
      },
      onProgress: (value) => {
        if (active()) setProgress({ key, value });
      },
    });
    if (active()) setState({ key, result });
  }, [cfg, id, confirmations, key]);
  return {
    result: state?.key === key ? state.result : undefined,
    progress: progress?.key === key ? progress.value : undefined,
    run,
  };
}
