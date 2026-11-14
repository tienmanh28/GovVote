// Context chứa cấu hình đã kiểm tra (địa chỉ contract, chain) cho mọi component.
import { createContext, useContext } from "react";
import { useAccount } from "wagmi";
import type { AppConfig } from "./config.ts";

export const AppConfigContext = createContext<AppConfig | null>(null);

export function useAppConfig(): AppConfig {
  const cfg = useContext(AppConfigContext);
  if (!cfg) throw new Error("AppConfigContext chưa được cung cấp");
  return cfg;
}

/** Trạng thái ví gộp lại: đã kết nối chưa, có đúng chain không. */
export function useWallet() {
  const cfg = useAppConfig();
  const { address, isConnected, chainId } = useAccount();
  const wrongChain = isConnected && chainId !== cfg.chainId;
  return {
    address,
    isConnected,
    chainId,
    wrongChain,
    canWrite: isConnected && !wrongChain && !!address,
  };
}
