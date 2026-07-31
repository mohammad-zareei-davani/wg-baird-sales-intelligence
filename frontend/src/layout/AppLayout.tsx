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
      <aside className="flex w-full flex-shrink-0 flex-col bg-rail text-rail-text lg:sticky lg:top-0 lg:h-screen lg:w-[248px]">
        <div className="flex items-start gap-3 border-b border-rail-edge px-5 py-5">
          <div
            className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center bg-accent text-[10px] font-bold tracking-[0.12em] text-white"
            aria-hidden="true"
          >
            WGB
          </div>
          <div className="min-w-0 leading-tight">
            <div className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">
              W&amp;G Baird
            </div>
            <div className="mt-0.5 text-[11px] font-medium tracking-wide text-rail-muted">
              Sales Intelligence
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.heading ?? `g${gi}`} className="flex flex-col gap-0.5">
              {group.heading && (
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-label text-rail-muted">
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative px-3 py-2 text-[13px] transition-colors duration-150 ${
                      isActive
                        ? "bg-rail-soft font-semibold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:bg-accent"
                        : "text-rail-text hover:bg-rail-soft/60 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-rail-edge px-4 py-4">
          <UploadControl onUploaded={reload} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Keeps the dataset the figures came from visible on every page,
            without it, a screenshot of any single page is unattributable. */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge bg-surface/85 px-6 py-2.5 backdrop-blur-md lg:px-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px]">
            {current?.group && (
              <>
                <span className="text-ink-muted">{current.group}</span>
                <span className="text-ink-muted/50">/</span>
              </>
            )}
            <span className="font-medium text-ink-primary">{current?.label ?? "Dashboard"}</span>
          </nav>
          {data && (
            <span className="ml-auto text-[11px] tracking-wide text-ink-muted">
              {data.summary.source} · {data.summary.row_count.toLocaleString("en-GB")} jobs ·{" "}
              {data.summary.date_range.from} to {data.summary.date_range.to} · figures in{" "}
              {data.summary.base_currency}
            </span>
          )}
        </div>

        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">
          {error && (
            <div className="mx-auto mb-6 max-w-[1080px] border border-status-critical/20 bg-status-criticalBg px-4 py-3 text-[13px] text-status-criticalText">
              {error}
            </div>
          )}
          {loading && !data && (
            <div className="text-[13px] text-ink-muted">
              Loading dashboard. Training models on first load…
            </div>
          )}
          {data && (
            <div key={pathname} className="page-enter">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
