const STATUS_STYLE: Record<string, string> = {
  Overdue: "bg-status-criticalBg text-status-criticalText",
  Dormant: "bg-status-criticalBg text-status-criticalText",
  "Due soon": "bg-status-warningBg text-status-warningText",
  "At Risk": "bg-status-warningBg text-status-warningText",
  "On track": "bg-status-goodBg text-status-goodText",
  Active: "bg-status-goodBg text-status-goodText",
  "Insufficient history": "bg-page text-ink-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_STYLE[status] ?? "bg-page text-ink-muted";
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      {status}
    </span>
  );
}
