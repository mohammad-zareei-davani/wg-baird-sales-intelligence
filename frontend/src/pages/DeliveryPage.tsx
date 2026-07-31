import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { LeadTimeTrendChart } from "../components/charts/LeadTimeTrendChart";
import { formatCurrency, formatNumber } from "../format";

const th = "whitespace-nowrap border-b border-edge px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-label text-ink-muted";
const td = "whitespace-nowrap border-t border-edge px-4 py-2.5 text-ink-primary";

export function DeliveryPage() {
  const { delivery } = useLoadedDashboardData();

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <PageTitle eyebrow="Production Turnaround" title={delivery.brief.title} />
      <Brief brief={delivery.brief} />

      <SupportingCharts>
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

          <Panel title="Slowest products" subtitle="Products with enough volume to be meaningful">
            <HorizontalBarChart
              data={delivery.by_product.slice(0, 8).map((p) => ({ name: p.product_type, value: p.median_days }))}
              colorIndex={1}
              valueFormatter={(v) => `${v}d`}
              valueLabel="Median turnaround"
              height={260}
            />
          </Panel>
        </div>

        <Panel title="Is turnaround improving or slipping?" subtitle="Median days to despatch, month by month">
          <LeadTimeTrendChart data={delivery.monthly_trend} />
        </Panel>

        <Panel
          title="Jobs that ran far beyond their product's norm"
          subtitle="Ranked by how far past the usual turnaround for that same product they went. This is where recoverable time sits"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Job</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Product</th>
                  <th className={th}>Took</th>
                  <th className={th}>Over the norm</th>
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
                    <td className={`${td} font-semibold text-status-criticalText`}>
                      +{formatNumber(j.days_over_product_norm)} days
                    </td>
                    <td className={td}>{formatCurrency(j.sell_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </SupportingCharts>
    </div>
  );
}
