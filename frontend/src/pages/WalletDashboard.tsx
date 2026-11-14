import { useFreshness, DataFreshness } from "../lib/freshness.tsx";
import { ReadError } from "../components/ReadError.tsx";
// Dashboard của ví: hiển thị RIÊNG ba con số hay bị nhầm lẫn và giải thích bằng tiếng Việt:
//   balanceOf (số dư), getVotes (voting power hiện tại), delegates (người được ủy quyền).
// Kèm nút delegate cho chính mình (GovToken.delegate).
import { useConfig, useReadContract } from "wagmi";
import { simulateContract, writeContract } from "wagmi/actions";
import { zeroAddress } from "viem";
import { govTokenAbi } from "../abi/govToken.ts";
import { useAppConfig, useWallet } from "../appContext.ts";
import { Button, Card, Notice, Spinner, Stat, TxStatusView } from "../components/ui.tsx";
import { formatGov, shortAddress } from "../lib/format.ts";
import { summarizeVotingPower } from "../lib/power.ts";
import { isBusy } from "../lib/txMachine.ts";
import { useCurrentBlock } from "../lib/useCurrentBlock.ts";
import { useTx } from "../lib/useTx.ts";

export function WalletDashboard() {
  const cfg = useAppConfig();
  const wagmiConfig = useConfig();
  const { address, canWrite } = useWallet();
  const block = useCurrentBlock();
  const token = { address: cfg.govToken, abi: govTokenAbi } as const;
  const q = { enabled: !!address && block !== undefined };
  const balance = useReadContract({ chainId: cfg.chainId, ...token, functionName: "balanceOf", args: [address!], blockNumber: block, query: q });
  const votes = useReadContract({ chainId: cfg.chainId, ...token, functionName: "getVotes", args: [address!], blockNumber: block, query: q });
  const delegatee = useReadContract({ chainId: cfg.chainId, ...token, functionName: "delegates", args: [address!], blockNumber: block, query: q });
  const { state: tx, run } = useTx();

  const reads = [balance, votes, delegatee];
  const freshness=useFreshness(reads,`${cfg.rpcUrl}:${address??""}`,block);
  const stamp=<DataFreshness info={freshness} />;
  if (reads.some((q) => q.error)) return <>{stamp}<ReadError queries={reads} /></>;

  if (!address) {
    return (
      <div className="space-y-4">
      {stamp}
        <h1 className="text-xl font-bold sm:text-2xl">Ví của tôi</h1>
        <Notice>Kết nối ví để xem số dư, voting power và người được ủy quyền.</Notice>
      </div>
    );
  }
  if (balance.data === undefined || votes.data === undefined || delegatee.data === undefined) return <>{stamp}<Spinner /></>;

  const sum = summarizeVotingPower(address, balance.data, votes.data, delegatee.data);
  const delegateSelf = () =>
    run(async (assertCurrent) => {
      const { request } = await simulateContract(wagmiConfig, {
        ...token,
        functionName: "delegate",
        args: [address],
        account: address,
        chainId: cfg.chainId,
      });
      assertCurrent();
      return writeContract(wagmiConfig, request);
    });

  return (
    <div className="space-y-4">
      {stamp}
      <h1 className="text-xl font-bold sm:text-2xl">Ví của tôi</h1>
      <p className="text-sm text-slate-600 break-all">
        <span className="font-mono">{address}</span> · dữ liệu tại block {block?.toString()}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Số dư (balanceOf)" value={formatGov(sum.balance)} hint="Lượng GOV ví đang giữ. Có GOV chưa chắc đã vote được." testId="balance" />
        <Stat
          label="Voting power hiện tại (getVotes)"
          value={formatGov(sum.votes)}
          hint="Tổng GOV của mọi ví đã delegate cho ví này, ở block hiện tại."
          testId="votes"
        />
        <Stat
          label="Người được ủy quyền (delegates)"
          value={
            sum.delegation === "none" ? (
              "Chưa delegate"
            ) : sum.delegation === "self" ? (
              "Chính ví này"
            ) : (
              <span className="font-mono" title={delegatee.data}>
                {shortAddress(delegatee.data)}
              </span>
            )
          }
          hint={delegatee.data === zeroAddress ? "delegates() trả về địa chỉ 0x000…0." : "Ví nhận quyền biểu quyết của số dư ở trên."}
          testId="delegatee"
        />
      </div>
      <Card>
        <h2 className="font-semibold">Giải thích</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {sum.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Delegate cho chính mình</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gọi GovToken.delegate(ví của bạn). Voting power chỉ được tính cho proposal có block snapshot từ sau giao dịch này.
        </p>
        <Button className="mt-3 w-full sm:w-auto" disabled={!canWrite || isBusy(tx)} onClick={() => void delegateSelf()}>
          Delegate cho chính mình
        </Button>
        <div className="mt-3">
          <TxStatusView state={tx} />
        </div>
      </Card>
    </div>
  );
}
