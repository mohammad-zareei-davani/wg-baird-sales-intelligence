import { useMemo, useState } from "react";
import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { ReorderTable } from "../components/ReorderTable";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { formatCurrencyCompact, formatNumber } from "../format";
import type { ReorderStatus } from "../api/types";

const FILTERS: Array<{ key: ReorderStatus | "All"; label: string }> = [
  { key: "All", label: "All" },
  { key: "Overdue", label: "Overdue" },
  { key: "Due soon", label: "Due soon" },
  { key: "On track", label: "On track" },
  { key: "Insufficient history", label: "Insufficient history" },
];

export function ReorderPage() {
  const { reorder } = useLoadedDashboardData();
  const [filter, setFilter] = useState<ReorderStatus | "All">("All");

  const rows = useMemo(
    () => (filter === "All" ? reorder.customers : reorder.customers.filter((r) => r.status === filter)),
    [reorder.customers, filter],
  );

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div>
        <h1 className="mb-1.5 text-2xl font-bold">Reorder values &amp; predicted timelines</h1>
        <p className="max-w-[720px] text-sm leading-relaxed text-ink-secondary">
          Every distinct booking date is treated as one order event. From each customer's sequence of
          order events we derive their average reorder cadence and forecast the next order date and
          value with a moving average — a transparent baseline, easy to swap for a trained model later.
        </p>
      </div>

      <StatCalloutRow>
        <StatCallout value={formatNumber(reorder.summary.predictable_customers)} label="Customers with a forecast" />
        <StatCallout value={formatNumber(reorder.summary.overdue_count)} label="Overdue" accent="critical" />
        <StatCallout value={formatNumber(reorder.summary.due_soon_count)} label="Due within 14 days" accent="warning" />
        <StatCallout value={formatCurrencyCompact(reorder.summary.expected_value_next_30_days)} label="Expected value, next 30 days" />
      </StatCalloutRow>

      <Panel title="Forecast by customer">
        <div className="mb-3.5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                filter === f.key
                  ? "border-series-1 bg-series-1 text-white"
                  : "border-black/10 bg-raised text-ink-secondary hover:border-series-1 hover:text-series-1"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <ReorderTable rows={rows} />
      </Panel>
    </div>
  );
}
