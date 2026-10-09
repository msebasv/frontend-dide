/**
 * Agregaciones estadísticas para el dashboard del líder.
 * Toma procesos ya mapeados y calcula KPIs, distribuciones y tendencias.
 */
import type { Dev_tableactivities } from "../../generated/models/Dev_tableactivitiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import { PROCESS_PHASES } from "../../global/constants/domainConstants";
import { processElapsedDayCount } from "../../global/utils/colombiaBusinessDays";
import {
  COMPLETED_STATUS,
  PHASE_STATS_CONFIG,
} from "../constants/phaseConfig";
import type { LeaderStatistics, StatisticsDeliverableRow } from "../types/statistics.types";
import { resolveDeliverableStatBucket } from "../constants/deliverableStatsConfig";

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

const padMonth = (month: number): string => String(month).padStart(2, "0");

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
      monthKey: `${monthDate.getFullYear()}-${padMonth(monthDate.getMonth() + 1)}`,
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
    .replace(PROCESS_PHASES.AUTHOR_UPLOAD, "Cargue autor")
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
    (p) =>
      p.status === PROCESS_PHASES.VALIDATOR_REVIEW ||
      p.status === PROCESS_PHASES.ADVISOR_REVIEW,
  ).length;
  const inProgress = processes.filter(
    (p) =>
      p.status !== COMPLETED_STATUS &&
      p.status !== PROCESS_PHASES.UNKNOWN &&
      p.status !== "",
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

  const processElapsed = processes
    .map((process) => ({
      processId: process.processId,
      name: process.processName || "Sin nombre",
      days: processElapsedDayCount(
        process.createdOn,
        process.status === COMPLETED_STATUS ? process.modifiedOn : undefined,
      ),
    }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, "es"));
  const processElapsedCounts = countByElapsedDays(
    processElapsed.map((item) => item.days),
  );

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

  const processIdByPhase = new Map(
    phases.map((phase) => [
      phase.dev_tablephaseid,
      phase._dev_tablevirtualizationprocess_value ?? "",
    ]),
  );
  const roleMap = new Map<string, { count: number; processIds: Set<string> }>();
  for (const activity of processActivities) {
    const role = shortenRoleName(
      activity.dev_tableactivitytemplatename ?? activity.dev_activityname ?? "—",
    );
    const current = roleMap.get(role) ?? { count: 0, processIds: new Set() };
    current.count += 1;
    const processId = processIdByPhase.get(activity._dev_tablephase_value ?? "");
    if (processId) current.processIds.add(processId);
    roleMap.set(role, current);
  }

  const activitiesByRole = Array.from(roleMap.entries())
    .map(([role, stats]) => ({
      role,
      count: stats.count,
      processIds: [...stats.processIds],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const deliverableAgg = buildDeliverableAggregates(deliverables);

  return {
    metrics,
    phaseDistribution,
    processElapsed,
    processElapsedCounts,
    deliverableElapsedCounts: deliverableAgg.elapsedCounts,
    deliverablePhaseElapsed: deliverableAgg.phaseElapsed,
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

const countByElapsedDays = (days: number[]): LeaderStatistics["processElapsedCounts"] => {
  const counts = new Map<number, number>();
  for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([elapsed, count]) => ({ days: elapsed, count }));
};

const buildPhaseElapsed = (
  groups: {
    name: string;
    shortName: string;
    color: string;
    days: number[];
  }[],
): LeaderStatistics["deliverablePhaseElapsed"] =>
  groups
    .filter((group) => group.days.length > 0)
    .map((group) => ({
      name: group.name,
      shortName: group.shortName,
      color: group.color,
      processCount: group.days.length,
      averageDays: Math.round(
        group.days.reduce((sum, value) => sum + value, 0) / group.days.length,
      ),
    }));

const buildDeliverableAggregates = (
  deliverables: StatisticsDeliverableRow[],
): {
  metrics: LeaderStatistics["deliverableMetrics"];
  distribution: LeaderStatistics["deliverableDistribution"];
  facultyDistribution: LeaderStatistics["deliverableFacultyDistribution"];
  phaseElapsed: LeaderStatistics["deliverablePhaseElapsed"];
  elapsedCounts: LeaderStatistics["deliverableElapsedCounts"];
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

  const countByPhase = new Map<string, number>();
  for (const item of deliverables) {
    const key = item.phaseKey || PROCESS_PHASES.UNKNOWN;
    countByPhase.set(key, (countByPhase.get(key) ?? 0) + 1);
  }

  const knownPhaseKeys = new Set<string>(
    PHASE_STATS_CONFIG.map((item) => item.key),
  );
  const distribution = [
    ...PHASE_STATS_CONFIG.map((phase) => ({
      name: phase.key,
      shortName:
        phase.key === PROCESS_PHASES.COMPLETED ? "Completado" : phase.label,
      value: countByPhase.get(phase.key) ?? 0,
      color: phase.color,
    })),
    ...[...countByPhase.entries()]
      .filter(([name]) => !knownPhaseKeys.has(name))
      .map(([name, value]) => ({
        name,
        shortName: name,
        value,
        color: "#6b7280",
      })),
  ].filter((item) => item.value > 0 || knownPhaseKeys.has(item.name));

  const phaseElapsed = buildPhaseElapsed(
    distribution.map((phase) => ({
      name: phase.name,
      shortName: phase.shortName,
      color: phase.color,
      days: deliverables
        .filter((item) => (item.phaseKey || PROCESS_PHASES.UNKNOWN) === phase.name)
        .map((item) => item.elapsedDays),
    })),
  );

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

  return {
    metrics,
    distribution,
    facultyDistribution,
    phaseElapsed,
    elapsedCounts: countByElapsedDays(deliverables.map((item) => item.elapsedDays)),
  };
};
