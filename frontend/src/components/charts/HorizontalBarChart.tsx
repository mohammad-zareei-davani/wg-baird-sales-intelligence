import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, SERIES, hoverCursor, tooltipStyle } from "../../theme/colors";

export interface HBarDatum {
  name: string;
  value: number;
}

/**
 * Ranked comparison of one measure across named categories. The right form
 * when the question is "which is biggest" and the labels are too long to sit
 * under a vertical axis.
 */
export function HorizontalBarChart({
  data,
  colorIndex = 0,
  valueFormatter,
  valueLabel,
  height,
}: {
  data: HBarDatum[];
  colorIndex?: number;
  valueFormatter: (v: number) => string;
  valueLabel: string;
  height?: number;
}) {
  // Recharts renders the first category at the top in a vertical layout, so
  // the incoming (already ranked) order is used as-is to put the largest bar
  // first. Reversing here would bury the headline value at the bottom.
  const computedHeight = height ?? Math.max(200, data.length * 28);

  return (
    <ResponsiveContainer width="100%" height={computedHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART.gridline} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={valueFormatter}
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textMuted, fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textSecondary, fontSize: 11 }}
        />
        <Tooltip
          cursor={hoverCursor}
          contentStyle={tooltipStyle}
          formatter={(value: number) => [valueFormatter(value), valueLabel]}
        />
        <Bar
          dataKey="value"
          radius={[0, 3, 3, 0]}
          maxBarSize={16}
          fill={SERIES[colorIndex % SERIES.length]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
