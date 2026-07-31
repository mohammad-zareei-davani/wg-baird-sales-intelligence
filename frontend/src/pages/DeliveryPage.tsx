import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StoryPanel } from "../components/StoryPanel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { LeadTimeTrendChart } from "../components/charts/LeadTimeTrendChart";
import { formatCurrency, formatDays, formatNumber } from "../format";

const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-2.5 py-2 text-ink-primary";

export function DeliveryPage() {
  const { delivery } = useLoadedDashboardData();
  const s = delivery.summary;

  const directionAccent =
    s.direction === "slower" ? "critical" : s.direction === "faster" ? "good" : "default";

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Turnaround & delivery performance"
        description="Time from an order being booked in to it leaving the building. Because a 30,000-copy book and a business-card run are not comparable, performance is judged per product against that product's own norm rather than against a single company-wide target."
      />

      <StoryPanel story={delivery.story} />

      <StatCalloutRow>
        <StatCallout value={formatDays(s.median_days)} label="Typical turnaround (median)" />
        <StatCallout value={formatDays(s.p90_days)} label="Slowest tenth of jobs take at least" accent="warning" />
        <StatCallout value={formatDays(s.fastest_median_days)} label={`Fastest: ${s.fastest_work_type}`} accent="good" />
        <StatCallout
          value={`${s.recent_vs_prior_days >= 0 ? "+" : ""}${s.recent_vs_prior_days}d`}
          label={`Recent trend — ${s.direction}`}
          accent={directionAccent as "default" | "good" | "critical"}
        />
      </StatCalloutRow>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Turnaround by type of work" subtitle="Median days from booking to despatch">
          <HorizontalBarChart
            data={delivery.by_work_type.map((w) => ({ name: w.work_type, value: w.median_days }))}
            colorIndex={2}
            valueFormatter={(v) => `${v}d`}
            valueLabel="Median turnaround"
            height={220}
          />
        </Panel>

        <Panel
          title="Slowest products"
          subtitle="Median turnaround by product, for products with enough volume to be meaningful"
        >
          <HorizontalBarChart
            data={delivery.by_product.slice(0, 8).map((p) => ({ name: p.product_type, value: p.median_days }))}
            colorIndex={1}
            valueFormatter={(v) => `${v}d`}
            valueLabel="Median turnaround"
            height={260}
          />
        </Panel>
      </div>

      <Panel
        title="Is turnaround improving or slipping?"
        subtitle="Median days to despatch, month by month"
      >
        <LeadTimeTrendChart data={delivery.monthly_trend} />
      </Panel>

      <Panel
        title="Jobs that ran far beyond their product's norm"
        subtitle="Ranked by how far past the usual turnaround for that same product they went — this is where recoverable time sits, rather than in jobs that are simply long by nature"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>Job</th>
                <th className={th}>Customer</th>
                <th className={th}>Product</th>
                <th className={th}>Took</th>
                <th className={th}>Over that product's norm</th>
                <th className={th}>Sell price</th>
              </tr>
            </thead>
            <tbody>
              {delivery.slowest_jobs.map((j, i) => (
                <tr key={`${j.job_id}-${i}`}>
                  <td className={td}>{j.job_id}</td>
                  <td className={td}>{j.customer_name}</td>
                  <td className={td}>{j.product_type}</td>
                  <td className={td}>{formatNumber(j.lead_time_days)} days</td>
                  <td className={`${td} font-semibold text-status-critical`}>
                    +{formatNumber(j.days_over_product_norm)} days
                  </td>
                  <td className={td}>{formatCurrency(j.sell_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
