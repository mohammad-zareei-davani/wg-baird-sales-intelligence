import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPct } from "../format";

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-3 py-2 text-ink-primary";

export function PricingPage() {
  const { pricing } = useLoadedDashboardData();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageTitle eyebrow="Pricing Integrity" title={pricing.brief.title} />
      <Brief brief={pricing.brief} />

      <SupportingCharts>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel
            title="Where discounting concentrates"
            subtitle="Total price reductions by account"
          >
            <HorizontalBarChart
              data={pricing.discount_by_customer.slice(0, 10).map((d) => ({
                name: d.customer_name,
                value: d.discount_total,
              }))}
              colorIndex={1}
              valueFormatter={formatCurrencyCompact}
              valueLabel="Price reductions"
            />
          </Panel>

          <Panel
            title="Discounting by sales rep"
            subtitle="A coaching conversation, not a league table — territories differ in size and mix"
          >
            <HorizontalBarChart
              data={[...pricing.discount_by_rep]
                .sort((a, b) => b.discount_total - a.discount_total)
                .slice(0, 10)
                .map((d) => ({ name: d.name, value: d.discount_total }))}
              colorIndex={3}
              valueFormatter={formatCurrencyCompact}
              valueLabel="Price reductions"
            />
          </Panel>
        </div>

        <Panel
          title="Accounts carrying below-cost work"
          subtitle="Some of these will be genuine loss-makers, some credit notes or mis-bookings. Establishing which is the point of the list."
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Customer</th>
                  <th className={th}>Jobs below cost</th>
                  <th className={th}>Value added</th>
                  <th className={th}>Sell price of those jobs</th>
                </tr>
              </thead>
              <tbody>
                {pricing.below_cost_by_customer.map((r) => (
                  <tr key={r.customer_name}>
                    <td className={td}>{r.customer_name}</td>
                    <td className={td}>{formatNumber(r.job_count)}</td>
                    <td className={`${td} font-semibold text-status-criticalText`}>
                      {formatCurrency(r.va_amount)}
                    </td>
                    <td className={td}>{formatCurrency(r.sell_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Discounting by type of work"
          subtitle="Reductions measured against each category's own sales, so a large category is not flagged simply for being large"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Work type</th>
                  <th className={th}>Jobs discounted</th>
                  <th className={th}>Total jobs</th>
                  <th className={th}>Reductions</th>
                  <th className={th}>% of category sales</th>
                </tr>
              </thead>
              <tbody>
                {pricing.discount_by_work_type.map((r) => (
                  <tr key={r.name}>
                    <td className={td}>{r.name}</td>
                    <td className={td}>{formatNumber(r.discounted_jobs)}</td>
                    <td className={td}>{formatNumber(r.all_jobs)}</td>
                    <td className={td}>{formatCurrency(r.discount_total)}</td>
                    <td className={td}>{formatPct(r.discount_as_pct_of_sales, 2)}</td>
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
