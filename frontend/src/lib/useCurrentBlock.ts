// Block mới nhất, cập nhật theo polling (pollingInterval trong config.ts).
// Mọi lệnh đọc trong một trang dùng CÙNG số block này (tham số blockNumber), để state, tally, hasVoted
// và voting power là một ảnh chụp nhất quán, không lẫn dữ liệu của hai block khác nhau.
import { useAppConfig } from "../appContext.ts";
import { useBlockNumber } from "wagmi";

export function useCurrentBlock(): bigint | undefined {
  const { data } = useBlockStatus();
  return data;
}

export function useBlockStatus() {
  const cfg = useAppConfig();
  return useBlockNumber({ chainId: cfg.chainId, watch: true });
}
