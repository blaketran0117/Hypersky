import type { ReactNode } from "react";

/** Label/value row for telemetry: dim label left, monospace value right. */
export default function DataRow({
  label,
  children,
  valueClassName = "",
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-1.5 last:border-b-0">
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`font-mono text-sm tabular-nums text-slate-100 ${valueClassName}`}>{children}</span>
    </div>
  );
}
