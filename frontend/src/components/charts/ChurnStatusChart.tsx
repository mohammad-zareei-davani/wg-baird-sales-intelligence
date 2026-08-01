import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChurnStatus } from "../../api/types";
import { CHART, STATUS, tooltipStyle } from "../../theme/colors";

const STATUS_COLOR: Record<ChurnStatus, string> = {
  Active: STATUS.good,
  "At Risk": STATUS.warning,
  Dormant: STATUS.critical,
};

export function ChurnStatusChart({
  counts,
  showLegend = true,
}: {
  counts: Record<ChurnStatus, number>;
  showLegend?: boolean;
}) {
  const data = (Object.keys(counts) as ChurnStatus[]).map((status) => ({
    name: status,
    value: counts[status],
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartHeight = showLegend ? 200 : 200;

  return (
    <div className="mx-auto w-full max-w-[240px]">
      <div className="relative" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke={CHART.surface}
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLOR[entry.name as ChurnStatus]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="tnum text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink-primary">
            {total}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-label text-ink-muted">
            Accounts
          </div>
        </div>
      </div>
      {showLegend && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STATUS_COLOR[d.name as ChurnStatus] }}
              />
              {d.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
