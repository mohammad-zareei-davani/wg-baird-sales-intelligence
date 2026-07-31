import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tooltipStyle, useChartTheme } from "../../theme/colors";

const shortMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleString("en-GB", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
};

/** Median days from booking to despatch, month by month. */
export function LeadTimeTrendChart({
  data,
}: {
  data: { month_start: string; median_days: number; job_count: number }[];
}) {
  const theme = useChartTheme();
  const chartData = data.map((d) => ({
    label: shortMonth(d.month_start),
    days: d.median_days,
    jobs: d.job_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={theme.gridline} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={theme.axis}
          tick={{ fill: theme.textMuted, fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          stroke={theme.axis}
          tick={{ fill: theme.textMuted, fontSize: 11 }}
          tickFormatter={(v: number) => `${v}d`}
        />
        <Tooltip
          contentStyle={tooltipStyle(theme)}
          formatter={(value: number, _n, item) => [
            `${value} days (${item.payload.jobs} jobs)`,
            "Median turnaround",
          ]}
        />
        <Line type="monotone" dataKey="days" stroke={theme.series[2]} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
