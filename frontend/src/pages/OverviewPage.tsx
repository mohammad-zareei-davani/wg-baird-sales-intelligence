import { Link } from "react-router-dom";
import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { BreakdownTable, MetricRow, PageTitle } from "../components/brief/Brief";
import { formatCurrencyCompact, formatNumber, formatPct } from "../format";

const AREA_META: Record<string, { label: string; to: string }> = {
  pricing: { label: "Pricing Integrity", to: "/pricing" },
  customer_value: { label: "Customer Value", to: "/customer-value" },
  repeat_business: { label: "Recurring Revenue", to: "/repeat-business" },
  churn: { label: "Account Retention", to: "/churn" },
  seasonality: { label: "Demand & Capacity", to: "/seasonality" },
};

export function OverviewPage() {
  const { summary, executive } = useLoadedDashboardData();

  const metrics = [
    { label: "Total sales", value: formatCurrencyCompact(summary.total_sell_price), sublabel: `${summary.base_currency} equivalent, ${formatNumber(summary.row_count)} jobs` },
    { label: "Value added", value: formatCurrencyCompact(summary.total_va_amount), sublabel: `${formatPct(summary.avg_va_pct)} average across all work` },
    { label: "Period covered", value: `${summary.date_range.from.slice(0, 7)} → ${summary.date_range.to.slice(0, 7)}`, sublabel: `${summary.customer_count} customers` },
  ];

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageTitle eyebrow="Executive Briefing" title="What the Data Is Telling You" />

      <MetricRow metrics={metrics} />

      <section className="flex flex-col gap-4">
        {executive.findings.map((f, i) => {
          const meta = AREA_META[f.area];
          return (
            <article key={f.area} className="rounded-xl border border-edge/10 bg-raised p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-series-1 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <h2 className="text-[15px] font-semibold text-ink-primary">{f.title}</h2>
                {meta && (
                  <Link
                    className="ml-auto text-[12px] font-semibold text-series-1 hover:underline"
                    to={meta.to}
                  >
                    {meta.label} →
                  </Link>
                )}
              </div>

              <div className="mt-3 grid gap-4 md:grid-cols-[minmax(150px,190px)_1fr] md:items-center">
                <div className="border-l-4 border-l-series-1 pl-4">
                  <div className="text-[30px] font-bold leading-none tabular-nums text-ink-primary">
                    {f.value}
                  </div>
                  <div className="mt-1.5 text-[12px] leading-snug text-ink-secondary">{f.caption}</div>
                </div>
                <p className="text-[13px] leading-relaxed text-ink-secondary">{f.body}</p>
              </div>
            </article>
          );
        })}
      </section>

      <BreakdownTable breakdown={summary.brief.breakdown} />

      <p className="text-[12px] leading-relaxed text-ink-muted">
        {summary.brief.hero.body}
      </p>
    </div>
  );
}
