import type { ButtonHTMLAttributes } from "react";

export default function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${className}`}
      {...props}
    />
  );
}
