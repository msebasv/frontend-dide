import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

import ChartCard from "./ChartCard";
import type { PhaseStat } from "../types/statistics.types";

interface PhaseDonutChartProps {
  data: PhaseStat[];
  /** Al hacer clic en una fase, filtra el detalle de procesos. */
  onPhaseClick?: (phaseName: string) => void;
  activePhases?: string[];
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PhaseStat }[];
}) => {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold text-primary">{item.shortName}</p>
      <p className="text-xs text-muted">
        {item.value} proceso{item.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
};

function PhaseDonutChart({
  data,
  onPhaseClick,
  activePhases = [],
}: PhaseDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;
  const activeSet = new Set(activePhases);

  return (
    <ChartCard
      title="Distribución por fase"
      subtitle={
        onPhaseClick
          ? "Clic en una fase para ver los procesos de ese estado"
          : "Estado actual de los procesos de virtualización"
      }
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="shortName"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={3}
              stroke="none"
              cursor={onPhaseClick ? "pointer" : "default"}
              onClick={(_, index) => {
                const item = data[index];
                if (item && onPhaseClick) onPhaseClick(item.name);
              }}
            >
              {data.map((entry) => {
                const isActive =
                  activeSet.size === 0 || activeSet.has(entry.name);
                return (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    fillOpacity={isActive ? 1 : 0.28}
                    stroke={
                      activeSet.has(entry.name) ? "rgba(0,64,64,0.45)" : "none"
                    }
                    strokeWidth={activeSet.has(entry.name) ? 2 : 0}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(value) => (
                <span className="text-xs text-gray-600">{value}</span>
              )}
            />
            <text
              x="50%"
              y="46%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-primary text-2xl font-bold"
            >
              {total}
            </text>
            <text
              x="50%"
              y="56%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted text-xs"
            >
              procesos
            </text>
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          No hay datos de fases disponibles
        </div>
      )}
    </ChartCard>
  );
}

export default PhaseDonutChart;
