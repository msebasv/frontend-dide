import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import ChartCard from "./ChartCard";
import type { FacultyStat } from "../types/statistics.types";

interface FacultyBarChartProps {
  data: FacultyStat[];
  title?: string;
  subtitle?: string;
  completedLabel?: string;
  inProgressLabel?: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  completedLabel = "Completados",
  inProgressLabel = "En progreso",
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
  completedLabel?: string;
  inProgressLabel?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="mb-1 text-xs font-semibold text-primary">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs text-muted">
          <span style={{ color: entry.color }}>●</span>{" "}
          {entry.dataKey === "completed" ? completedLabel : inProgressLabel}:{" "}
          {entry.value}
        </p>
      ))}
    </div>
  );
};

function FacultyBarChart({
  data,
  title = "Procesos por facultad",
  subtitle = "Comparativa de avance por unidad académica",
  completedLabel = "Completados",
  inProgressLabel = "En progreso",
}: FacultyBarChartProps) {
  const chartData = data.slice(0, 6);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={56}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={
                <CustomTooltip
                  completedLabel={completedLabel}
                  inProgressLabel={inProgressLabel}
                />
              }
            />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-gray-600">
                  {value === "completed" ? completedLabel : inProgressLabel}
                </span>
              )}
            />
            <Bar
              dataKey="completed"
              stackId="faculty"
              fill="#004040"
              radius={[0, 0, 0, 0]}
              maxBarSize={48}
            />
            <Bar
              dataKey="inProgress"
              stackId="faculty"
              fill="#86c127"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          No hay datos por facultad
        </div>
      )}
    </ChartCard>
  );
}

export default FacultyBarChart;
