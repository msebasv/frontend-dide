/**
 * Agregaciones estadísticas para el dashboard del líder.
 * Toma procesos ya mapeados y calcula KPIs, distribuciones y tendencias.
 */
import type { Dev_tableactivities } from "../../generated/models/Dev_tableactivitiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import {
  COMPLETED_STATUS,
  PHASE_STATS_CONFIG,
} from "../constants/phaseConfig";
import type { LeaderStatistics, StatisticsDeliverableRow } from "../types/statistics.types";
import {
  DELIVERABLE_STATS_CONFIG,
  resolveDeliverableStatBucket,
} from "../constants/deliverableStatsConfig";

const VALIDATOR_STATUS = "Revisión y aprobación evaluador disciplinar";
const ADVISOR_STATUS = "Revisión y aprobación asesor pedagógico";

const isSameMonth = (dateStr: string, reference: Date): boolean => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  );
};

const formatMonthLabel = (date: Date): string =>
  date.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });

const buildMonthlyTrend = (
  processes: Dev_tablevirtualizationprocesses[],
  activities: Dev_tableactivities[],
): LeaderStatistics["monthlyTrend"] => {
  const now = new Date();
  const months: LeaderStatistics["monthlyTrend"] = [];

  for (let index = 5; index >= 0; index -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const monthLabel = formatMonthLabel(monthDate);

    const processCount = processes.filter((process) =>
      isSameMonth(process.createdon ?? "", monthDate),
    ).length;

    const activityCount = activities.filter((activity) =>
      isSameMonth(activity.createdon ?? "", monthDate),
    ).length;

    months.push({
      month: monthLabel,
      activities: activityCount,
      processes: processCount,
    });
  }

  return months;
};

const shortenRoleName = (role: string): string => {
  const normalized = role.trim();
  if (!normalized || normalized === "—") return "Sin rol";

  return normalized
    .replace("Revisión y aprobación ", "")
    .replace("Cargue de documentos por el autor", "Cargue autor")
    .slice(0, 28);
};

export const buildLeaderStatistics = (
  processes: VirtualizationProcess[],
  rawProcesses: Dev_tablevirtualizationprocesses[],
  activities: Dev_tableactivities[],
  phases: Dev_tablephases[],
  deliverables: StatisticsDeliverableRow[] = [],
): LeaderStatistics => {
  const totalProcesses = processes.length;
  const completed = processes.filter((p) => p.status === COMPLETED_STATUS).length;
  const pendingApproval = processes.filter(
    (p) => p.status === VALIDATOR_STATUS || p.status === ADVISOR_STATUS,
  ).length;
  const inProgress = processes.filter(
    (p) => p.status !== COMPLETED_STATUS && p.status !== "Sin estado" && p.status !== "",
  ).length;

  const phaseIds = new Set(phases.map((phase) => phase.dev_tablephaseid));
  const processActivities = activities.filter((activity) =>
    phaseIds.has(activity._dev_tablephase_value ?? ""),
  );

  const now = new Date();
  const processesThisMonth = rawProcesses.filter((process) =>
    isSameMonth(process.createdon ?? "", now),
  ).length;
  const activitiesThisMonth = processActivities.filter((activity) =>
    isSameMonth(activity.createdon ?? "", now),
  ).length;

  const metrics: LeaderStatistics["metrics"] = {
    totalProcesses,
    inProgress,
    pendingApproval,
    completed,
    completionRate:
      totalProcesses > 0 ? Math.round((completed / totalProcesses) * 100) : 0,
    totalActivities: processActivities.length,
    avgActivitiesPerProcess:
      totalProcesses > 0
        ? Math.round((processActivities.length / totalProcesses) * 10) / 10
        : 0,
    processesThisMonth,
    activitiesThisMonth,
  };

  const phaseDistribution = PHASE_STATS_CONFIG.map((phase) => ({
    name: phase.key,
    shortName: phase.label,
    value: processes.filter((process) => process.status === phase.key).length,
    color: phase.color,
  }));

  const facultyMap = new Map<string, FacultyAccumulator>();

  for (const process of processes) {
    const facultyName = process.facultyName || "Sin facultad";
    const current = facultyMap.get(facultyName) ?? {
      total: 0,
      completed: 0,
      inProgress: 0,
    };

    current.total += 1;
    if (process.status === COMPLETED_STATUS) {
      current.completed += 1;
    } else if (process.status) {
      current.inProgress += 1;
    }

    facultyMap.set(facultyName, current);
  }

  const facultyDistribution = Array.from(facultyMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total);

  const programMap = new Map<string, number>();
  for (const process of processes) {
    const programName = process.programName || "Sin programa";
    programMap.set(programName, (programMap.get(programName) ?? 0) + 1);
  }

  const programDistribution = Array.from(programMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const roleMap = new Map<string, number>();
  for (const activity of processActivities) {
    const role = shortenRoleName(
      activity.dev_tableactivitytemplatename ?? activity.dev_activityname ?? "—",
    );
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
  }

  const activitiesByRole = Array.from(roleMap.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const deliverableAgg = buildDeliverableAggregates(deliverables);

  return {
    metrics,
    phaseDistribution,
    facultyDistribution,
    programDistribution,
    monthlyTrend: buildMonthlyTrend(rawProcesses, processActivities),
    activitiesByRole,
    deliverableMetrics: deliverableAgg.metrics,
    deliverableDistribution: deliverableAgg.distribution,
    deliverableFacultyDistribution: deliverableAgg.facultyDistribution,
  };
};

interface FacultyAccumulator {
  total: number;
  completed: number;
  inProgress: number;
}

const buildDeliverableAggregates = (
  deliverables: StatisticsDeliverableRow[],
): {
  metrics: LeaderStatistics["deliverableMetrics"];
  distribution: LeaderStatistics["deliverableDistribution"];
  facultyDistribution: LeaderStatistics["deliverableFacultyDistribution"];
} => {
  let pending = 0;
  let inReview = 0;
  let approved = 0;

  for (const item of deliverables) {
    const bucket = resolveDeliverableStatBucket(item.stateLabel);
    if (bucket === "pending") pending += 1;
    else if (bucket === "inReview") inReview += 1;
    else if (bucket === "approved") approved += 1;
  }

  const totalDeliverables = deliverables.length;
  const metrics = {
    totalDeliverables,
    pending,
    inReview,
    approved,
    completionRate:
      totalDeliverables > 0
        ? Math.round((approved / totalDeliverables) * 100)
        : 0,
  };

  const countByState = new Map<string, number>();
  for (const item of deliverables) {
    const key = item.stateLabel || "Sin estado";
    countByState.set(key, (countByState.get(key) ?? 0) + 1);
  }

  const knownKeys = new Set(
    DELIVERABLE_STATS_CONFIG.map((item) => item.key.toLowerCase()),
  );
  const distribution = [
    ...DELIVERABLE_STATS_CONFIG.map((config) => ({
      name: config.key,
      shortName: config.label,
      value: countByState.get(config.key) ?? 0,
      color: config.color,
    })),
    ...[...countByState.entries()]
      .filter(([name]) => !knownKeys.has(name.toLowerCase()))
      .map(([name, value]) => ({
        name,
        shortName: name,
        value,
        color: "#6b7280",
      })),
  ].filter((item) => item.value > 0 || knownKeys.has(item.name.toLowerCase()));

  const facultyMap = new Map<string, FacultyAccumulator>();
  for (const item of deliverables) {
    const facultyName = item.facultyName || "Sin facultad";
    const current = facultyMap.get(facultyName) ?? {
      total: 0,
      completed: 0,
      inProgress: 0,
    };
    current.total += 1;
    const bucket = resolveDeliverableStatBucket(item.stateLabel);
    if (bucket === "approved") current.completed += 1;
    else current.inProgress += 1;
    facultyMap.set(facultyName, current);
  }

  const facultyDistribution = Array.from(facultyMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total);

  return { metrics, distribution, facultyDistribution };
};
