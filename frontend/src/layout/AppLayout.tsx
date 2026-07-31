import { NavLink, Outlet } from "react-router-dom";
import { UploadControl } from "../components/UploadControl";
import { useDashboardData } from "../data/DashboardDataContext";

const NAV_GROUPS: { heading: string | null; items: { to: string; label: string; end?: boolean }[] }[] = [
  { heading: null, items: [{ to: "/", label: "Executive summary", end: true }] },
  {
    heading: "Commercial",
    items: [
      { to: "/customer-value", label: "Customer value" },
      { to: "/repeat-business", label: "Repeat & reprint work" },
      { to: "/reorder", label: "Reorder timelines" },
      { to: "/churn", label: "Churn & follow-up" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/pricing", label: "Pricing & margin" },
      { to: "/seasonality", label: "Seasonality & capacity" },
      { to: "/delivery", label: "Delivery performance" },
    ],
  },
  {
    heading: "Predictive",
    items: [
      { to: "/quote-guard", label: "Quote Guard" },
      { to: "/churn-risk", label: "Churn risk" },
    ],
  },
];

export function AppLayout() {
  const { data, error, loading, reload } = useDashboardData();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full flex-shrink-0 flex-col border-b border-black/10 bg-raised p-4 md:sticky md:top-0 md:h-screen md:w-[248px] md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center gap-2.5 border-b border-line-grid px-2 pb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-series-1 text-xs font-bold tracking-wide text-white">
            WGB
          </div>
          <div>
            <div className="text-sm font-bold">W&amp;G Baird</div>
            <div className="text-xs text-ink-muted">Sales Intelligence</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.heading ?? `group-${gi}`} className="flex flex-col gap-0.5">
              {group.heading && (
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-[13px] ${
                      isActive
                        ? "bg-blue-50 font-semibold text-series-1"
                        : "text-ink-secondary hover:bg-page hover:text-ink-primary"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-2.5 border-t border-line-grid pt-4">
          <UploadControl onUploaded={reload} />
          {data && (
            <div className="text-[11px] leading-relaxed text-ink-muted">
              <div>Source: {data.summary.source}</div>
              <div>
                {data.summary.row_count.toLocaleString("en-GB")} jobs · reported in{" "}
                {data.summary.base_currency}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-8 md:px-10">
        {error && (
          <div className="mb-5 max-w-[1080px] rounded-lg bg-status-criticalBg px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}
        {loading && !data && (
          <div className="text-sm text-ink-muted">Loading dashboard — training models on first load…</div>
        )}
        {data && <Outlet />}
      </main>
    </div>
  );
}
