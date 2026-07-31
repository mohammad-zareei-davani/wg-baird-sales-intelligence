export interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-[10px] border border-black/10 bg-raised px-4 py-3.5">
          <div className="mb-1.5 text-xs text-ink-muted">{item.label}</div>
          <div className="text-xl font-bold tabular-nums">{item.value}</div>
          {item.hint && <div className="mt-1 text-xs text-ink-secondary">{item.hint}</div>}
        </div>
      ))}
    </div>
  );
}
