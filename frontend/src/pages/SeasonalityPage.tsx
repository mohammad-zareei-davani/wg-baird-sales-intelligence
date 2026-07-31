import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StoryPanel } from "../components/StoryPanel";
import { StatCallout, StatCalloutRow } from "../components/StatCallout";
import { SeasonalityChart } from "../components/charts/SeasonalityChart";
import { SeasonalIndexChart } from "../components/charts/SeasonalIndexChart";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { formatCurrencyCompact, formatNumber } from "../format";

export function SeasonalityPage() {
  const { seasonality } = useLoadedDashboardData();
  const s = seasonality.summary;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <PageHeader
        title="Demand seasonality & press capacity"
        description="The binding constraint in this business is press time, not order count. Tracking booked work and press hours by month shows where the year genuinely peaks, so capacity can be planned against expected load rather than against last month's actuals."
      />

      <StoryPanel story={seasonality.story} />

      <StatCalloutRow>
        <StatCallout value={s.peak_month} label={`Busiest month (${s.peak_index}% of average)`} accent="good" />
        <StatCallout value={s.trough_month} label={`Quietest month (${s.trough_index}% of average)`} accent="critical" />
        <StatCallout
          value={s.forecast_next_month_sales != null ? formatCurrencyCompact(s.forecast_next_month_sales) : "n/a"}
          label="Projected sales, next month"
        />
        <StatCallout
          value={s.forecast_next_month_press != null ? `${formatNumber(Math.round(s.forecast_next_month_press))} hrs` : "n/a"}
          label="Projected press hours, next month"
        />
      </StatCalloutRow>

      <Panel
        title="Booked sales by month, with projection"
        subtitle={
          s.sales_forecast_mape != null
            ? `The dashed line projects the next ${s.forecast_horizon_months} months. Backtested against recent months it has been out by about ${s.sales_forecast_mape}% on average — close enough to plan capacity around, not close enough to commit to.`
            : `The dashed line projects the next ${s.forecast_horizon_months} months.`
        }
      >
        <SeasonalityChart monthly={seasonality.monthly} forecast={seasonality.sales_forecast} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="The shape of the year — sales"
          subtitle="Each month against an average month (100). Above the line is busier than normal."
        >
          <SeasonalIndexChart data={seasonality.sales_seasonal_index} />
        </Panel>

        <Panel
          title="The shape of the year — press hours"
          subtitle="The same view in production terms, which is what actually has to be staffed"
        >
          <SeasonalIndexChart data={seasonality.press_seasonal_index} />
        </Panel>
      </div>

      <Panel
        title={`What drives the ${s.peak_month} peak`}
        subtitle="Sales in the busiest month by customer sector — this is where the seasonal load originates"
      >
        <HorizontalBarChart
          data={seasonality.peak_month_mix.map((m) => ({ name: m.industry, value: m.sell_price }))}
          colorIndex={0}
          valueFormatter={formatCurrencyCompact}
          valueLabel={`Sales in ${s.peak_month}`}
        />
      </Panel>
    </div>
  );
}
