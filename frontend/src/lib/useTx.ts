// Hook chạy một giao dịch theo máy trạng thái trong txMachine.ts.
//   AWAITING_SIGNATURE: đang mô phỏng (simulate) rồi chờ người dùng ký trong ví.
//   PENDING:            đã có tx hash, chờ receipt bằng waitForTransactionReceipt.
//   SUCCESS:            receipt status = success, làm mới (invalidate) toàn bộ query để dữ liệu cập nhật.
//   ERROR:              thông báo tiếng Việt từ errors.ts (hoặc thông báo gốc nếu không nhận ra).
import { useCallback, useReducer, useEffect, useMemo, useRef } from "react";
import { useAppConfig, useWallet } from "../appContext.ts";
import { useConfig } from "wagmi";
import { getAccount, watchAccount } from "wagmi/actions";
import { createSessionScope, sessionKey } from "./session.ts";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import type { Hex, TransactionReceipt } from "viem";
import { toUserMessage } from "../errors.ts";
import { TX_IDLE, txReducer } from "./txMachine.ts";

export function useTx() {
  const config = useConfig();
  const wallet = useWallet();
  const cfg = useAppConfig();
  const queryClient = useQueryClient();
  const scope = useMemo(() => createSessionScope(() => getAccount(config)), [config]);
  const busy = useRef(false);
  useEffect(() => {
    const stop = watchAccount(config, { onChange(next, prev) {
      if (sessionKey(next) !== sessionKey(prev)) {
        scope.invalidate(); busy.current = false; dispatch({ type: "RESET" });
      }
    } });
    return () => { scope.invalidate(); stop(); };
  }, [config, scope]);
  const [state, dispatch] = useReducer(txReducer, TX_IDLE);

  const run = useCallback(
    async (send: (assertCurrent: () => void) => Promise<Hex>, onSuccess?: (receipt: TransactionReceipt) => void) => {
      if (busy.current) return;
      busy.current = true;
      const checkScope = scope.capture();
      const assertCurrent = () => {
        checkScope();
        const live = getAccount(config);
        if (!wallet.canWrite || live.chainId !== cfg.chainId || sessionKey(live) !== sessionKey(wallet))
          throw new Error("Ví hoặc mạng đã thay đổi. Vui lòng kiểm tra dữ liệu và thử lại.");
      };
      const active = () => { try { assertCurrent(); return true; } catch { return false; } };
      dispatch({ type: "START" });
      let hash: Hex;
      try {
        assertCurrent();
        hash = await send(assertCurrent);
        if (!active()) return;
      } catch (err) {
        if (!active()) return;
        busy.current = false;
        dispatch({ type: "FAILED", message: toUserMessage(err) });
        return;
      }
      dispatch({ type: "SIGNED", hash });
      try {
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: cfg.chainId });
        if (!active()) return;
        busy.current = false;
        if (receipt.status !== "success") {
          dispatch({
            type: "FAILED",
            message: `Giao dịch đã vào block ${receipt.blockNumber} nhưng bị revert on-chain (trạng thái có thể đã đổi giữa lúc kiểm tra và lúc giao dịch được đưa vào block).`,
          });
          return;
        }
        dispatch({ type: "CONFIRMED" });
        onSuccess?.(receipt);
        await queryClient.invalidateQueries();
      } catch (err) {
        if (!active()) return;
        busy.current = false;
        dispatch({ type: "FAILED", message: toUserMessage(err) });
      }
    },
    [config, queryClient, scope, wallet, cfg.chainId],
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);
  return { state, run, reset };
}
