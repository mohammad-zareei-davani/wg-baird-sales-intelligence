import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import {
  ActionList,
  BreakdownTable,
  Finding,
  MetricRow,
  PageTitle,
} from "../components/brief/Brief";
import { CustomerValueChart } from "../components/charts/CustomerValueChart";
import { WorkTypeChart } from "../components/charts/WorkTypeChart";
import { formatCurrency, formatNumber, formatPct } from "../format";

const th = "whitespace-nowrap border-b border-edge px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-label text-ink-muted";
const td = "whitespace-nowrap border-t border-edge px-4 py-2.5 text-ink-primary";

export function CustomerValuePage() {
  const { customerValue } = useLoadedDashboardData();
  const { brief, concentration } = customerValue;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-8">
      <PageTitle eyebrow="Customer Value" title={brief.title} />
      <MetricRow metrics={brief.metrics} />
      <Finding hero={brief.hero} />

      <Panel
        title="Top customers by value added"
        subtitle={`Coloured bars are the ${concentration.ahead_count} accounts standing clearly ahead of the field. The dashed line marks the average account, which the rest sit close to.`}
      >
        <CustomerValueChart
          data={customerValue.top_customers}
          aheadCount={concentration.ahead_count}
          meanVa={concentration.mean_va}
        />
      </Panel>

      <BreakdownTable breakdown={brief.breakdown} />

      <Panel title="Value added by work type" subtitle="Litho, Digital, Wide Format and Outwork compared">
        <WorkTypeChart data={customerValue.work_type_breakdown} />
      </Panel>

      <ActionList actions={brief.actions} />

      <Panel title="Account detail">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>Customer</th>
                <th className={th}>Sector</th>
                <th className={th}>Main work type</th>
                <th className={th}>Jobs</th>
                <th className={th}>Sales</th>
                <th className={th}>Value added</th>
                <th className={th}>Share of value</th>
                <th className={th}>Last order</th>
              </tr>
            </thead>
            <tbody>
              {customerValue.top_customers.map((c) => (
                <tr key={c.customer_id}>
                  <td className={td}>{c.customer_name}</td>
                  <td className={td}>{c.industry}</td>
                  <td className={td}>{c.top_work_type}</td>
                  <td className={td}>{formatNumber(c.job_count)}</td>
                  <td className={td}>{formatCurrency(c.total_sell_price)}</td>
                  <td className={td}>{formatCurrency(c.total_va_amount)}</td>
                  <td className={td}>{formatPct(c.value_share_pct)}</td>
                  <td className={td}>{c.last_order}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
