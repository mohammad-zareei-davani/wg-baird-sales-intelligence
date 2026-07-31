import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { formatCurrency, formatNumber, formatPct } from "../format";

const th = "whitespace-nowrap border-b border-edge px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-label text-ink-muted";
const td = "whitespace-nowrap border-t border-edge px-4 py-2.5 text-ink-primary";

const BAND_STYLE: Record<string, string> = {
  High: "bg-status-criticalBg text-status-criticalText",
  Medium: "bg-status-warningBg text-status-warningText",
  Low: "bg-status-goodBg text-status-goodText",
};

export function ChurnRiskPage() {
  const { churnRisk } = useLoadedDashboardData();
  const m = churnRisk.metrics;

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <PageTitle eyebrow="Predictive Retention Risk" title={churnRisk.brief.title} />
      <Brief brief={churnRisk.brief} />

      {churnRisk.available && m && (
        <SupportingCharts>
          <Panel
            title="What the model looks at, and how far to trust it"
            subtitle={`Trained on data up to ${m.train_period_end} and tested only on later months, which is the honest version of the question the business actually has.`}
          >
            <div className="flex flex-wrap gap-1.5">
              {(churnRisk.features_used ?? []).map((f) => (
                <span key={f} className="rounded-md border border-edge bg-page px-2.5 py-1 text-[11px] text-ink-secondary">
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
              With only {m.customers} customers the model works from limited evidence and should
              rank the call list rather than settle any single account.{" "}
              {formatPct(m.base_rate * 100, 0)} of customer-months are followed by an order, so raw
              accuracy flatters any model here, so the score against the naive benchmark is the number
              that matters.
            </p>
          </Panel>

          <Panel
            title="Accounts ranked by risk"
            subtitle="Scored as at the most recent date in the data. These are genuine forward predictions, with the outcome not yet known"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={th}>Customer</th>
                    <th className={th}>Risk</th>
                    <th className={th}>Chance of ordering</th>
                    <th className={th}>Days since last order</th>
                    <th className={th}>Usual gap</th>
                    <th className={th}>Orders last 12m</th>
                    <th className={th}>Value added, last 90d</th>
                  </tr>
                </thead>
                <tbody>
                  {(churnRisk.current_risk ?? []).map((c) => (
                    <tr key={c.customer_id}>
                      <td className={td}>{c.customer_name}</td>
                      <td className={td}>
                        <span
                          className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold ${
                            BAND_STYLE[c.risk_band] ?? "bg-page text-ink-muted"
                          }`}
                        >
                          {c.risk_band}
                        </span>
                      </td>
                      <td className={td}>{formatPct(c.order_probability * 100, 0)}</td>
                      <td className={td}>{formatNumber(c.days_since_last_order)}</td>
                      <td className={td}>{formatNumber(Math.round(c.avg_interval_days))} days</td>
                      <td className={td}>{formatNumber(c.orders_last_365d)}</td>
                      <td className={td}>{formatCurrency(c.va_last_90d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </SupportingCharts>
      )}
    </div>
  );
}
