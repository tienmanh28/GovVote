// Nhãn và chính sách mạng lấy từ profile chung để không gắn nhãn local cho testnet.
import { requireChainProfile } from "../../../shared/chains.ts";
import { useFreshness, DataFreshness } from "../lib/freshness.tsx";
import { ReadError } from "../components/ReadError.tsx";
// Form tạo proposal.
// - Bộ đếm byte UTF-8 (TextEncoder) hiển thị trực tiếp, giới hạn đọc từ contract (MAX_TITLE_BYTES, MAX_DESCRIPTION_BYTES).
// - Simulation tại block B kiểm GovToken.getPastVotes(ví, B-1), đúng GovVote.propose.
//   getVotes hiện tại chỉ để tham khảo; vừa nhận quyền ở B cần chờ block mới trước khi gate mở.
//   Dữ liệu UI vẫn có thể đổi trước lúc gửi: simulation và contract luôn quyết định cuối cùng.
import { useState } from "react";
import { useConfig, useReadContract } from "wagmi";
import { simulateContract, writeContract } from "wagmi/actions";
import { decodeEventLog } from "viem";
import { govTokenAbi } from "../abi/govToken.ts";
import { govVoteAbi } from "../abi/govVote.ts";
import { useAppConfig, useWallet } from "../appContext.ts";
import { Button, Card, Notice, Stat, TxStatusView } from "../components/ui.tsx";
import { checkProposalInput } from "../lib/bytes.ts";
import { formatGov } from "../lib/format.ts";
import { isBusy } from "../lib/txMachine.ts";
import { useCurrentBlock } from "../lib/useCurrentBlock.ts";
import { useTx } from "../lib/useTx.ts";

export function CreateProposal() {
  const cfg = useAppConfig();
  const profile = requireChainProfile(cfg.chainId);
  const wagmiConfig = useConfig();
  const { address, canWrite, isConnected } = useWallet();
  const block = useCurrentBlock();
  // Không hỏi timepoint tương lai hoặc trừ dưới genesis khi block chưa sẵn sàng.
  const previousBlock = block !== undefined && block > 0n ? block - 1n : undefined;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createdId, setCreatedId] = useState<bigint | null>(null);
  const { state: tx, run } = useTx();

  const gov = { address: cfg.govVote, abi: govVoteAbi } as const;
  const threshold = useReadContract({
    chainId: cfg.chainId,
    ...gov,
    functionName: "proposalThreshold",
  });
  const maxTitle = useReadContract({
    chainId: cfg.chainId,
    ...gov,
    functionName: "MAX_TITLE_BYTES",
  });
  const maxDesc = useReadContract({
    chainId: cfg.chainId,
    ...gov,
    functionName: "MAX_DESCRIPTION_BYTES",
  });
  const votes = useReadContract({
    chainId: cfg.chainId,
    address: cfg.govToken,
    abi: govTokenAbi,
    functionName: "getVotes",
    args: [address!],
    blockNumber: block,
    query: { enabled: !!address && block !== undefined },
  });

  // Ghim cả state đọc và timepoint: tại B chỉ kiểm quyền đã chốt ở B-1, không dự đoán B+1.
  const eligibility = useReadContract({
    chainId: cfg.chainId,
    address: cfg.govToken,
    abi: govTokenAbi,
    functionName: "getPastVotes",
    args: [address!, previousBlock ?? 0n],
    blockNumber: block,
    query: { enabled: !!address && previousBlock !== undefined },
  });
  const reads = [threshold, maxTitle, maxDesc, ...(address ? [votes, eligibility] : [])];
  const freshness = useFreshness(reads, `${cfg.rpcUrl}:${address ?? ""}`, block);
  const stamp = <DataFreshness info={freshness} />;
  if (reads.some((q) => q.error))
    return (
      <>
        {stamp}
        <ReadError queries={reads} />
      </>
    );

  const limitsReady = maxTitle.data !== undefined && maxDesc.data !== undefined;
  const check = checkProposalInput(
    title,
    description,
    Number(maxTitle.data ?? 0n),
    Number(maxDesc.data ?? 0n),
  );
  const enoughPower =
    eligibility.data !== undefined &&
    threshold.data !== undefined &&
    eligibility.data >= threshold.data;

  let blockReason: string | null = null;
  if (!isConnected) blockReason = "Kết nối ví để tạo proposal.";
  else if (!canWrite)
    blockReason = `Ví đang ở sai mạng, hãy chuyển sang ${profile.name} (${profile.chainId}).`;
  else if (eligibility.data === undefined || threshold.data === undefined)
    blockReason = "Đang tải voting power…";
  else if (!enoughPower)
    blockReason = `Voting power tại block trước (${previousBlock?.toString() ?? "…"}) là ${formatGov(eligibility.data)}, cần tối thiểu ${formatGov(threshold.data)}. Nếu vừa delegate hoặc nhận quyền, hãy đợi block mới.`;
  else if (!limitsReady) blockReason = "Đang tải giới hạn độ dài…";
  else if (!check.ok) blockReason = check.titleError ?? check.descriptionError;

  const submit = () =>
    run(
      async (assertCurrent) => {
        setCreatedId(null);
        const { request } = await simulateContract(wagmiConfig, {
          ...gov,
          functionName: "propose",
          args: [title, description],
          account: address!,
          chainId: cfg.chainId,
        });
        assertCurrent();
        return writeContract(wagmiConfig, request);
      },
      (receipt) => {
        for (const log of receipt.logs) {
          try {
            const ev = decodeEventLog({ abi: govVoteAbi, data: log.data, topics: log.topics });
            if (ev.eventName === "ProposalCreated") setCreatedId(ev.args.id);
          } catch {
            // log của contract khác hoặc event khác: bỏ qua.
          }
        }
      },
    );

  const counter = (bytes: number, max: bigint | undefined, testId: string) => (
    <span
      className={`text-xs ${max !== undefined && bytes > Number(max) ? "font-semibold text-rose-700" : "text-slate-500"}`}
      data-testid={testId}
    >
      {bytes}/{max?.toString() ?? "…"} byte
    </span>
  );

  return (
    <div className="space-y-4">
      {stamp}
      <h1 className="text-xl font-bold sm:text-2xl">Tạo proposal</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          label="Ngưỡng tạo proposal"
          value={threshold.data !== undefined ? formatGov(threshold.data) : "…"}
          hint="Đọc từ proposalThreshold() của contract."
        />
        <Stat
          label={`Voting power hiện tại của ví (block ${block?.toString() ?? "…"})`}
          value={
            address ? (votes.data !== undefined ? formatGov(votes.data) : "…") : "Chưa kết nối ví"
          }
          hint="getVotes(ví) chỉ tham khảo hiện tại; gate dùng quyền tại block trước, không phải số dư."
          testId="current-votes"
        />
        <Stat
          label={`Quyền tạo proposal tại block trước (${previousBlock?.toString() ?? "…"})`}
          value={
            address
              ? eligibility.data !== undefined
                ? formatGov(eligibility.data)
                : "…"
              : "Chưa kết nối ví"
          }
          hint="getPastVotes(ví, B−1) tại block B, cùng quy tắc với simulation."
          testId="proposal-eligibility-votes"
        />
      </div>
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!blockReason) void submit();
          }}
        >
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="title" className="text-sm font-semibold">
                Tiêu đề (1–{maxTitle.data?.toString() ?? "…"} byte UTF-8)
              </label>
              {counter(check.titleBytes, maxTitle.data, "title-bytes")}
            </div>
            <input
              id="title"
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
            />
            {title.length > 0 && check.titleError && (
              <p className="mt-1 text-sm text-rose-700">{check.titleError}</p>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="description" className="text-sm font-semibold">
                Mô tả (tối đa {maxDesc.data?.toString() ?? "…"} byte UTF-8)
              </label>
              {counter(check.descriptionBytes, maxDesc.data, "description-bytes")}
            </div>
            <textarea
              id="description"
              rows={6}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {check.descriptionError && (
              <p className="mt-1 text-sm text-rose-700">{check.descriptionError}</p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Byte được đếm bằng TextEncoder, giống cách contract đếm. Chữ có dấu tiếng Việt chiếm 2–3
            byte mỗi ký tự, emoji chiếm 4 byte trở lên.
          </p>
          <Button type="submit" className="w-full sm:w-auto" disabled={!!blockReason || isBusy(tx)}>
            Gửi proposal
          </Button>
          {blockReason && (
            <p className="text-sm text-slate-600" data-testid="create-blocked-reason">
              {blockReason}
            </p>
          )}
        </form>
        <div className="mt-3 space-y-2">
          <TxStatusView state={tx} />
          {tx.status === "SUCCESS" && createdId !== null && (
            <Notice title="Đã tạo proposal">
              <a
                className="font-semibold underline"
                href={`#/proposal/${createdId}`}
                data-testid="created-link"
              >
                Xem proposal #{createdId.toString()}
              </a>
            </Notice>
          )}
        </div>
      </Card>
    </div>
  );
}
