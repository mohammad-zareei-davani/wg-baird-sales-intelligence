import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StoryPanel } from "../components/StoryPanel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPct } from "../format";

const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-2.5 py-2 text-ink-primary";

export function QuoteGuardPage() {
  const { quoteGuard } = useLoadedDashboardData();

  if (!quoteGuard.available || !quoteGuard.metrics) {
    return (
      <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
        <PageHeader title="Quote Guard" description="A learned benchmark for what a job should sell for." />
        <Panel title="Not available">
          <p className="text-sm text-ink-secondary">{quoteGuard.reason ?? "Model unavailable."}</p>
        </Panel>
      </div>
    );
  }

  const m = quoteGuard.metrics;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Quote Guard — what should this job sell for?"
        description="A model trained on completed jobs learns the relationship between a job's specification, its input costs and the price it achieved. Given a new enquiry it says what comparable work has historically commanded, giving the estimator a reference point at the moment of quoting."
      />

      <StoryPanel story={quoteGuard.story} />

      <StatCalloutRow>
        <StatCallout value={formatPct(m.median_abs_pct_error)} label="Typical error on unseen jobs" accent="good" />
        <StatCallout value={formatPct(m.within_25pct)} label="Of jobs predicted within 25%" />
        <StatCallout value={formatNumber(quoteGuard.flagged_count ?? 0)} label={`Jobs sold >${quoteGuard.threshold_pct}% below the going rate`} accent="warning" />
        <StatCallout value={formatCurrencyCompact(Math.abs(quoteGuard.value_gap ?? 0))} label="Value gap on those jobs" accent="critical" />
      </StatCalloutRow>

      <Panel
        title="How the model was tested"
        subtitle="Held-out jobs the model never saw during training. Reporting performance on jobs it had already learned would flatter it."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Jobs trained on", value: formatNumber(m.train_rows) },
            { label: "Jobs tested on", value: formatNumber(m.test_rows) },
            { label: "Typical error", value: formatPct(m.median_abs_pct_error) },
            { label: "Within 10%", value: formatPct(m.within_10pct) },
            { label: "Within 25%", value: formatPct(m.within_25pct) },
            { label: "Variance explained", value: m.r2_log.toFixed(3) },
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
            {(quoteGuard.features_used ?? []).map((f) => (
              <span key={f} className="rounded-full bg-page px-2.5 py-1 text-[11px] text-ink-secondary">
                {f}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            Value added, markup and the manual price adjustment are deliberately excluded. Those are
            consequences of the pricing decision rather than inputs to it — including them would let
            the model reconstruct the answer and report an accuracy it has not earned.
          </p>
        </div>
      </Panel>

      <Panel
        title="Jobs sold well below the going rate"
        subtitle="Held-out jobs where the achieved price fell furthest short of what comparable work commanded. Worth reviewing to understand whether these were deliberate commercial decisions or drift."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>Job</th>
                <th className={th}>Customer</th>
                <th className={th}>Product</th>
                <th className={th}>Quantity</th>
                <th className={th}>Sold for</th>
                <th className={th}>Comparable work</th>
                <th className={th}>Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {(quoteGuard.flagged_jobs ?? []).map((j, i) => (
                <tr key={`${j.job_id}-${i}`}>
                  <td className={td}>{j.job_id}</td>
                  <td className={td}>{j.customer_name}</td>
                  <td className={td}>{j.product_type}</td>
                  <td className={td}>{formatNumber(j.quantity)}</td>
                  <td className={td}>{formatCurrency(j.actual_price)}</td>
                  <td className={td}>{formatCurrency(j.expected_price)}</td>
                  <td className={`${td} font-semibold text-status-critical`}>
                    {formatCurrency(j.gap)} ({j.gap_pct.toFixed(0)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
