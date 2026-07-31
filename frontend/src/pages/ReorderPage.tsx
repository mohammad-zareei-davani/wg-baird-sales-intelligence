import { useMemo, useState } from "react";
import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { ReorderTable } from "../components/ReorderTable";
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
    <div className="mx-auto flex max-w-[1080px] flex-col gap-8">
      <PageTitle eyebrow="Reorder Forecasting" title={reorder.brief.title} />
      <Brief brief={reorder.brief} />

      <SupportingCharts>
        <Panel title="Forecast by customer" subtitle="Each account's normal rhythm and where they sit against it">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`border px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150 ${
                  filter === f.key
                    ? "border-accent bg-accent text-white"
                    : "border-edge bg-surface text-ink-secondary hover:border-accentStrong hover:text-accentStrong"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ReorderTable rows={rows} />
        </Panel>
      </SupportingCharts>
    </div>
  );
}
