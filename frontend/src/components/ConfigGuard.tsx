// Chặn hiển thị khi cấu hình sai, thay vì cho trang hiện dữ liệu rỗng gây hiểu nhầm.
// Kiểm tra theo thứ tự: RPC trả đúng chainId → VITE_GOV_VOTE có bytecode → VITE_GOV_TOKEN có bytecode
// → GovVote.token() trỏ đúng VITE_GOV_TOKEN.
import { ReadError } from "./ReadError.tsx";
import type { ReactNode } from "react";
import { useBytecode, usePublicClient, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { govVoteAbi } from "../abi/govVote.ts";
import { useAppConfig } from "../appContext.ts";
import { Notice, Spinner } from "./ui.tsx";

export function ConfigGuard({ children }: { children: ReactNode }) {
  const cfg = useAppConfig();
  const client = usePublicClient({ chainId: cfg.chainId });
  const rpcChain = useQuery({ queryKey: ["rpc-chain-id", cfg.rpcUrl], queryFn: () => client!.getChainId(), enabled: !!client, retry: 1 });
  const govCode = useBytecode({ chainId: cfg.chainId, address: cfg.govVote, query: { enabled: rpcChain.data === cfg.chainId } });
  const tokenCode = useBytecode({ chainId: cfg.chainId, address: cfg.govToken, query: { enabled: rpcChain.data === cfg.chainId } });
  const hasGov = !!govCode.data && govCode.data !== "0x";
  const tokenOfGov = useReadContract({ chainId: cfg.chainId, address: cfg.govVote, abi: govVoteAbi, functionName: "token", query: { enabled: hasGov } });

  const fail = (msg: ReactNode) => (
    <div data-testid="config-error">
      <Notice tone="error" title="Lỗi cấu hình">
        {msg}
      </Notice>
    </div>
  );

  const reads = [rpcChain, govCode, tokenCode, tokenOfGov];
  if (reads.some((q) => q.error)) return <ReadError queries={reads} />;
  if (rpcChain.data === undefined) return <Spinner label="Đang kiểm tra RPC…" />;
  if (rpcChain.data !== cfg.chainId) return fail(<p>RPC {cfg.rpcUrl} trả chainId {rpcChain.data}, cấu hình cần {cfg.chainId}.</p>);
  if (govCode.isLoading || tokenCode.isLoading) return <Spinner label="Đang kiểm tra contract…" />;
  if (!hasGov) {
    return fail(
      <p>
        Không có bytecode tại VITE_GOV_VOTE = <span className="font-mono break-all">{cfg.govVote}</span> trên chain {cfg.chainId}.
        Kiểm tra .env.local, hoặc deploy lại nếu Anvil đã được khởi động lại.
      </p>,
    );
  }
  if (!tokenCode.data || tokenCode.data === "0x") {
    return fail(
      <p>
        Không có bytecode tại VITE_GOV_TOKEN = <span className="font-mono break-all">{cfg.govToken}</span>.
      </p>,
    );
  }
  if (tokenOfGov.data && tokenOfGov.data.toLowerCase() !== cfg.govToken.toLowerCase()) {
    return fail(
      <p>
        GovVote.token() = <span className="font-mono break-all">{tokenOfGov.data}</span> khác VITE_GOV_TOKEN ={" "}
        <span className="font-mono break-all">{cfg.govToken}</span>.
      </p>,
    );
  }
  if (!tokenOfGov.data) return <Spinner label="Đang kiểm tra contract…" />;
  return <>{children}</>;
}
