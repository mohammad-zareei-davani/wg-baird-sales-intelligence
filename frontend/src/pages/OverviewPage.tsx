import { Link } from "react-router-dom";
import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { KpiStrip } from "../components/KpiStrip";
import type { Kpi } from "../components/KpiStrip";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPct } from "../format";

const AREA_META: Record<string, { title: string; to: string }> = {
  pricing: { title: "Pricing discipline", to: "/pricing" },
  customer_value: { title: "Customer value", to: "/customer-value" },
  repeat_business: { title: "Repeat & reprint work", to: "/repeat-business" },
  churn: { title: "Customer churn", to: "/churn" },
  seasonality: { title: "Seasonality & capacity", to: "/seasonality" },
};

export function OverviewPage() {
  const { summary, executive } = useLoadedDashboardData();

  const kpis: Kpi[] = [
    { label: "Total sales", value: formatCurrencyCompact(summary.total_sell_price), hint: `${summary.base_currency} equivalent` },
    {
      label: "Total value added",
      value: formatCurrencyCompact(summary.total_va_amount),
      hint: `${formatPct(summary.avg_va_pct)} avg VA%`,
    },
    { label: "Customers", value: formatNumber(summary.customer_count) },
    { label: "Jobs analysed", value: formatNumber(summary.row_count) },
    { label: "Data window", value: `${summary.date_range.from} → ${summary.date_range.to}` },
  ];

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Executive summary"
        description="The findings from this dataset that most warrant senior attention, each linking through to the detail behind it."
      />

      <KpiStrip items={kpis} />

      <section className="rounded-xl border border-black/10 bg-raised p-5">
        <h2 className="mb-4 text-base font-semibold">What the data is telling us</h2>
        <ol className="flex flex-col gap-4">
          {executive.findings.map((f, i) => {
            const meta = AREA_META[f.area];
            return (
              <li key={f.area} className="flex gap-3.5">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-series-1 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm leading-relaxed text-ink-primary">{f.headline}</p>
                  {meta && (
                    <Link className="mt-1 inline-block text-[12px] font-semibold text-series-1 hover:underline" to={meta.to}>
                      {meta.title} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <Panel
        title="A note on the figures"
        subtitle="Worth stating up front, because it changes the headline numbers"
      >
        <p className="text-[13px] leading-relaxed text-ink-secondary">{summary.story.what_it_means}</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Billed in</th>
                <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Jobs</th>
                <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Native value</th>
                <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Converted ({summary.base_currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.currency_split.map((c) => (
                <tr key={c.currency}>
                  <td className="whitespace-nowrap border-t border-line-grid px-2.5 py-2">{c.currency}</td>
                  <td className="whitespace-nowrap border-t border-line-grid px-2.5 py-2">{formatNumber(c.job_count)}</td>
                  <td className="whitespace-nowrap border-t border-line-grid px-2.5 py-2 tabular-nums">
                    {formatNumber(Math.round(c.sell_price_native))}
                  </td>
                  <td className="whitespace-nowrap border-t border-line-grid px-2.5 py-2 tabular-nums">
                    {formatCurrency(c.sell_price_base)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[12px] text-ink-muted">
          Converted at €1 = {summary.base_currency_symbol}
          {summary.eur_to_gbp} — a stated planning rate, not a live feed. Adding the two columns
          untouched would report {formatCurrency(summary.naive_mixed_total)}, overstating the book by{" "}
          {formatCurrency(summary.naive_mixed_total - summary.total_sell_price)}.
        </p>
      </Panel>
    </div>
  );
}
