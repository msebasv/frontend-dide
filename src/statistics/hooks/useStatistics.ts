/**
 * Hook de estadísticas con filtros, alcance por rol y detalle de trazabilidad.
 */
import { useCallback, useMemo, useState } from "react";

import {
  ALL_PERIOD_FILTER,
  buildPeriodOptions,
  type PeriodFilter,
  type PeriodFilterType,
} from "../../global/utils/semesterUtils";
import {
  canonicalizeUserRole,
  isGlobalStatisticsRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import { isAdvisorRole } from "../../courses/mappers/courseMappers";
import {
  applyStatisticsScope,
  buildActiveFiltersLabel,
  buildStatisticsFilterOptions,
  buildStatisticsFromSource,
  buildUserWorkloadStats,
  filterStatisticsSource,
  getStatisticsSource,
  type StatisticsSource,
} from "../services/statisticsService";
import {
  EMPTY_DIMENSION_FILTERS,
  type LeaderStatistics,
  type StatisticsDimensionFilters,
  type StatisticsScope,
  type UserWorkloadStat,
} from "../types/statistics.types";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";

const resolveStatisticsScope = (
  role: string,
  email: string,
): StatisticsScope => {
  const normalizedEmail = email.trim().toLowerCase();

  if (isGlobalStatisticsRole(role)) {
    return { mode: "global", email: normalizedEmail };
  }

  if (isAdvisorRole(role)) {
    return { mode: "advisor", email: normalizedEmail };
  }

  if (canonicalizeUserRole(role) === USER_ROLES.LEADER) {
    return { mode: "leader", email: normalizedEmail };
  }

  return { mode: "global", email: normalizedEmail };
};

export const useStatistics = (userEmail = "", userRole = "") => {
  const [source, setSource] = useState<StatisticsSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodFilter, setPeriodFilterState] =
    useState<PeriodFilter>(ALL_PERIOD_FILTER);
  const [dimensionFilters, setDimensionFilters] =
    useState<StatisticsDimensionFilters>(EMPTY_DIMENSION_FILTERS);

  const scope = useMemo(
    () => resolveStatisticsScope(userRole, userEmail),
    [userRole, userEmail],
  );

  const scopedSource = useMemo(() => {
    if (!source) return null;
    return applyStatisticsScope(source, scope);
  }, [source, scope]);

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStatisticsSource();
      setSource(data);
    } catch (error) {
      console.error("Error cargando estadísticas", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const periodOptions = useMemo(() => {
    if (!scopedSource) return { years: [], semesters: [] };
    return buildPeriodOptions(scopedSource.processes.map((p) => p.semester));
  }, [scopedSource]);

  const filterOptions = useMemo(() => {
    if (!scopedSource) {
      return {
        faculties: [],
        programs: [],
        advisors: [],
        leaders: [],
        statuses: [],
      };
    }
    return buildStatisticsFilterOptions(
      scopedSource.processes,
      dimensionFilters,
    );
  }, [scopedSource, dimensionFilters]);

  const getFilterOptions = useCallback(
    (dimensions: StatisticsDimensionFilters) => {
      if (!scopedSource) {
        return {
          faculties: [],
          programs: [],
          advisors: [],
          leaders: [],
          statuses: [],
        };
      }
      return buildStatisticsFilterOptions(scopedSource.processes, dimensions);
    },
    [scopedSource],
  );

  const setPeriodFilter = useCallback(
    (type: PeriodFilterType, value = "") => {
      if (type === "all") {
        setPeriodFilterState(ALL_PERIOD_FILTER);
        return;
      }

      setPeriodFilterState({ type, value });
    },
    [],
  );

  const clearDimensionFilters = useCallback(() => {
    setDimensionFilters(EMPTY_DIMENSION_FILTERS);
  }, []);

  const toggleStatusFilter = useCallback((status: string) => {
    setDimensionFilters((prev) => {
      const exists = prev.statuses.includes(status);
      return {
        ...prev,
        statuses: exists
          ? prev.statuses.filter((item) => item !== status)
          : [...prev.statuses, status],
      };
    });
  }, []);

  const filteredSource = useMemo(() => {
    if (!scopedSource) return null;
    return filterStatisticsSource(
      scopedSource,
      periodFilter,
      dimensionFilters,
    );
  }, [scopedSource, periodFilter, dimensionFilters]);

  const statistics: LeaderStatistics | null = useMemo(() => {
    if (!scopedSource) return null;
    return buildStatisticsFromSource(
      scopedSource,
      periodFilter,
      dimensionFilters,
    );
  }, [scopedSource, periodFilter, dimensionFilters]);

  const filteredProcesses: VirtualizationProcess[] = useMemo(
    () => filteredSource?.processes ?? [],
    [filteredSource],
  );

  const filteredDeliverables = useMemo(
    () => filteredSource?.deliverables ?? [],
    [filteredSource],
  );

  const userWorkload: UserWorkloadStat[] = useMemo(
    () => buildUserWorkloadStats(filteredProcesses),
    [filteredProcesses],
  );

  const periodSubtitle =
    periodFilter.type === "all"
      ? "Todos los periodos"
      : periodFilter.type === "year"
        ? `Año ${periodFilter.value}`
        : `Semestre ${periodFilter.value}`;

  const filtersLabel = useMemo(
    () =>
      buildActiveFiltersLabel(periodSubtitle, dimensionFilters, filterOptions),
    [periodSubtitle, dimensionFilters, filterOptions],
  );

  const scopeLabel =
    scope.mode === "advisor"
      ? "Solo procesos donde eres asesor"
      : scope.mode === "leader"
        ? "Solo procesos donde eres líder asignado"
        : "Vista global (todas las facultades y programas)";

  return {
    statistics,
    filteredProcesses,
    filteredDeliverables,
    userWorkload,
    loading,
    loadStatistics,
    periodFilter,
    setPeriodFilter,
    periodOptions,
    dimensionFilters,
    setDimensionFilters,
    clearDimensionFilters,
    toggleStatusFilter,
    filterOptions,
    getFilterOptions,
    periodSubtitle,
    filtersLabel,
    scope,
    scopeLabel,
  };
};
