import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../format";

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-3 py-2 text-ink-primary";

export function RepeatBusinessPage() {
  const { repeatBusiness } = useLoadedDashboardData();
  const s = repeatBusiness.summary;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageTitle eyebrow="Recurring Revenue" title={repeatBusiness.brief.title} />
      <Brief brief={repeatBusiness.brief} />

      <SupportingCharts>
        <Panel
          title="Titles due a reprint"
          subtitle="Past their own average reprint cycle, ranked by what a typical run is worth"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Product</th>
                  <th className={th}>Runs</th>
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
                    <td className={`${td} font-semibold text-status-criticalText`}>
                      {formatNumber(t.days_since_last_run)} days
                    </td>
                    <td className={td}>{formatCurrency(t.avg_value_per_run)}</td>
                  </tr>
                ))}
                {repeatBusiness.due_for_reprint.length === 0 && (
                  <tr>
                    <td colSpan={7} className="border-t border-line-grid px-3 py-5 text-center text-ink-muted">
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
      </SupportingCharts>
    </div>
  );
}
