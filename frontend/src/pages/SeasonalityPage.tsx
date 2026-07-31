import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { SeasonalityChart } from "../components/charts/SeasonalityChart";
import { SeasonalIndexChart } from "../components/charts/SeasonalIndexChart";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { formatCurrencyCompact } from "../format";

export function SeasonalityPage() {
  const { seasonality } = useLoadedDashboardData();
  const s = seasonality.summary;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageTitle eyebrow="Demand & Capacity Planning" title={seasonality.brief.title} />
      <Brief brief={seasonality.brief} />

      <SupportingCharts>
        <Panel
          title="Booked sales by month, with projection"
          subtitle={`The dashed line projects the next ${s.forecast_horizon_months} months.`}
        >
          <SeasonalityChart monthly={seasonality.monthly} forecast={seasonality.sales_forecast} />
        </Panel>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel
            title="The shape of the year — sales"
            subtitle="Each month against an average month (100)"
          >
            <SeasonalIndexChart data={seasonality.sales_seasonal_index} />
          </Panel>

          <Panel
            title="The shape of the year — press hours"
            subtitle="The same view in production terms, which is what has to be staffed"
          >
            <SeasonalIndexChart data={seasonality.press_seasonal_index} />
          </Panel>
        </div>

        <Panel
          title={`What drives the ${s.peak_month} peak`}
          subtitle="Sales in the busiest month by customer sector"
        >
          <HorizontalBarChart
            data={seasonality.peak_month_mix.map((m) => ({ name: m.industry, value: m.sell_price }))}
            colorIndex={0}
            valueFormatter={formatCurrencyCompact}
            valueLabel={`Sales in ${s.peak_month}`}
          />
        </Panel>
      </SupportingCharts>
    </div>
  );
}
