/**
 * Servicio de estadísticas — lectura y agregación para el líder de virtualización.
 */
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitiesService } from "../../generated/services/Dev_tableactivitiesService";
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import type { Dev_tableactivities } from "../../generated/models/Dev_tableactivitiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import { mapVirtualizationProcesses } from "../../processVirtualization/mappers/processMappers";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import {
  matchesPeriodFilter,
  type PeriodFilter,
} from "../../global/utils/semesterUtils";
import {
  PHASE_SHORT_LABELS,
  PROCESS_PHASES,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { buildLeaderStatistics } from "../mappers/statisticsMappers";
import type {
  LeaderStatistics,
  StatisticsDimensionFilters,
  StatisticsFilterOption,
  StatisticsFilterOptions,
  StatisticsScope,
  UserWorkloadStat,
} from "../types/statistics.types";
import {
  ALL_DIMENSION_VALUE,
  EMPTY_DIMENSION_FILTERS,
} from "../types/statistics.types";

export interface StatisticsSource {
  processes: VirtualizationProcess[];
  rawProcesses: Dev_tablevirtualizationprocesses[];
  activities: Dev_tableactivities[];
  phases: Dev_tablephases[];
}

const STATUS_FILTER_ORDER = [
  PROCESS_PHASES.AUTHOR_UPLOAD,
  PROCESS_PHASES.VALIDATOR_REVIEW,
  PROCESS_PHASES.ADVISOR_REVIEW,
  PROCESS_PHASES.DIDE_REVIEW,
  PROCESS_PHASES.COMPLETED,
] as const;

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );

export const getStatisticsSource = async (): Promise<StatisticsSource> => {
  const [
    processesResult,
    coursesResult,
    programsResult,
    facultiesResult,
    phasesResult,
    activitiesResult,
    assignRolesResult,
  ] = await Promise.all([
    Dev_tablevirtualizationprocessesService.getAll(),
    Dev_tablecourseinstancesService.getAll(),
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
    Dev_tablephasesService.getAll(),
    Dev_tableactivitiesService.getAll(),
    Dev_tableassignrolesService.getAll(),
  ]);

  const rawProcesses = processesResult.data ?? [];
  const phases = phasesResult.data ?? [];
  const activities = activitiesResult.data ?? [];

  const processes = mapVirtualizationProcesses({
    processes: rawProcesses,
    courses: coursesResult.data ?? [],
    programs: programsResult.data ?? [],
    faculties: facultiesResult.data ?? [],
    phases,
    activities,
    assignRoles: assignRolesResult.data ?? [],
  });

  return { processes, rawProcesses, activities, phases };
};

/** Limita el universo de procesos según el rol (asignados vs global). */
export const applyStatisticsScope = (
  source: StatisticsSource,
  scope: StatisticsScope | null,
): StatisticsSource => {
  if (!scope || scope.mode === "global" || !scope.email.trim()) {
    return source;
  }

  const email = scope.email.trim().toLowerCase();
  const processes = source.processes.filter((process) => {
    if (scope.mode === "advisor") {
      return process.advisorEmail.toLowerCase() === email;
    }
    if (scope.mode === "leader") {
      return process.leaderEmail.toLowerCase() === email;
    }
    return true;
  });

  const processIds = new Set(processes.map((p) => p.processId));
  const rawProcesses = source.rawProcesses.filter((process) =>
    processIds.has(process.dev_tablevirtualizationprocessid),
  );
  const phases = source.phases.filter((phase) =>
    processIds.has(phase._dev_tablevirtualizationprocess_value ?? ""),
  );
  const phaseIds = new Set(phases.map((phase) => phase.dev_tablephaseid));
  const activities = source.activities.filter((activity) =>
    phaseIds.has(activity._dev_tablephase_value ?? ""),
  );

  return { processes, rawProcesses, phases, activities };
};

const matchesDimensionFilters = (
  process: VirtualizationProcess,
  dimensions: StatisticsDimensionFilters,
): boolean => {
  if (
    dimensions.facultyName !== ALL_DIMENSION_VALUE &&
    process.facultyName !== dimensions.facultyName
  ) {
    return false;
  }

  if (
    dimensions.programName !== ALL_DIMENSION_VALUE &&
    process.programName !== dimensions.programName
  ) {
    return false;
  }

  if (
    dimensions.advisorEmail !== ALL_DIMENSION_VALUE &&
    process.advisorEmail !== dimensions.advisorEmail
  ) {
    return false;
  }

  if (
    dimensions.leaderEmail !== ALL_DIMENSION_VALUE &&
    process.leaderEmail !== dimensions.leaderEmail
  ) {
    return false;
  }

  if (
    dimensions.statuses.length > 0 &&
    !dimensions.statuses.includes(process.status)
  ) {
    return false;
  }

  return true;
};

export const filterStatisticsSource = (
  source: StatisticsSource,
  periodFilter: PeriodFilter,
  dimensions: StatisticsDimensionFilters = EMPTY_DIMENSION_FILTERS,
): StatisticsSource => {
  const filteredProcesses = source.processes.filter((process) => {
    if (
      periodFilter.type !== "all" &&
      periodFilter.value &&
      !matchesPeriodFilter(process.semester, periodFilter)
    ) {
      return false;
    }

    return matchesDimensionFilters(process, dimensions);
  });

  const processIds = new Set(filteredProcesses.map((p) => p.processId));

  const rawProcesses = source.rawProcesses.filter((process) =>
    processIds.has(process.dev_tablevirtualizationprocessid),
  );
  const phases = source.phases.filter((phase) =>
    processIds.has(phase._dev_tablevirtualizationprocess_value ?? ""),
  );
  const phaseIds = new Set(phases.map((phase) => phase.dev_tablephaseid));
  const activities = source.activities.filter((activity) =>
    phaseIds.has(activity._dev_tablephase_value ?? ""),
  );

  return {
    processes: filteredProcesses,
    rawProcesses,
    phases,
    activities,
  };
};

export const buildStatisticsFilterOptions = (
  processes: VirtualizationProcess[],
  dimensions: StatisticsDimensionFilters,
): StatisticsFilterOptions => {
  const facultyScoped = processes.filter(
    (process) =>
      dimensions.facultyName === ALL_DIMENSION_VALUE ||
      process.facultyName === dimensions.facultyName,
  );

  const faculties = uniqueSorted(
    processes.map((process) => process.facultyName),
  ).map((value) => ({ value, label: value }));

  const programs = uniqueSorted(
    facultyScoped.map((process) => process.programName),
  ).map((value) => ({ value, label: value }));

  const advisorsMap = new Map<string, string>();
  for (const process of processes) {
    if (!process.advisorEmail) continue;
    advisorsMap.set(
      process.advisorEmail,
      process.advisorLabel || process.advisorEmail,
    );
  }
  const advisors: StatisticsFilterOption[] = [...advisorsMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  const leadersMap = new Map<string, string>();
  for (const process of processes) {
    if (!process.leaderEmail) continue;
    leadersMap.set(
      process.leaderEmail,
      process.leaderLabel || process.leaderEmail,
    );
  }
  const leaders: StatisticsFilterOption[] = [...leadersMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  const presentStatuses = new Set(
    processes.map((process) => process.status).filter(Boolean),
  );
  const statuses: StatisticsFilterOption[] = [
    ...STATUS_FILTER_ORDER.filter((status) => presentStatuses.has(status)),
    ...[...presentStatuses]
      .filter(
        (status) =>
          !(STATUS_FILTER_ORDER as readonly string[]).includes(status),
      )
      .sort((a, b) => a.localeCompare(b, "es")),
  ].map((value) => ({
    value,
    label: PHASE_SHORT_LABELS[value] ?? formatDomainLabel(value),
  }));

  return { faculties, programs, advisors, leaders, statuses };
};

export const buildStatisticsFromSource = (
  source: StatisticsSource,
  periodFilter: PeriodFilter = { type: "all", value: "" },
  dimensions: StatisticsDimensionFilters = EMPTY_DIMENSION_FILTERS,
): LeaderStatistics => {
  const filtered = filterStatisticsSource(source, periodFilter, dimensions);
  return buildLeaderStatistics(
    filtered.processes,
    filtered.rawProcesses,
    filtered.activities,
    filtered.phases,
  );
};

/**
 * Agrega carga por actor (autor / validador / asesor / líder) sobre procesos
 * ya filtrados: cuántos tienen en cada fase actual.
 */
export const buildUserWorkloadStats = (
  processes: VirtualizationProcess[],
): UserWorkloadStat[] => {
  type Acc = {
    email: string;
    label: string;
    role: string;
    byPhase: Record<string, number>;
    total: number;
  };

  const map = new Map<string, Acc>();

  const bump = (
    email: string,
    label: string,
    role: string,
    status: string,
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    const phaseKey =
      PHASE_SHORT_LABELS[status] ?? formatDomainLabel(status || "Sin estado");
    const key = `${role}::${normalizedEmail}`;
    const current = map.get(key) ?? {
      email: normalizedEmail,
      label: label.trim() || normalizedEmail,
      role,
      byPhase: {},
      total: 0,
    };

    current.byPhase[phaseKey] = (current.byPhase[phaseKey] ?? 0) + 1;
    current.total += 1;
    map.set(key, current);
  };

  for (const process of processes) {
    bump(
      process.authorEmail,
      process.authorLabel,
      USER_ROLES.AUTHOR,
      process.status,
    );
    bump(
      process.validatorEmail,
      process.validatorLabel,
      USER_ROLES.VALIDATOR,
      process.status,
    );
    bump(
      process.advisorEmail,
      process.advisorLabel,
      USER_ROLES.ADVISOR,
      process.status,
    );
    bump(
      process.leaderEmail,
      process.leaderLabel,
      USER_ROLES.LEADER,
      process.status,
    );
  }

  return [...map.values()]
    .map((item) => ({
      email: item.email,
      label: item.label,
      role: item.role,
      total: item.total,
      byPhase: item.byPhase,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
};

export const buildActiveFiltersLabel = (
  periodLabel: string,
  dimensions: StatisticsDimensionFilters,
  options: StatisticsFilterOptions,
): string => {
  const parts = [periodLabel];

  if (dimensions.facultyName !== ALL_DIMENSION_VALUE) {
    parts.push(`Facultad: ${dimensions.facultyName}`);
  }
  if (dimensions.programName !== ALL_DIMENSION_VALUE) {
    parts.push(`Programa: ${dimensions.programName}`);
  }
  if (dimensions.advisorEmail !== ALL_DIMENSION_VALUE) {
    const advisor =
      options.advisors.find((item) => item.value === dimensions.advisorEmail)
        ?.label ?? dimensions.advisorEmail;
    parts.push(`Asesor: ${advisor}`);
  }
  if (dimensions.leaderEmail !== ALL_DIMENSION_VALUE) {
    const leader =
      options.leaders.find((item) => item.value === dimensions.leaderEmail)
        ?.label ?? dimensions.leaderEmail;
    parts.push(`Líder: ${leader}`);
  }
  if (dimensions.statuses.length > 0) {
    const statusLabels = dimensions.statuses.map(
      (status) =>
        options.statuses.find((item) => item.value === status)?.label ??
        formatDomainLabel(status),
    );
    parts.push(`Estados: ${statusLabels.join(", ")}`);
  }

  return parts.join(" · ");
};

/** @deprecated Prefer getStatisticsSource + buildStatisticsFromSource */
export const getLeaderStatistics = async (): Promise<LeaderStatistics> => {
  const source = await getStatisticsSource();
  return buildStatisticsFromSource(source);
};
