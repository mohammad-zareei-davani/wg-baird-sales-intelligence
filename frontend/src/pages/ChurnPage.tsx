import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StoryPanel } from "../components/StoryPanel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { ChurnStatusChart } from "../components/charts/ChurnStatusChart";
import { FollowUpTable } from "../components/FollowUpTable";
import { formatCurrencyCompact, formatNumber } from "../format";

export function ChurnPage() {
  const { churn } = useLoadedDashboardData();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Customer churn & follow-up opportunities"
        description="Silence is judged against each customer's own ordering habit. Six weeks of quiet from a fortnightly customer is a genuine warning; the same six weeks from a twice-a-year customer means nothing. Accounts with too little history to have a habit fall back to fixed thresholds."
      />

      <StoryPanel story={churn.story} />

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
