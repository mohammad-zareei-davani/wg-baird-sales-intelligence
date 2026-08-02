import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PrintAllPages } from "../components/PrintAllPages";
import { ReportLibrary } from "../components/ReportLibrary";
import { EmptyLibrary, FailedReport, GeneratingReport } from "../components/ReportStates";
import { UploadControl } from "../components/UploadControl";
import { useDashboard } from "../data/DashboardDataContext";

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
    items: [{ to: "/quote-guard", label: "Quote Intelligence" }],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.heading })),
);

export function AppLayout() {
  const { reports, selected, payload, loadingLibrary, error } = useDashboard();
  const { pathname } = useLocation();
  const current = ALL_ITEMS.find((i) => i.to === pathname);
  const [printing, setPrinting] = useState(false);
  const printCleanupRef = useRef<(() => void) | null>(null);

  // Arriving on a new page should start at the top of it.
  useEffect(() => {
    if (!printing) window.scrollTo(0, 0);
  }, [pathname, printing]);

  const finishPrint = useCallback(() => {
    printCleanupRef.current?.();
    printCleanupRef.current = null;
    setPrinting(false);
    document.body.classList.remove("is-printing");
  }, []);

  // Mount all pages, wait for charts to lay out, then open the system print dialog.
  useEffect(() => {
    if (!printing) return;

    document.body.classList.add("is-printing");
    let cancelled = false;
    let settleTimer = 0;
    const fallbackTimer = window.setTimeout(finishPrint, 60_000);

    const startPrint = () => {
      if (cancelled) return;
      const onAfterPrint = () => finishPrint();
      window.addEventListener("afterprint", onAfterPrint);
      printCleanupRef.current = () => {
        window.removeEventListener("afterprint", onAfterPrint);
        window.clearTimeout(fallbackTimer);
      };
      window.print();
    };

    // Two frames + a short settle so Recharts ResponsiveContainers get real widths.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        settleTimer = window.setTimeout(startPrint, 450);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallbackTimer);
      if (printing) document.body.classList.remove("is-printing");
    };
  }, [printing, finishPrint]);

  const hasReport = Boolean(payload);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="no-print flex w-full flex-shrink-0 flex-col bg-rail lg:sticky lg:top-0 lg:h-screen lg:w-[248px]">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-[11px] font-bold tracking-wide text-white">
            WGB
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white">W&amp;G Baird</div>
            <div className="text-[11px] text-rail-muted">Sales Intelligence</div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
          {/* Insight navigation only makes sense once a report is open. */}
          {hasReport &&
            NAV_GROUPS.map((group, gi) => (
              <div key={group.heading ?? `g${gi}`} className="flex flex-col gap-px">
                {group.heading && (
                  <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-label text-rail-muted">
                    {group.heading}
                  </div>
                )}
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `rounded-md px-2.5 py-[7px] text-[13px] transition-colors ${
                        isActive
                          ? "bg-rail-soft font-semibold text-white"
                          : "text-rail-text hover:bg-rail-soft/60 hover:text-white"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}

          <div className={hasReport ? "border-t border-rail-edge pt-5" : undefined}>
            <ReportLibrary />
          </div>
        </div>

        <div className="border-t border-rail-edge px-4 py-3.5">
          <UploadControl />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge bg-surface/90 px-6 py-2.5 backdrop-blur lg:px-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px]">
            {hasReport && current?.group && (
              <>
                <span className="text-ink-muted">{current.group}</span>
                <span className="text-ink-muted/60">/</span>
              </>
            )}
            <span className="font-medium text-ink-secondary">
              {hasReport ? current?.label ?? "Dashboard" : "Reports"}
            </span>
          </nav>
          {selected && payload && (
            <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[11.5px] text-ink-muted">
                {selected.name} · {payload.summary.row_count.toLocaleString("en-GB")} jobs ·{" "}
                {payload.summary.date_range.from} to {payload.summary.date_range.to} · figures in{" "}
                {payload.summary.base_currency}
              </span>
              <button
                type="button"
                onClick={() => setPrinting(true)}
                disabled={printing}
                className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-raised px-2.5 py-1.5 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-accent/40 hover:text-accentStrong disabled:cursor-wait disabled:opacity-60"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9V3h12v6" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <path d="M6 14h12v7H6z" />
                </svg>
                {printing ? "Preparing PDF…" : "Print PDF"}
              </button>
            </div>
          )}
        </div>

        <main className="flex-1 px-6 py-7 lg:px-9 lg:py-9">
          {error && (
            <div className="no-print mx-auto mb-5 max-w-[1080px] rounded-md border border-status-critical/25 bg-status-criticalBg px-4 py-3 text-[13px] text-status-criticalText">
              {error}
            </div>
          )}

          {printing && payload ? (
            <PrintAllPages />
          ) : loadingLibrary ? (
            <div className="text-[13px] text-ink-muted">Loading…</div>
          ) : reports.length === 0 ? (
            <EmptyLibrary />
          ) : selected?.status === "generating" ? (
            <GeneratingReport report={selected} />
          ) : selected?.status === "failed" ? (
            <FailedReport report={selected} />
          ) : payload ? (
            <Outlet />
          ) : (
            <div className="mx-auto max-w-[560px] py-24 text-center text-[13px] text-ink-muted">
              Select a report from the sidebar, or upload a new dataset.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
