import {
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatGbp, formatGbpCompact, formatInt } from "../../format";
import { palette } from "../../theme";
import type { VolumeValuePoint } from "../../types";

interface VolumeValueScatterProps {
  points: VolumeValuePoint[];
  /** Customer IDs to label directly on the plot (the outlier pair). */
  labelled: string[];
}

interface PlotPoint extends VolumeValuePoint {
  label: string;
}

export function VolumeValueScatter({ points, labelled }: VolumeValueScatterProps) {
  const labelledSet = new Set(labelled);
  const base: PlotPoint[] = points
    .filter((point) => !labelledSet.has(point.customer_id))
    .map((point) => ({ ...point, label: "" }));
  const highlighted: PlotPoint[] = points
    .filter((point) => labelledSet.has(point.customer_id))
    .map((point) => ({ ...point, label: point.customer_id }));

  return (
    <div className="fade-in h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 28, bottom: 24, left: 8 }}>
          <CartesianGrid stroke={palette.rule} />
          <XAxis
            type="number"
            dataKey="job_count"
            name="Jobs"
            stroke={palette.mid}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            label={{
              value: "Job count (volume)",
              position: "insideBottom",
              offset: -14,
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="total_va_gbp"
            name="VA"
            stroke={palette.mid}
            tickFormatter={(value: number) => formatGbpCompact(value)}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            width={64}
            label={{
              value: "Total VA (GBP)",
              angle: -90,
              position: "insideLeft",
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <ZAxis range={[36, 36]} />
          <Tooltip
            contentStyle={{
              backgroundColor: palette.paper,
              border: `1px solid ${palette.ink}`,
              borderRadius: 0,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) =>
              name === "Jobs" ? [formatInt(value), name] : [formatGbp(value), name]
            }
            labelFormatter={() => ""}
          />
          <Scatter
            name="Customers"
            data={base}
            fill={palette.mid}
            fillOpacity={0.55}
            shape="circle"
          />
          <Scatter name="Outlier pair" data={highlighted} fill={palette.cyan} shape="circle">
            <LabelList
              dataKey="label"
              position="right"
              offset={10}
              style={{
                fill: palette.ink,
                fontSize: 11,
                fontFamily: "IBM Plex Mono, monospace",
              }}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
