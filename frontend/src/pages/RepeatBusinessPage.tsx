import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StoryPanel } from "../components/StoryPanel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPct } from "../format";

const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-2.5 py-2 text-ink-primary";

export function RepeatBusinessPage() {
  const { repeatBusiness } = useLoadedDashboardData();
  const s = repeatBusiness.summary;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Repeat & reprint work"
        description="The same title reappearing for the same customer is a reprint: origination already done, specification proven, setup risk low. It is the most profitable revenue in a print business and the most predictable, because titles reprint on a cycle."
      />

      <StoryPanel story={repeatBusiness.story} />

      <StatCalloutRow>
        <StatCallout value={formatPct(s.repeat_revenue_pct)} label="Of revenue is reprint work" accent="good" />
        <StatCallout value={formatNumber(s.repeat_titles)} label="Titles printed more than once" />
        <StatCallout value={formatNumber(s.titles_due_reprint)} label="Titles overdue their reprint cycle" accent="warning" />
        <StatCallout value={formatCurrencyCompact(s.reprint_pipeline_value)} label="Value of that overdue pipeline" />
      </StatCalloutRow>

      <Panel
        title="Titles due a reprint"
        subtitle="Past their own average reprint cycle, ranked by what a typical run of that title is worth. A title past its cycle is either about to be ordered, about to be ordered elsewhere, or discontinued — all three are worth knowing early."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>Title</th>
                <th className={th}>Customer</th>
                <th className={th}>Product</th>
                <th className={th}>Runs to date</th>
                <th className={th}>Usual cycle</th>
                <th className={th}>Silent for</th>
                <th className={th}>Typical run value</th>
              </tr>
            </thead>
            <tbody>
              {repeatBusiness.due_for_reprint.map((t) => (
                <tr key={`${t.customer_id}-${t.job_id}`}>
                  <td className={td}>{t.job_id}</td>
                  <td className={td}>{t.customer_name}</td>
                  <td className={td}>{t.product_type}</td>
                  <td className={td}>{t.print_runs}</td>
                  <td className={td}>{formatNumber(Math.round(t.avg_cycle_days))} days</td>
                  <td className={`${td} font-semibold text-status-critical`}>
                    {formatNumber(t.days_since_last_run)} days
                  </td>
                  <td className={td}>{formatCurrency(t.avg_value_per_run)}</td>
                </tr>
              ))}
              {repeatBusiness.due_for_reprint.length === 0 && (
                <tr>
                  <td colSpan={7} className="border-t border-line-grid px-2.5 py-5 text-center text-ink-muted">
                    No titles are currently overdue their reprint cycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Where reprint work sits" subtitle="Repeat revenue by product category">
          <HorizontalBarChart
            data={repeatBusiness.by_product.map((p) => ({ name: p.product_type, value: p.total_sell }))}
            colorIndex={2}
            valueFormatter={formatCurrencyCompact}
            valueLabel="Repeat revenue"
          />
        </Panel>

        <Panel
          title="Most valuable recurring titles"
          subtitle={`Cumulative value across all runs. The most reprinted title has run ${s.max_runs} times.`}
        >
          <HorizontalBarChart
            data={repeatBusiness.top_repeat_titles.slice(0, 10).map((t) => ({
              name: `${t.job_id} · ${t.customer_name}`,
              value: t.total_sell,
            }))}
            colorIndex={0}
            valueFormatter={formatCurrencyCompact}
            valueLabel="Total across all runs"
          />
        </Panel>
      </div>
    </div>
  );
}
