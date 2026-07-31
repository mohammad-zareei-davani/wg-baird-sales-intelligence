import { Link } from "react-router-dom";
import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { BreakdownTable, MetricRow, PageTitle } from "../components/brief/Brief";
import { formatCurrencyCompact, formatNumber, formatPct } from "../format";

const AREA_META: Record<string, { label: string; to: string }> = {
  pricing: { label: "Pricing Integrity", to: "/pricing" },
  customer_value: { label: "Customer Value", to: "/customer-value" },
  repeat_business: { label: "Recurring Revenue", to: "/repeat-business" },
  churn: { label: "Account Retention", to: "/churn" },
  reorder: { label: "Reorder Forecasting", to: "/reorder" },
  seasonality: { label: "Demand & Capacity", to: "/seasonality" },
  delivery: { label: "Production Turnaround", to: "/delivery" },
  quote_guard: { label: "Quote Intelligence", to: "/quote-guard" },
};

export function OverviewPage() {
  const { summary, executive } = useLoadedDashboardData();

  const metrics = [
    {
      label: "Total sales",
      value: formatCurrencyCompact(summary.total_sell_price),
      sublabel: `${summary.base_currency} equivalent across ${formatNumber(summary.row_count)} jobs`,
    },
    {
      label: "Value added",
      value: formatCurrencyCompact(summary.total_va_amount),
      sublabel: `${formatPct(summary.avg_va_pct)} average across all work`,
    },
    {
      label: "Customers",
      value: formatNumber(summary.customer_count),
      sublabel: `Trading between ${summary.date_range.from.slice(0, 7)} and ${summary.date_range.to.slice(0, 7)}`,
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-8">
      <PageTitle eyebrow="Executive Briefing" title="What the Data Is Telling You" />

      <MetricRow metrics={metrics} />

      <section className="flex flex-col gap-0">
        <div className="mb-5">
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-ink-primary">
            What most warrants attention
          </h2>
          <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-secondary">
            All {executive.considered} insights are scored on what each has at stake per year, and
            the largest are shown here. Nothing is fixed in place: the order changes with the data,
            and an insight with nothing behind it drops out.
          </p>
        </div>

        {executive.findings.map((f, i) => {
          const meta = AREA_META[f.area];
          return (
            <article
              key={f.area}
              className="border-t border-edge py-5 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tnum text-[12px] font-semibold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[15px] font-semibold text-ink-primary">{f.title}</h3>
                {meta && (
                  <Link
                    className="ml-auto whitespace-nowrap text-[12px] font-semibold text-accentStrong transition-colors hover:text-accent"
                    to={meta.to}
                  >
                    {meta.label} →
                  </Link>
                )}
              </div>

              {/* Why this finding sits where it does in the list. */}
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[12px]">
                <span className="tnum font-semibold text-ink-primary">{f.at_stake_label}</span>
                <span className="text-ink-muted">{f.basis.toLowerCase()}</span>
              </div>

              <div className="mt-4 grid gap-5 md:grid-cols-[180px_1fr] md:gap-8">
                <div>
                  <div className="tnum text-[30px] font-semibold leading-none tracking-[-0.03em] text-accentStrong">
                    {f.value}
                  </div>
                  <div className="mt-2 text-[12px] leading-snug text-ink-secondary">
                    {f.caption}
                  </div>
                </div>
                <p className="max-w-[74ch] text-[14px] leading-[1.7] text-ink-secondary">
                  {f.body}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <div className="border-t border-edge pt-8">
        <BreakdownTable breakdown={summary.brief.breakdown} />
        <p className="mt-4 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
          {summary.brief.hero.body}
        </p>
      </div>
    </div>
  );
}
