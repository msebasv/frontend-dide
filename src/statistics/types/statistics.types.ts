/**
 * Tipos del módulo de estadísticas (líder de virtualización).
 */

import type { PeriodFilter } from "../../global/utils/semesterUtils";

export type StatisticsViewMode = "process" | "deliverable";

export interface StatisticsMetrics {
  totalProcesses: number;
  inProgress: number;
  pendingApproval: number;
  completed: number;
  completionRate: number;
  totalActivities: number;
  avgActivitiesPerProcess: number;
  processesThisMonth: number;
  activitiesThisMonth: number;
}

/** KPIs agregados a nivel entregable (independientes del estado del proceso). */
export interface DeliverableStatisticsMetrics {
  totalDeliverables: number;
  pending: number;
  inReview: number;
  approved: number;
  /** Aprobados / total × 100. */
  completionRate: number;
}

export interface PhaseStat {
  name: string;
  shortName: string;
  value: number;
  color: string;
}

export interface FacultyStat {
  name: string;
  total: number;
  completed: number;
  inProgress: number;
}

export interface ProgramStat {
  name: string;
  value: number;
}

export interface MonthlyTrend {
  month: string;
  activities: number;
  processes: number;
}

export interface ActivityRoleStat {
  role: string;
  count: number;
}

/** Entregable enriquecido con datos del proceso padre (para tablas y drill). */
export interface StatisticsDeliverableRow {
  id: string;
  name: string;
  creditNumber: number;
  creditLabel: string;
  stateLabel: string;
  processId: string;
  processName: string;
  courseName: string;
  facultyName: string;
  programName: string;
  modifiedOn: string;
}

/** Payload completo para la página de estadísticas. */
export interface LeaderStatistics {
  metrics: StatisticsMetrics;
  phaseDistribution: PhaseStat[];
  facultyDistribution: FacultyStat[];
  programDistribution: ProgramStat[];
  monthlyTrend: MonthlyTrend[];
  activitiesByRole: ActivityRoleStat[];
  deliverableMetrics: DeliverableStatisticsMetrics;
  deliverableDistribution: PhaseStat[];
  deliverableFacultyDistribution: FacultyStat[];
}

/** Carga de trabajo de un usuario en los procesos filtrados. */
export interface UserWorkloadStat {
  email: string;
  label: string;
  role: string;
  total: number;
  /** Conteos por etiqueta corta de fase. */
  byPhase: Record<string, number>;
}

/** Alcance de datos según el rol del usuario. */
export type StatisticsScopeMode = "global" | "leader" | "advisor";

export interface StatisticsScope {
  mode: StatisticsScopeMode;
  email: string;
}

/** Filtros dimensionales (además del periodo académico). */
export interface StatisticsDimensionFilters {
  facultyName: string;
  programName: string;
  advisorEmail: string;
  leaderEmail: string;
  /** Vacío = todos los estados. */
  statuses: string[];
}

export const ALL_DIMENSION_VALUE = "all";

export const EMPTY_DIMENSION_FILTERS: StatisticsDimensionFilters = {
  facultyName: ALL_DIMENSION_VALUE,
  programName: ALL_DIMENSION_VALUE,
  advisorEmail: ALL_DIMENSION_VALUE,
  leaderEmail: ALL_DIMENSION_VALUE,
  statuses: [],
};

export interface StatisticsFilterState {
  period: PeriodFilter;
  dimensions: StatisticsDimensionFilters;
}

export interface StatisticsFilterOption {
  value: string;
  label: string;
}

export interface StatisticsFilterOptions {
  faculties: StatisticsFilterOption[];
  programs: StatisticsFilterOption[];
  advisors: StatisticsFilterOption[];
  leaders: StatisticsFilterOption[];
  statuses: StatisticsFilterOption[];
}
