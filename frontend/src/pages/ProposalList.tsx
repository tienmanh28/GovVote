import { useFreshness, DataFreshness } from "../lib/freshness.tsx";
import { useState } from "react";
import { QuorumProgress } from "../components/QuorumProgress.tsx";
import { proposalWindow, matchesStatus, type StatusFilter } from "../lib/proposalList.ts";
import { ReadError } from "../components/ReadError.tsx";
// Danh sách proposal: proposalCount, rồi getProposal và state cho từng id, cùng một block.
// Dưới 768px hiển thị thẻ xếp dọc; từ 768px (md) trở lên hiển thị bảng.
import { useReadContract, useReadContracts } from "wagmi";
import { govVoteAbi } from "../abi/govVote.ts";
import { useAppConfig } from "../appContext.ts";
import { Button, Card, Notice, Spinner, StateBadge } from "../components/ui.tsx";
import { formatGov } from "../lib/format.ts";
import { useCurrentBlock } from "../lib/useCurrentBlock.ts";

export function ProposalList() {
  const [requestedPage, setPage] = useState(0n);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const cfg = useAppConfig();
  const { govVote } = cfg;
  const block = useCurrentBlock();
  const enabled = block !== undefined;
  const count = useReadContract({
    chainId: cfg.chainId,
    address: govVote,
    abi: govVoteAbi,
    functionName: "proposalCount",
    blockNumber: block,
    query: { enabled },
  });
  const n = count.data ?? 0n;
  // Mới nhất lên đầu.
  const window = proposalWindow(n, requestedPage);
  const { ids } = window;
  const proposals = useReadContracts({
    allowFailure: false,
    contracts: ids.map(
      (id) =>
        ({
          chainId: cfg.chainId,
          address: govVote,
          abi: govVoteAbi,
          functionName: "getProposal",
          args: [id],
        }) as const,
    ),
    blockNumber: block,
    query: { enabled: enabled && ids.length > 0 },
  });
  const states = useReadContracts({
    allowFailure: false,
    contracts: ids.map(
      (id) =>
        ({
          chainId: cfg.chainId,
          address: govVote,
          abi: govVoteAbi,
          functionName: "state",
          args: [id],
        }) as const,
    ),
    blockNumber: block,
    query: { enabled: enabled && ids.length > 0 },
  });

  // quorumVotes revert ở snapshot chưa hoàn tất: tuyệt đối không gọi trong Pending.
  const finalized = ids.filter((_, i) => {
    const p = proposals.data?.[i];
    return p && block !== undefined && block > p.snapshotBlock;
  });
  const quorums = useReadContracts({
    allowFailure: false,
    contracts: finalized.map(
      (id) =>
        ({
          chainId: cfg.chainId,
          address: govVote,
          abi: govVoteAbi,
          functionName: "quorumVotes",
          args: [id],
        }) as const,
    ),
    blockNumber: block,
    query: { enabled: enabled && finalized.length > 0 },
  });
  const reads = [count, proposals, states, quorums];
  const freshness = useFreshness(
    n === 0n ? [count] : [count, proposals, states, ...(finalized.length ? [quorums] : [])],
    `${cfg.rpcUrl}:${window.page}`,
    block,
  );
  const stamp = <DataFreshness info={freshness} />;
  if (reads.some((q) => q.error))
    return (
      <>
        {stamp}
        <ReadError queries={reads} />
      </>
    );

  if (count.data === undefined)
    return (
      <>
        {stamp}
        <Spinner />
      </>
    );

  if (n > 0n && (!proposals.data || !states.data || (finalized.length > 0 && !quorums.data)))
    return (
      <>
        {stamp}
        <Spinner label="Đang tải trang proposal…" />
      </>
    );
  const rows = ids
    .map((id, i) => ({
      id,
      p: proposals.data?.[i],
      s: states.data?.[i],
      q: quorums.data?.[finalized.indexOf(id)],
    }))
    .filter((row) => row.s !== undefined && matchesStatus(row.s, filter));

  return (
    <div className="space-y-4">
      {stamp}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">Proposal</h1>
        <p className="text-sm text-slate-600" data-testid="proposal-count">
          Tổng: {n.toString()} proposal
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="status-filter">Trạng thái trong trang:</label>
        <select
          id="status-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="min-h-11 rounded border border-slate-300 bg-white px-3"
        >
          <option value="all">Tất cả</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <p className="text-xs text-slate-600">
        Lọc trong tối đa 10 ID của trang này; Closed gồm Succeeded và Defeated. Duyệt trang khác để
        xem proposal cũ. Dữ liệu tại block {block?.toString()}.
      </p>
      <div className="flex flex-wrap items-center gap-3" aria-label="Phân trang proposal">
        <Button disabled={window.page === 0n} onClick={() => setPage(window.page - 1n)}>
          Trang mới hơn
        </Button>
        <span data-testid="page-number">
          Trang {(window.page + 1n).toString()} / {window.pages.toString()}
        </span>
        <Button
          disabled={window.page + 1n >= window.pages}
          onClick={() => setPage(window.page + 1n)}
        >
          Trang cũ hơn
        </Button>
      </div>
      {n === 0n && <Notice>Chưa có proposal nào.</Notice>}
      {n > 0n && rows.length === 0 && (
        <Notice>Không có proposal khớp bộ lọc trong trang này.</Notice>
      )}

      {/* Điện thoại: thẻ xếp dọc */}
      <ul className="space-y-3 md:hidden" data-testid="proposal-cards">
        {rows.map(({ id, p, s, q }) => (
          <li key={id.toString()}>
            <a
              href={`#/proposal/${id}`}
              className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-500">#{id.toString()}</span>
                  {s !== undefined && <StateBadge state={s} />}
                </div>
                <p className="mt-2 font-semibold wrap-anywhere">{p?.title ?? "…"}</p>
                {p && (
                  <QuorumProgress forVotes={p.forVotes} againstVotes={p.againstVotes} quorum={q} />
                )}
                {p && (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500">For</dt>
                      <dd className="font-medium">{formatGov(p.forVotes)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Against</dt>
                      <dd className="font-medium">{formatGov(p.againstVotes)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500">Deadline (block)</dt>
                      <dd className="font-medium">{p.deadlineBlock.toString()}</dd>
                    </div>
                  </dl>
                )}
              </Card>
            </a>
          </li>
        ))}
      </ul>

      {/* Máy tính bảng ngang và máy tính: bảng */}
      {n > 0n && (
        <div className="hidden md:block" data-testid="proposal-table">
          <Card className="p-0 sm:p-0">
            {/* table-auto: cột số và trạng thái chỉ rộng vừa nội dung (không xuống dòng), phần còn lại dành cho tiêu đề.
                Cột tiêu đề có min-width để ở 768px không bị bẻ từng ký tự. */}
            <table className="w-full table-auto text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 lg:px-4">ID</th>
                  <th className="w-full px-3 py-3 lg:px-4">Tiêu đề</th>
                  <th className="px-3 py-3 lg:px-4">Trạng thái</th>
                  <th className="px-3 py-3 text-right lg:px-4">For</th>
                  <th className="px-3 py-3 text-right lg:px-4">Against</th>
                  <th className="px-3 py-3 text-right lg:px-4">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ id, p, s, q }) => (
                  <tr
                    key={id.toString()}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 font-semibold whitespace-nowrap lg:px-4">
                      #{id.toString()}
                    </td>
                    <td className="min-w-48 px-3 py-3 lg:px-4">
                      <a
                        className="font-medium text-sky-800 underline-offset-2 hover:underline wrap-anywhere"
                        href={`#/proposal/${id}`}
                      >
                        {p?.title ?? "…"}
                      </a>
                      {p && (
                        <QuorumProgress
                          forVotes={p.forVotes}
                          againstVotes={p.againstVotes}
                          quorum={q}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 lg:px-4">
                      {s !== undefined && <StateBadge state={s} />}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap lg:px-4">
                      {p ? formatGov(p.forVotes) : ""}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap lg:px-4">
                      {p ? formatGov(p.againstVotes) : ""}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap lg:px-4">
                      {p?.deadlineBlock.toString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Deadline tính bằng số block, không phải thời gian thực.
      </p>
    </div>
  );
}
