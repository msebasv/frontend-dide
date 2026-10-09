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

/** Cuántos procesos o entregables llevan exactamente esos días hábiles. */
export interface ElapsedCountStat {
  days: number;
  count: number;
}

/** Días hábiles totales de un proceso, desde su creación. */
export interface ProcessElapsedStat {
  processId: string;
  name: string;
  days: number;
}

/** Promedio de días hábiles de los entregables que están en cada fase. */
export interface PhaseElapsedStat {
  name: string;
  shortName: string;
  averageDays: number;
  processCount: number;
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
  /** YYYY-MM, para abrir el detalle de ese mes. */
  monthKey: string;
  activities: number;
  processes: number;
}

export interface ActivityRoleStat {
  role: string;
  count: number;
  processIds: string[];
}

/** Entregable enriquecido con datos del proceso padre (para tablas y drill). */
export interface StatisticsDeliverableRow {
  id: string;
  name: string;
  creditNumber: number;
  creditLabel: string;
  stateLabel: string;
  /** Fase del flujo (Cargue Autor, Validador, etc.). */
  phaseKey: string;
  /** Días hábiles del entregable, misma regla que el filtro. */
  elapsedDays: number;
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
  processElapsed: ProcessElapsedStat[];
  processElapsedCounts: ElapsedCountStat[];
  deliverableElapsedCounts: ElapsedCountStat[];
  deliverablePhaseElapsed: PhaseElapsedStat[];
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

export type ElapsedDaysFilterMode = "all" | "more" | "less" | "between";

/** Días hábiles: más de, menos de, o entre dos valores. */
export interface ElapsedDaysFilter {
  mode: ElapsedDaysFilterMode;
  from: number;
  to: number;
}

export const EMPTY_ELAPSED_DAYS_FILTER: ElapsedDaysFilter = {
  mode: "all",
  from: 5,
  to: 10,
};

/** Filtros dimensionales (además del periodo académico). */
export interface StatisticsDimensionFilters {
  facultyName: string;
  programName: string;
  advisorEmail: string;
  leaderEmail: string;
  /** Vacío = todos los estados. */
  statuses: string[];
  elapsedDays: ElapsedDaysFilter;
}

export const ALL_DIMENSION_VALUE = "all";

export const EMPTY_DIMENSION_FILTERS: StatisticsDimensionFilters = {
  facultyName: ALL_DIMENSION_VALUE,
  programName: ALL_DIMENSION_VALUE,
  advisorEmail: ALL_DIMENSION_VALUE,
  leaderEmail: ALL_DIMENSION_VALUE,
  statuses: [],
  elapsedDays: EMPTY_ELAPSED_DAYS_FILTER,
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
