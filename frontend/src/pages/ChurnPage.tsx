import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { ChurnStatusChart } from "../components/charts/ChurnStatusChart";
import { FollowUpTable } from "../components/FollowUpTable";
import { formatCurrencyCompact, formatNumber } from "../format";

export function ChurnPage() {
  const { churn } = useLoadedDashboardData();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div>
        <h1 className="mb-1.5 text-2xl font-bold">Customer churn &amp; follow-up opportunities</h1>
        <p className="max-w-[720px] text-sm leading-relaxed text-ink-secondary">
          Dormancy is scored against each customer's own historical ordering cadence — a customer who
          usually orders every 2 weeks going quiet for 45 days is a much stronger signal than the same
          gap for a customer who orders twice a year. Customers with a single order fall back to fixed
          thresholds, since they have no cadence to compare against.
        </p>
      </div>

      <StatCalloutRow>
        <StatCallout value={formatNumber(churn.status_counts.Active)} label="Active" accent="good" />
        <StatCallout value={formatNumber(churn.status_counts["At Risk"])} label="At risk" accent="warning" />
        <StatCallout value={formatNumber(churn.status_counts.Dormant)} label="Dormant" accent="critical" />
        <StatCallout value={formatCurrencyCompact(churn.dormant_lifetime_value_at_stake)} label="Lifetime VA at stake" />
      </StatCalloutRow>

      <Panel title="Customer status distribution">
        <ChurnStatusChart counts={churn.status_counts} />
      </Panel>

      <Panel
        title="Follow-up opportunities"
        subtitle="At-risk and dormant customers, ranked by lifetime value — highest-value relationships to re-engage first"
      >
        <FollowUpTable rows={churn.follow_up_opportunities} />
      </Panel>
    </div>
  );
}
