"use client";

import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import type { FeedStatus } from "@/lib/types";
import { feedAtom, statsAtom } from "@/state/atoms";

const STATUS_META: Record<FeedStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: "Connecting", dot: "bg-slate-400", text: "text-slate-400" },
  live: { label: "Live", dot: "bg-emerald-400", text: "text-emerald-300" },
  retrying: { label: "Retrying", dot: "bg-amber-400", text: "text-amber-300" },
  down: { label: "Feed down", dot: "bg-red-400", text: "text-red-300" },
};

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-baseline gap-1.5 whitespace-nowrap ${className}`}>
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</span>
      <span className="font-mono text-sm tabular-nums text-slate-100">{value}</span>
    </div>
  );
}

/** Top bar: brand, global counts, and data freshness. Subscribes only to counts + feed health. */
export default function StatsBar() {
  const stats = useAtomValue(statsAtom);
  const feed = useAtomValue(feedAtom);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = STATUS_META[feed.status];
  const ageS = feed.lastSuccessAt !== null ? Math.max(0, (nowMs - feed.lastSuccessAt) / 1000) : null;

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-between border-b border-white/10 bg-[#0b1017]/85 px-4 backdrop-blur-md">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-bold tracking-[0.3em] text-slate-50">HYPERSKY</span>
        <span className="hidden text-[10px] uppercase tracking-widest text-slate-500 sm:inline">
          Live traffic console
        </span>
      </div>
      <div className="flex items-center gap-5">
        <Stat label="Tracked" value={stats.tracked.toLocaleString("en-US")} />
        <Stat label="In view" value={stats.inView.toLocaleString("en-US")} className="hidden sm:flex" />
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${feed.status === "live" ? "animate-pulse" : ""}`} />
          <span className={`font-mono text-xs ${meta.text}`}>
            {meta.label}
            {feed.status === "live" && ageS !== null && ` · ${Math.round(ageS)}s`}
            {feed.status !== "live" && feed.retryInSeconds !== null && ` · retry ${feed.retryInSeconds}s`}
          </span>
        </div>
      </div>
    </header>
  );
}
