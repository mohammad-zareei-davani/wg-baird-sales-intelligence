const STATUS_STYLE: Record<string, string> = {
  Overdue: "bg-status-criticalBg text-status-criticalText",
  Dormant: "bg-status-criticalBg text-status-criticalText",
  "Due soon": "bg-status-warningBg text-status-warningText",
  "At Risk": "bg-status-warningBg text-status-warningText",
  "On track": "bg-status-goodBg text-status-goodText",
  Active: "bg-status-goodBg text-status-goodText",
  "Insufficient history": "bg-surface text-ink-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_STYLE[status] ?? "bg-surface text-ink-muted";
  return (
    <span
      className={`inline-block whitespace-nowrap px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${classes}`}
    >
      {status}
    </span>
  );
}
