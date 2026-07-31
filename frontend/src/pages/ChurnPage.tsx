import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { ChurnStatusChart } from "../components/charts/ChurnStatusChart";
import { FollowUpTable } from "../components/FollowUpTable";

export function ChurnPage() {
  const { churn } = useLoadedDashboardData();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageTitle eyebrow="Account Retention" title={churn.brief.title} />
      <Brief brief={churn.brief} />

      <SupportingCharts>
        <Panel title="Customer status distribution">
          <ChurnStatusChart counts={churn.status_counts} />
        </Panel>

        <Panel
          title="Follow-up list"
          subtitle="At-risk and dormant accounts, ranked by lifetime value — the highest-value relationships to re-engage first"
        >
          <FollowUpTable rows={churn.follow_up_opportunities} />
        </Panel>
      </SupportingCharts>
    </div>
  );
}
