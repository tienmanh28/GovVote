// Kiểm cấu hình trước khi tạo transport; không có endpoint public ngầm định.
import { DEFAULT_CHAIN_PROFILE, requireChainProfile } from "../../../shared/chains.ts";
export class ChainConfigError extends Error {}
export function readChainConfig(env: Record<string, string | undefined>) {
  let profile;
  try {
    profile = requireChainProfile(env.GOV_CHAIN_ID ?? DEFAULT_CHAIN_PROFILE.chainId);
  } catch (error) {
    throw new ChainConfigError((error as Error).message);
  }
  if (profile !== DEFAULT_CHAIN_PROFILE && !env.GOV_RPC_URL?.trim())
    throw new ChainConfigError(
      `GOV_RPC_URL bắt buộc khi dùng ${profile.displayName}; không tự chọn RPC công khai.`,
    );
  return { profile, rpcUrl: env.GOV_RPC_URL ?? "http://127.0.0.1:8545" };
}
