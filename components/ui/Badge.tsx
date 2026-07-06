import type { ReactNode } from "react";

const TONES = {
  amber: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  neutral: "bg-white/10 text-slate-300 border-white/15",
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  red: "bg-red-500/15 text-red-300 border-red-400/30",
} as const;

export type BadgeTone = keyof typeof TONES;

export default function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
