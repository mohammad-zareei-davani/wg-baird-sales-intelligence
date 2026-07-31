import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { UploadControl } from "../components/UploadControl";
import { useDashboardData } from "../data/DashboardDataContext";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_GROUPS: { heading: string | null; items: NavItem[] }[] = [
  { heading: null, items: [{ to: "/", label: "Executive Briefing", end: true }] },
  {
    heading: "Commercial",
    items: [
      { to: "/customer-value", label: "Customer Value" },
      { to: "/repeat-business", label: "Recurring Revenue" },
      { to: "/reorder", label: "Reorder Forecasting" },
      { to: "/churn", label: "Account Retention" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/pricing", label: "Pricing Integrity" },
      { to: "/seasonality", label: "Demand & Capacity" },
      { to: "/delivery", label: "Production Turnaround" },
    ],
  },
  {
    heading: "Predictive",
    items: [
      { to: "/quote-guard", label: "Quote Intelligence" },
      { to: "/churn-risk", label: "Retention Risk" },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.heading })),
);

export function AppLayout() {
  const { data, error, loading, reload } = useDashboardData();
  const { pathname } = useLocation();
  const current = ALL_ITEMS.find((i) => i.to === pathname);

  // Without this, arriving on a new page keeps the previous page's scroll
  // position and drops the reader into the middle of the brief.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex w-full flex-shrink-0 flex-col border-b border-edge bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-[236px] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-[11px] font-bold tracking-wide text-white">
            WGB
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink-primary">W&amp;G Baird</div>
            <div className="text-[11px] text-ink-muted">Sales Intelligence</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.heading ?? `g${gi}`} className="flex flex-col gap-px">
              {group.heading && (
                <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-label text-ink-muted">
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative rounded-md px-2.5 py-[7px] text-[13px] transition-colors ${
                      isActive
                        ? "bg-accentSoft font-semibold text-accentStrong"
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

        <div className="border-t border-edge px-4 py-3.5">
          <UploadControl onUploaded={reload} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Keeps the dataset the figures came from visible on every page,
            without it, a screenshot of any single page is unattributable. */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge bg-surface/90 px-6 py-2.5 backdrop-blur lg:px-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px]">
            {current?.group && (
              <>
                <span className="text-ink-muted">{current.group}</span>
                <span className="text-ink-muted/60">/</span>
              </>
            )}
            <span className="font-medium text-ink-secondary">{current?.label ?? "Dashboard"}</span>
          </nav>
          {data && (
            <span className="ml-auto text-[11.5px] text-ink-muted">
              {data.summary.source} · {data.summary.row_count.toLocaleString("en-GB")} jobs ·{" "}
              {data.summary.date_range.from} to {data.summary.date_range.to} · figures in{" "}
              {data.summary.base_currency}
            </span>
          )}
        </div>

        <main className="flex-1 px-6 py-7 lg:px-9 lg:py-9">
          {error && (
            <div className="mx-auto mb-5 max-w-[1120px] rounded-lg border border-status-critical/25 bg-status-criticalBg px-4 py-3 text-[13px] text-status-criticalText">
              {error}
            </div>
          )}
          {loading && !data && (
            <div className="text-[13px] text-ink-muted">
              Loading dashboard. Training models on first load…
            </div>
          )}
          {data && <Outlet />}
        </main>
      </div>
    </div>
  );
}
