import { useFreshness, DataFreshness } from "../lib/freshness.tsx";
import { ReadError } from "../components/ReadError.tsx";
// Chi tiết proposal: getProposal, state, quorumVotes (chỉ khi đã qua snapshot), và với ví đang kết nối:
// hasVoted, getVotingPowerAt. Mọi lệnh đọc dùng cùng một block. Nút vote chỉ bật khi Active, chưa vote
// và voting power tại snapshot > 0; nếu contract vẫn revert thì lỗi hiện theo errors.ts.
import { useConfig, useReadContract } from "wagmi";
import { simulateContract, writeContract } from "wagmi/actions";
import { govTokenAbi } from "../abi/govToken.ts";
import { govVoteAbi } from "../abi/govVote.ts";
import { useAppConfig, useWallet } from "../appContext.ts";
import {
  Button,
  Card,
  Notice,
  Spinner,
  StateBadge,
  Stat,
  TxStatusView,
} from "../components/ui.tsx";
import { toUserMessage } from "../errors.ts";
import { formatGov } from "../lib/format.ts";
import { isBusy } from "../lib/txMachine.ts";
import { useCurrentBlock } from "../lib/useCurrentBlock.ts";
import { useTx } from "../lib/useTx.ts";

const BPS = 10_000n;

export function ProposalDetail({ id }: { id: bigint }) {
  const cfg = useAppConfig();
  const wagmiConfig = useConfig();
  const { address, canWrite, isConnected, wrongChain } = useWallet();
  const block = useCurrentBlock();
  const at = { blockNumber: block } as const;
  const base = { address: cfg.govVote, abi: govVoteAbi } as const;
  const q = (enabled: boolean) => ({ enabled: block !== undefined && enabled });

  const proposal = useReadContract({
    chainId: cfg.chainId,
    ...base,
    functionName: "getProposal",
    args: [id],
    ...at,
    query: q(true),
  });
  const state = useReadContract({
    chainId: cfg.chainId,
    ...base,
    functionName: "state",
    args: [id],
    ...at,
    query: q(true),
  });
  const p = proposal.data;
  // quorumVotes và getVotingPowerAt revert SnapshotNotFinalized khi block <= snapshot, nên chỉ gọi sau snapshot.
  const pastSnapshot = !!p && block !== undefined && block > p.snapshotBlock;
  const quorum = useReadContract({
    chainId: cfg.chainId,
    ...base,
    functionName: "quorumVotes",
    args: [id],
    ...at,
    query: q(pastSnapshot),
  });
  // Trong Pending: quorum ƯỚC TÍNH từ tổng cung hiện tại (GovToken có tổng cung cố định, đặc tả mục 3.6).
  const quorumBps = useReadContract({
    chainId: cfg.chainId,
    ...base,
    functionName: "quorumBps",
    query: q(!!p && !pastSnapshot),
  });
  const supply = useReadContract({
    chainId: cfg.chainId,
    address: cfg.govToken,
    abi: govTokenAbi,
    functionName: "totalSupply",
    ...at,
    query: q(!!p && !pastSnapshot),
  });
  const hasVoted = useReadContract({
    chainId: cfg.chainId,
    ...base,
    functionName: "hasVoted",
    args: [id, address!],
    ...at,
    query: q(!!address),
  });
  const power = useReadContract({
    chainId: cfg.chainId,
    ...base,
    functionName: "getVotingPowerAt",
    args: [id, address!],
    ...at,
    query: q(!!address && pastSnapshot),
  });
  const expectedPower = useReadContract({
    chainId: cfg.chainId,
    address: cfg.govToken,
    abi: govTokenAbi,
    functionName: "getVotes",
    args: [address!],
    ...at,
    query: q(!!address && !pastSnapshot),
  });
  const { state: tx, run } = useTx();

  const reads = [
    proposal,
    state,
    ...(pastSnapshot ? [quorum] : [quorumBps, supply]),
    ...(address ? [hasVoted, ...(pastSnapshot ? [power] : [expectedPower])] : []),
  ];
  const freshness = useFreshness(reads, `${cfg.rpcUrl}:${address ?? ""}`, block);
  const stamp = <DataFreshness info={freshness} />;
  if (reads.some((q) => q.error))
    return (
      <>
        {stamp}
        <ReadError queries={reads} />
      </>
    );

  if (proposal.error) {
    return (
      <div className="space-y-3">
        <a href="#/" className="text-sm text-sky-800 underline">
          ← Danh sách proposal
        </a>
        <Notice tone="error">{toUserMessage(proposal.error)}</Notice>
      </div>
    );
  }
  if (!p || state.data === undefined || block === undefined)
    return (
      <>
        {stamp}
        <Spinner />
      </>
    );

  const s = state.data;
  const participated = p.forVotes + p.againstVotes;
  const estimatedQuorum =
    supply.data !== undefined && quorumBps.data !== undefined
      ? (supply.data * quorumBps.data + BPS - 1n) / BPS
      : undefined;

  // Lý do khóa nút vote, theo đúng thứ tự kiểm tra của castVote.
  let blockReason: string | null = null;
  if (!isConnected) blockReason = "Kết nối ví để bỏ phiếu.";
  else if (wrongChain) blockReason = "Ví đang ở sai mạng, hãy chuyển sang Anvil (31337).";
  else if (s !== 1)
    blockReason = "Chỉ bỏ phiếu được khi proposal ở trạng thái Đang bỏ phiếu (Active).";
  else if (hasVoted.data) blockReason = "Ví này đã bỏ phiếu cho proposal này.";
  else if (power.data === 0n)
    blockReason =
      "Ví này không có voting power tại block snapshot (chưa có GOV hoặc chưa delegate trước snapshot).";
  else if (power.data === undefined || hasVoted.data === undefined)
    blockReason = "Đang tải quyền bỏ phiếu…";

  const vote = (support: boolean) =>
    run(async (assertCurrent) => {
      const { request } = await simulateContract(wagmiConfig, {
        ...base,
        functionName: "castVote",
        args: [id, support],
        account: address!,
        chainId: cfg.chainId,
      });
      assertCurrent();
      return writeContract(wagmiConfig, request);
    });

  return (
    <div className="space-y-4">
      {stamp}
      <a href="#/" className="inline-flex min-h-11 items-center text-sm text-sky-800 underline">
        ← Danh sách proposal
      </a>
      <a
        href={`#/verify/${id}`}
        className="ml-3 inline-flex min-h-11 items-center text-sky-800 underline"
      >
        Xác minh event / storage
      </a>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-sm font-semibold text-slate-500">Proposal #{id.toString()}</span>
          <StateBadge state={s} />
        </div>
        {/* Title và description luôn là văn bản thuần: React escape nội dung, không chèn HTML thô. */}
        <h1
          className="mt-2 text-xl font-bold wrap-anywhere sm:text-2xl"
          data-testid="proposal-title"
        >
          {p.title}
        </h1>
        <p
          className="mt-3 whitespace-pre-wrap text-slate-700 wrap-anywhere"
          data-testid="proposal-description"
        >
          {p.description || "(không có mô tả)"}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Người tạo: <span className="font-mono break-all">{p.proposer}</span>
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">Kết quả (tại block {block.toString()})</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="For (đồng ý)" value={formatGov(p.forVotes)} testId="tally-for" />
          <Stat
            label="Against (phản đối)"
            value={formatGov(p.againstVotes)}
            testId="tally-against"
          />
          <Stat label="Tham gia (For + Against)" value={formatGov(participated)} />
          {pastSnapshot ? (
            <Stat
              label="Quorum"
              value={quorum.data !== undefined ? formatGov(quorum.data) : "…"}
              hint="10% tổng cung tại snapshot, làm tròn lên. Thông qua khi tham gia ≥ quorum và For > Against."
            />
          ) : (
            <Stat
              label="Quorum (ước tính)"
              value={estimatedQuorum !== undefined ? formatGov(estimatedQuorum) : "…"}
              hint="Chưa qua snapshot nên contract chưa trả quorum; con số này ước tính từ tổng cung hiện tại (GOV có tổng cung cố định)."
            />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Mốc thời gian (tính bằng block)</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Block hiện tại" value={block.toString()} />
          <Stat label="Tạo ở block" value={p.createdBlock.toString()} />
          <Stat
            label="Snapshot block"
            value={p.snapshotBlock.toString()}
            hint="Nhận phiếu từ block snapshot + 1."
          />
          <Stat
            label="Deadline block"
            value={p.deadlineBlock.toString()}
            hint="Vẫn nhận phiếu ở chính block deadline."
          />
        </dl>
        <p className="mt-3 text-xs text-slate-600">
          {s === 0 &&
            `Còn ${(p.snapshotBlock + 1n - block).toString()} block nữa mới bắt đầu nhận phiếu. `}
          {s === 1 && `Còn ${(p.deadlineBlock - block).toString()} block tới deadline. `}
          Đây là số block, không phải thời gian thực. Nếu mạng tạo block 12 giây/lần thì 1 block ≈
          12 giây, nhưng chỉ là ước tính; trên Anvil, block chỉ tăng khi có giao dịch hoặc lệnh
          anvil_mine.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">Bỏ phiếu</h2>
        {address && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat
              label={
                pastSnapshot
                  ? "Voting power của ví tại snapshot"
                  : "Voting power dự kiến trước snapshot"
              }
              value={
                pastSnapshot
                  ? power.data !== undefined
                    ? formatGov(power.data)
                    : "…"
                  : `${expectedPower.data !== undefined ? formatGov(expectedPower.data) : "Đang tải"} (dự kiến, chưa chốt)`
              }
              hint={
                pastSnapshot
                  ? "getVotingPowerAt(id, ví) = getPastVotes tại snapshot."
                  : `getVotes tại block đang đọc, không phải balance; có thể đổi trước khi snapshot ${p.snapshotBlock} chốt. Không bảo đảm đây sẽ là quyền tại snapshot.`
              }
              testId="my-power"
            />
            <Stat
              label="Đã bỏ phiếu?"
              value={hasVoted.data === undefined ? "…" : hasVoted.data ? "Rồi" : "Chưa"}
              testId="has-voted"
            />
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant="for"
            disabled={!!blockReason || !canWrite || isBusy(tx)}
            onClick={() => vote(true)}
          >
            Bỏ phiếu For (Đồng ý)
          </Button>
          <Button
            variant="against"
            disabled={!!blockReason || !canWrite || isBusy(tx)}
            onClick={() => vote(false)}
          >
            Bỏ phiếu Against (Phản đối)
          </Button>
        </div>
        {blockReason && (
          <p className="mt-2 text-sm text-slate-600" data-testid="vote-blocked-reason">
            {blockReason}
          </p>
        )}
        <div className="mt-3">
          <TxStatusView state={tx} />
        </div>
      </Card>
    </div>
  );
}
