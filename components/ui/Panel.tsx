import type { ReactNode } from "react";

/** Frosted dark surface all floating chrome sits on. */
export default function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-white/10 bg-[#0b1017]/85 shadow-lg shadow-black/40 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}
