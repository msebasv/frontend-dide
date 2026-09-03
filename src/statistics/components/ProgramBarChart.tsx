import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import ChartCard from "./ChartCard";
import type { ProgramStat } from "../types/statistics.types";

interface ProgramBarChartProps {
  data: ProgramStat[];
}

const BAR_COLORS = [
  "#004040",
  "#005555",
  "#86c127",
  "#5ea018",
  "#9ad43a",
  "#3f8f2a",
  "#d97706",
  "#006666",
];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold text-primary">{label}</p>
      <p className="text-xs text-muted">
        {payload[0].value} proceso{payload[0].value !== 1 ? "s" : ""}
      </p>
    </div>
  );
};

function ProgramBarChart({ data }: ProgramBarChartProps) {
  return (
    <ChartCard
      title="Top programas"
      subtitle="Programas con mayor cantidad de procesos activos"
    >
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={BAR_COLORS[index % BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          No hay datos por programa
        </div>
      )}
    </ChartCard>
  );
}

export default ProgramBarChart;
