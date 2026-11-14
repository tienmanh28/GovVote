import { formatGov } from "../lib/format.ts";
import { quorumProgress } from "../lib/proposalList.ts";
export function QuorumProgress({
  forVotes,
  againstVotes,
  quorum,
}: {
  forVotes: bigint;
  againstVotes: bigint;
  quorum?: bigint;
}) {
  if (quorum === undefined)
    return <p className="mt-2 text-xs text-slate-600">Quorum: chưa chốt snapshot.</p>;
  if (quorum <= 0n) return <p role="alert">Quorum không hợp lệ.</p>;
  const progress = quorumProgress(forVotes, againstVotes, quorum);
  return (
    <div className="mt-2 text-xs text-slate-600" data-testid="quorum-progress">
      <p className="wrap-anywhere">
        Quorum: {formatGov(progress.participation)} / {formatGov(quorum)} · {progress.percent} ·{" "}
        {progress.met ? "Đã đạt" : "Chưa đạt"}
      </p>
      <div
        role="progressbar"
        aria-label="Tiến độ quorum"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.bar}
        aria-valuetext={`${progress.percent}, ${progress.met ? "đã đạt" : "chưa đạt"}`}
        className="mt-1 h-2 overflow-hidden rounded bg-slate-200"
      >
        <div style={{ width: `${progress.bar}%` }} className="h-full bg-sky-600" />
      </div>
      <p>For + Against; đạt quorum chưa đồng nghĩa thông qua.</p>
    </div>
  );
}
