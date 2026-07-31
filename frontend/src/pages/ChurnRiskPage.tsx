import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StoryPanel } from "../components/StoryPanel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { formatCurrency, formatNumber, formatPct } from "../format";

const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-2.5 py-2 text-ink-primary";

const BAND_STYLE: Record<string, string> = {
  High: "bg-status-criticalBg text-status-critical",
  Medium: "bg-status-warningBg text-amber-800",
  Low: "bg-status-goodBg text-status-good",
};

export function ChurnRiskPage() {
  const { churnRisk } = useLoadedDashboardData();

  if (!churnRisk.available || !churnRisk.metrics) {
    return (
      <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
        <PageHeader title="Churn risk" description="Predicted likelihood of a customer ordering again." />
        <Panel title="Not available">
          <p className="text-sm text-ink-secondary">{churnRisk.reason ?? "Model unavailable."}</p>
        </Panel>
      </div>
    );
  }

  const m = churnRisk.metrics;
  const bands = churnRisk.band_counts ?? {};

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Churn risk — who is unlikely to come back?"
        description={`Rather than asking who has gone quiet, this asks the forward question: how likely is each account to place another order within the next ${m.lookahead_days} days? The score weighs several signals at once — how overdue they are against their own habit, whether spend is trending down, and how established the relationship is.`}
      />

      <StoryPanel story={churnRisk.story} />

      <StatCalloutRow>
        <StatCallout value={formatNumber(bands.High ?? 0)} label="High risk" accent="critical" />
        <StatCallout value={formatNumber(bands.Medium ?? 0)} label="Medium risk" accent="warning" />
        <StatCallout value={formatNumber(bands.Low ?? 0)} label="Low risk" accent="good" />
        <StatCallout value={m.auc.toFixed(3)} label={`Model score (benchmark ${m.baseline_auc.toFixed(3)})`} />
      </StatCalloutRow>

      <Panel
        title="How the model was tested — and how far to trust it"
        subtitle="Trained on earlier months and tested only on later ones, which is the honest version of the question the business actually has."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Model score (AUC)", value: m.auc.toFixed(3) },
            { label: "Naive benchmark", value: m.baseline_auc.toFixed(3) },
            { label: "Customers", value: formatNumber(m.customers) },
            { label: "Trained on", value: `${formatNumber(m.train_rows)} obs` },
            { label: "Tested on", value: `${formatNumber(m.test_rows)} obs` },
            { label: "Trained up to", value: m.train_period_end },
          ].map((k) => (
            <div key={k.label}>
              <div className="text-lg font-bold tabular-nums">{k.value}</div>
              <div className="text-[11px] text-ink-muted">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-line-grid pt-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            What the model looks at
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(churnRisk.features_used ?? []).map((f) => (
              <span key={f} className="rounded-full bg-page px-2.5 py-1 text-[11px] text-ink-secondary">
                {f}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            Honest caveats: there are only {m.customers} customers in this dataset, so the model is
            working from limited evidence and should be treated as a way of ranking the call list
            rather than a verdict on any single account. {formatPct(m.base_rate * 100, 0)} of
            customer-months are followed by an order, so raw accuracy flatters any model here — the
            AUC against the naive benchmark is the number that matters.
          </p>
        </div>
      </Panel>

      <Panel
        title="Accounts ranked by risk"
        subtitle="Scored as at the most recent date in the data. These are genuine forward predictions — the outcome is not yet known."
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
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        BAND_STYLE[c.risk_band] ?? "bg-line-grid text-ink-muted"
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
    </div>
  );
}
