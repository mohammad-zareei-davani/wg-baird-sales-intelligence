import { Link } from "react-router-dom";
import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { KpiStrip } from "../components/KpiStrip";
import type { Kpi } from "../components/KpiStrip";
import { Panel } from "../components/Panel";
import { CustomerValueChart } from "../components/charts/CustomerValueChart";
import { ChurnStatusChart } from "../components/charts/ChurnStatusChart";
import { formatCurrencyCompact, formatNumber, formatPct } from "../format";

export function OverviewPage() {
  const { summary, customerValue, reorder, churn } = useLoadedDashboardData();

  const kpis: Kpi[] = [
    { label: "Total sell price", value: formatCurrencyCompact(summary.total_sell_price) },
    {
      label: "Total value added",
      value: formatCurrencyCompact(summary.total_va_amount),
      hint: `${formatPct(summary.avg_va_pct)} avg VA%`,
    },
    { label: "Active customers", value: formatNumber(summary.customer_count) },
    { label: "Jobs analysed", value: formatNumber(summary.row_count) },
    { label: "Data window", value: `${summary.date_range.from} → ${summary.date_range.to}` },
  ];

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div>
        <h1 className="mb-1.5 text-2xl font-bold">Overview</h1>
        <p className="max-w-[720px] text-sm leading-relaxed text-ink-secondary">
          Headline numbers across the three commercial insights below.
        </p>
      </div>

      <KpiStrip items={kpis} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <Panel
          title="Most valuable customers"
          subtitle={`Top accounts by Value Added — ${customerValue.concentration.pct_of_customers_for_80pct_value}% of customers drive 80% of VA`}
        >
          <CustomerValueChart data={customerValue.top_customers.slice(0, 8)} />
          <Link className="mt-3.5 inline-block text-[13px] font-semibold text-series-1 hover:underline" to="/customer-value">
            View full customer & work-type breakdown →
          </Link>
        </Panel>

        <Panel title="Reorder outlook" subtitle="Forecast status across all customers with enough order history">
          <ul className="mb-2 flex flex-col gap-2.5">
            <li className="flex items-baseline justify-between border-b border-line-grid py-2 text-[13px]">
              <span className="text-ink-secondary">Overdue</span>
              <span className="font-bold tabular-nums">{reorder.summary.overdue_count}</span>
            </li>
            <li className="flex items-baseline justify-between border-b border-line-grid py-2 text-[13px]">
              <span className="text-ink-secondary">Due within 14 days</span>
              <span className="font-bold tabular-nums">{reorder.summary.due_soon_count}</span>
            </li>
            <li className="flex items-baseline justify-between border-b border-line-grid py-2 text-[13px]">
              <span className="text-ink-secondary">Expected value, next 30 days</span>
              <span className="font-bold tabular-nums">{formatCurrencyCompact(reorder.summary.expected_value_next_30_days)}</span>
            </li>
          </ul>
          <Link className="mt-3.5 inline-block text-[13px] font-semibold text-series-1 hover:underline" to="/reorder">
            View full reorder forecast →
          </Link>
        </Panel>

        <Panel title="Churn status" subtitle={`${formatCurrencyCompact(churn.dormant_lifetime_value_at_stake)} of lifetime value sits with dormant accounts`}>
          <ChurnStatusChart counts={churn.status_counts} />
          <Link className="mt-3.5 inline-block text-[13px] font-semibold text-series-1 hover:underline" to="/churn">
            View follow-up opportunities →
          </Link>
        </Panel>
      </div>
    </div>
  );
}
