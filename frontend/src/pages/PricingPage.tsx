import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StoryPanel } from "../components/StoryPanel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPct } from "../format";

const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-2.5 py-2 text-ink-primary";

export function PricingPage() {
  const { pricing } = useLoadedDashboardData();
  const s = pricing.summary;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Pricing discipline & margin integrity"
        description="Every quote starts from an automatically calculated price which the estimator can override before it goes out. That override is where commercial judgement enters the process — and where margin leaks if nobody measures it."
      />

      <StoryPanel story={pricing.story} />

      <StatCalloutRow>
        <StatCallout value={formatPct(s.overridden_pct)} label="Of jobs have the price overridden" accent="warning" />
        <StatCallout value={formatCurrencyCompact(s.discount_total)} label="Given away in reductions" accent="critical" />
        <StatCallout value={formatCurrencyCompact(s.uplift_total)} label="Added back in uplifts" accent="good" />
        <StatCallout value={formatCurrencyCompact(s.net_adjustment)} label="Net effect on price" />
      </StatCalloutRow>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Where discounting concentrates"
          subtitle="Total price reductions by account — the accounts absorbing most of the give-away"
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
          subtitle="Useful as a coaching conversation, not a league table — rep territories differ in size and type of work"
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
        title="Jobs delivered below cost"
        subtitle={`${formatNumber(s.below_cost_jobs)} jobs finished with negative value added. Some of these will be genuine loss-makers and some will be credit notes or mis-bookings — the point of the list is that the distinction is worth establishing.`}
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
                  <td className={`${td} font-semibold text-status-critical`}>{formatCurrency(r.va_amount)}</td>
                  <td className={td}>{formatCurrency(r.sell_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Discounting by type of work"
        subtitle="Reductions expressed against the sales value of each category, so a big category is not flagged simply for being big"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>Work type</th>
                <th className={th}>Jobs discounted</th>
                <th className={th}>Total jobs</th>
                <th className={th}>Reductions</th>
                <th className={th}>As % of that category's sales</th>
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
    </div>
  );
}
