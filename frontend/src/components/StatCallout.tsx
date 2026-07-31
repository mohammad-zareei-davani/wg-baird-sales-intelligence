import type { ReactNode } from "react";

const ACCENT: Record<string, string> = {
  default: "border-l-series-1",
  good: "border-l-status-good",
  warning: "border-l-status-warning",
  critical: "border-l-status-critical",
};

export function StatCalloutRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

export function StatCallout({
  value,
  label,
  accent = "default",
}: {
  value: string;
  label: string;
  accent?: "default" | "good" | "warning" | "critical";
}) {
  return (
    <div className={`rounded-[10px] border border-black/10 border-l-[3px] bg-raised p-4 ${ACCENT[accent]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
    </div>
  );
}
