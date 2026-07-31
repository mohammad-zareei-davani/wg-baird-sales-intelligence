import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChurnStatus } from "../../api/types";
import { tooltipStyle, useChartTheme } from "../../theme/colors";

export function ChurnStatusChart({ counts }: { counts: Record<ChurnStatus, number> }) {
  const theme = useChartTheme();

  const statusColor: Record<ChurnStatus, string> = {
    Active: theme.status.good,
    "At Risk": theme.status.warning,
    Dormant: theme.status.critical,
  };

  const data = (Object.keys(counts) as ChurnStatus[]).map((status) => ({
    name: status,
    value: counts[status],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={56}
          outerRadius={84}
          paddingAngle={2}
          stroke={theme.surfaceRaised}
          strokeWidth={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={statusColor[entry.name as ChurnStatus]} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={32}
          formatter={(value) => <span style={{ color: theme.textSecondary, fontSize: 12 }}>{value}</span>}
        />
        <Tooltip contentStyle={tooltipStyle(theme)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
