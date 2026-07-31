import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { CustomerValueChart } from "../components/charts/CustomerValueChart";
import { WorkTypeChart } from "../components/charts/WorkTypeChart";
import { formatCurrency, formatNumber, formatPct } from "../format";

const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-2.5 py-2 text-ink-primary";

export function CustomerValuePage() {
  const { customerValue } = useLoadedDashboardData();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div>
        <h1 className="mb-1.5 text-2xl font-bold">Most valuable customers &amp; types of work</h1>
        <p className="max-w-[720px] text-sm leading-relaxed text-ink-secondary">
          Customers ranked by Value Added (VA) — what the business keeps after paper, press and
          purchase costs — rather than raw sell price, since VA is the better proxy for how much a
          relationship is actually worth.
        </p>
      </div>

      <StatCalloutRow>
        <StatCallout value={String(customerValue.concentration.customer_count)} label="Total customers" />
        <StatCallout value={String(customerValue.concentration.customers_for_80pct_value)} label="Accounts driving 80% of VA" />
        <StatCallout value={formatPct(customerValue.concentration.pct_of_customers_for_80pct_value)} label="Share of customer base" />
      </StatCalloutRow>

      <Panel title="Top customers by Value Added" subtitle="Top 20 accounts, ranked by lifetime VA">
        <CustomerValueChart data={customerValue.top_customers} />
      </Panel>

      <Panel title="Value Added by work type" subtitle="Litho, Digital, Wide Format and Outwork compared">
        <WorkTypeChart data={customerValue.work_type_breakdown} />
      </Panel>

      <Panel title="Top customer detail">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>Customer</th>
                <th className={th}>Top work type</th>
                <th className={th}>Jobs</th>
                <th className={th}>Total sell price</th>
                <th className={th}>Total VA</th>
                <th className={th}>Avg VA%</th>
                <th className={th}>Share of total VA</th>
                <th className={th}>First order</th>
                <th className={th}>Last order</th>
              </tr>
            </thead>
            <tbody>
              {customerValue.top_customers.map((c) => (
                <tr key={c.customer_id}>
                  <td className={td}>{c.customer_name}</td>
                  <td className={td}>{c.top_work_type}</td>
                  <td className={td}>{formatNumber(c.job_count)}</td>
                  <td className={td}>{formatCurrency(c.total_sell_price)}</td>
                  <td className={td}>{formatCurrency(c.total_va_amount)}</td>
                  <td className={td}>{formatPct(c.avg_va_pct * 100)}</td>
                  <td className={td}>{formatPct(c.value_share_pct)}</td>
                  <td className={td}>{c.first_order}</td>
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
