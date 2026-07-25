import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGbp, formatGbpCompact } from "../../format";
import { palette } from "../../theme";
import type { VarianceRow } from "../../types";

interface VarianceBarsProps {
  rows: VarianceRow[];
  /** Axis caption naming the dimension, e.g. "Sales rep". */
  dimensionLabel: string;
}

export function VarianceBars({ rows, dimensionLabel }: VarianceBarsProps) {
  const data = rows.map((row) => ({
    key: row.key ?? "—",
    negative: row.negative_override_gbp,
    positive: row.positive_override_gbp,
    net: row.net_override_gbp,
  }));

  return (
    <div className="fade-in h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={palette.rule} vertical={false} />
          <XAxis
            dataKey="key"
            stroke={palette.mid}
            tick={{ fill: palette.ink, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            label={{
              value: dimensionLabel,
              position: "insideBottom",
              offset: -16,
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <YAxis
            stroke={palette.mid}
            tickFormatter={(value: number) => formatGbpCompact(value)}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            width={70}
            label={{
              value: "Override value (GBP)",
              angle: -90,
              position: "insideLeft",
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: palette.paper,
              border: `1px solid ${palette.ink}`,
              borderRadius: 0,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [formatGbp(value), name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif" }}
            iconType="square"
          />
          <ReferenceLine y={0} stroke={palette.ink} />
          <Bar dataKey="negative" name="Discounts (negative)" fill={palette.magenta} barSize={12} />
          <Bar dataKey="positive" name="Mark-ups (positive)" fill={palette.cyan} barSize={12} />
          <Bar dataKey="net" name="Net position" barSize={12}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.net >= 0 ? palette.ink : palette.ochre} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
