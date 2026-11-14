// Thành phần giao diện dùng chung. Mọi nội dung đều render như văn bản (React tự escape),
// không chèn HTML thô ở bất kỳ đâu.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { STATE_LABELS } from "../lib/format.ts";
import type { TxState } from "../lib/txMachine.ts";

/** Nút cao tối thiểu 44px (min-h-11) để dễ chạm trên điện thoại. */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "for" | "against";
}) {
  const tones = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    secondary: "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-100",
    for: "bg-emerald-600 text-white hover:bg-emerald-500",
    against: "bg-rose-600 text-white hover:bg-rose-500",
  } as const;
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "error";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "bg-sky-50 text-sky-950 ring-sky-200",
    warn: "bg-amber-50 text-amber-950 ring-amber-200",
    error: "bg-rose-50 text-rose-950 ring-rose-200",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg p-3 text-sm ring-1 wrap-anywhere ${tones[tone]}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function StateBadge({ state }: { state: number }) {
  const s = STATE_LABELS[state];
  if (!s) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">?</span>;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold lg:whitespace-nowrap ${s.tone}`}
      title={s.name}
    >
      {s.vi} ({s.name})
    </span>
  );
}

/** Một con số có nhãn và lời giải thích ngắn. */
export function Stat({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold wrap-anywhere" data-testid={testId}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

const TX_TEXT: Record<TxState["status"], string> = {
  IDLE: "",
  AWAITING_SIGNATURE: "Đang chờ bạn ký giao dịch trong ví…",
  PENDING: "Đã gửi, đang chờ giao dịch được đưa vào block…",
  SUCCESS: "Giao dịch thành công.",
  ERROR: "Giao dịch không thành công.",
};

/** Hiển thị trạng thái giao dịch và tx hash dạng văn bản (Anvil không có explorer nên không có link). */
export function TxStatusView({ state }: { state: TxState }) {
  if (state.status === "IDLE") return null;
  const tone = state.status === "ERROR" ? "error" : state.status === "SUCCESS" ? "info" : "warn";
  const hash = "hash" in state ? state.hash : undefined;
  return (
    <div data-testid="tx-status" data-status={state.status}>
      <Notice tone={tone} title={`${TX_TEXT[state.status]} [${state.status}]`}>
        {state.status === "ERROR" && <p data-testid="tx-error">{state.message}</p>}
        {hash && (
          <p className="mt-1 font-mono text-xs break-all">
            Tx hash: <span data-testid="tx-hash">{hash}</span>
          </p>
        )}
      </Notice>
    </div>
  );
}

export function Spinner({ label = "Đang tải…" }: { label?: string }) {
  return <p className="text-sm text-slate-500">{label}</p>;
}
