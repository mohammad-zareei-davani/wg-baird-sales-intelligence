const STATUS_STYLE: Record<string, string> = {
  Overdue: "bg-status-criticalBg text-status-critical",
  Dormant: "bg-status-criticalBg text-status-critical",
  "Due soon": "bg-status-warningBg text-amber-800",
  "At Risk": "bg-status-warningBg text-amber-800",
  "On track": "bg-status-goodBg text-status-good",
  Active: "bg-status-goodBg text-status-good",
  "Insufficient history": "bg-line-grid text-ink-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_STYLE[status] ?? "bg-line-grid text-ink-muted";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {status}
    </span>
  );
}
