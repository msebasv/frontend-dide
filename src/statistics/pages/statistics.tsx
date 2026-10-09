/**
 * Página de estadísticas — KPIs clicables abren el detalle.
 * Toggle: Por proceso | Por entregable.
 * Admin / Coordinador DIDE: vista global con filtros.
 * Líder / Asesor: solo procesos asignados.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import clsx from "clsx";
import {
  IoAnalyticsOutline,
  IoBookOutline,
  IoCheckmarkDoneOutline,
  IoDownloadOutline,
  IoFlashOutline,
  IoLayersOutline,
  IoPulseOutline,
  IoTimeOutline,
  IoWarningOutline,
} from "react-icons/io5";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import StatCard from "../../global/components/statCard";
import Button from "../../global/components/button";
import { useAuth } from "../../global/hooks/useAuth";
import {
  PENDING_APPROVAL_PHASES,
  PROCESS_PHASES,
  USER_ROLES,
  canonicalizeUserRole,
  isLeaderRole,
} from "../../global/constants/domainConstants";
import { isAdvisorRole } from "../../courses/mappers/courseMappers";
import { COMPLETED_STATUS } from "../constants/phaseConfig";
import { processElapsedDayCount } from "../../global/utils/colombiaBusinessDays";
import { resolveDeliverableStatBucket } from "../constants/deliverableStatsConfig";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import type {
  StatisticsDeliverableRow,
  StatisticsViewMode,
} from "../types/statistics.types";

import { useStatistics } from "../hooks/useStatistics";
import ElapsedDaysChart from "../components/ElapsedDaysChart";
import PhaseDonutChart from "../components/PhaseDonutChart";
import FacultyBarChart from "../components/FacultyBarChart";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import ProgramBarChart from "../components/ProgramBarChart";
import ActivityRoleChart from "../components/ActivityRoleChart";
import CompletionGauge from "../components/CompletionGauge";
import StatisticsFiltersBar from "../components/StatisticsFiltersBar";
import StatisticsProcessesModal from "../components/StatisticsProcessesModal";
import StatisticsDeliverablesModal from "../components/StatisticsDeliverablesModal";
import { exportStatisticsPdf } from "../utils/exportStatisticsPdf";

type ProcessDrill =
  | { kind: "all"; title: string }
  | { kind: "inProgress"; title: string }
  | { kind: "pendingApproval"; title: string }
  | { kind: "completed"; title: string }
  | { kind: "status"; status: string; title: string }
  | { kind: "faculty"; facultyName: string; title: string }
  | { kind: "program"; programName: string; title: string }
  | { kind: "process"; processId: string; title: string }
  | { kind: "month"; monthKey: string; title: string }
  | { kind: "ids"; processIds: string[]; title: string }
  | { kind: "elapsed"; days: number; title: string };

type DeliverableDrill =
  | { kind: "all"; title: string }
  | { kind: "pending"; title: string }
  | { kind: "inReview"; title: string }
  | { kind: "approved"; title: string }
  | { kind: "status"; status: string; title: string }
  | { kind: "faculty"; facultyName: string; title: string }
  | { kind: "program"; programName: string; title: string }
  | { kind: "elapsed"; days: number; title: string };

const elapsedDayLabel = (days: number): string =>
  days === 1 ? "1 día" : `${days} días`;

const createdMonthKey = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const filterProcessesByDrill = (
  processes: VirtualizationProcess[],
  drill: ProcessDrill,
): VirtualizationProcess[] => {
  switch (drill.kind) {
    case "all":
      return processes;
    case "inProgress":
      return processes.filter(
        (process) =>
          Boolean(process.status) &&
          process.status !== PROCESS_PHASES.UNKNOWN &&
          process.status !== COMPLETED_STATUS,
      );
    case "pendingApproval":
      return processes.filter((process) =>
        (PENDING_APPROVAL_PHASES as readonly string[]).includes(process.status),
      );
    case "completed":
      return processes.filter(
        (process) => process.status === COMPLETED_STATUS,
      );
    case "status":
      return processes.filter((process) => process.status === drill.status);
    case "faculty":
      return processes.filter(
        (process) => (process.facultyName || "Sin facultad") === drill.facultyName,
      );
    case "program":
      return processes.filter(
        (process) => (process.programName || "Sin programa") === drill.programName,
      );
    case "process":
      return processes.filter((process) => process.processId === drill.processId);
    case "month":
      return processes.filter(
        (process) => createdMonthKey(process.createdOn) === drill.monthKey,
      );
    case "ids":
      return processes.filter((process) =>
        drill.processIds.includes(process.processId),
      );
    case "elapsed":
      return processes.filter(
        (process) =>
          processElapsedDayCount(
            process.createdOn,
            process.status === COMPLETED_STATUS ? process.modifiedOn : undefined,
          ) === drill.days,
      );
    default:
      return processes;
  }
};

const filterDeliverablesByDrill = (
  deliverables: StatisticsDeliverableRow[],
  drill: DeliverableDrill,
): StatisticsDeliverableRow[] => {
  switch (drill.kind) {
    case "all":
      return deliverables;
    case "pending":
      return deliverables.filter(
        (item) => resolveDeliverableStatBucket(item.stateLabel) === "pending",
      );
    case "inReview":
      return deliverables.filter(
        (item) => resolveDeliverableStatBucket(item.stateLabel) === "inReview",
      );
    case "approved":
      return deliverables.filter(
        (item) => resolveDeliverableStatBucket(item.stateLabel) === "approved",
      );
    case "status":
      return deliverables.filter((item) => item.phaseKey === drill.status);
    case "faculty":
      return deliverables.filter(
        (item) => (item.facultyName || "Sin facultad") === drill.facultyName,
      );
    case "program":
      return deliverables.filter(
        (item) => (item.programName || "Sin programa") === drill.programName,
      );
    case "elapsed":
      return deliverables.filter((item) => item.elapsedDays === drill.days);
    default:
      return deliverables;
  }
};

const Statistics = () => {
  const { user, currentRole } = useAuth();
  const canAccess =
    isLeaderRole(currentRole) || isAdvisorRole(currentRole);
  const [viewMode, setViewMode] = useState<StatisticsViewMode>("process");

  const {
    statistics,
    filteredProcesses,
    filteredDeliverables,
    loading,
    loadStatistics,
    periodFilter,
    setPeriodFilter,
    periodOptions,
    dimensionFilters,
    setDimensionFilters,
    clearDimensionFilters,
    filterOptions,
    getFilterOptions,
    periodSubtitle,
    filtersLabel,
    scope,
    scopeLabel,
  } = useStatistics(user?.email ?? "", currentRole, viewMode);

  const [exporting, setExporting] = useState(false);
  const [processDrill, setProcessDrill] = useState<ProcessDrill | null>(null);
  const [deliverableDrill, setDeliverableDrill] =
    useState<DeliverableDrill | null>(null);

  useEffect(() => {
    if (canAccess) void loadStatistics();
  }, [canAccess, loadStatistics]);

  useEffect(() => {
    setProcessDrill(null);
    setDeliverableDrill(null);
  }, [viewMode]);

  const drilledProcesses = useMemo(() => {
    if (!processDrill) return [];
    return filterProcessesByDrill(filteredProcesses, processDrill);
  }, [processDrill, filteredProcesses]);

  const drilledDeliverables = useMemo(() => {
    if (!deliverableDrill) return [];
    return filterDeliverablesByDrill(filteredDeliverables, deliverableDrill);
  }, [deliverableDrill, filteredDeliverables]);

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (loading || !statistics) {
    return <LoadingState message="Cargando estadísticas..." />;
  }

  const { metrics, deliverableMetrics } = statistics;
  const detailBasePath =
    canonicalizeUserRole(currentRole) === USER_ROLES.ADVISOR
      ? "course"
      : "process";

  const handleExportPdf = () => {
    try {
      setExporting(true);
      exportStatisticsPdf({
        statistics,
        periodLabel: periodSubtitle,
        filtersLabel: `${scopeLabel} · ${filtersLabel}`,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estadísticas"
        description={
          viewMode === "process"
            ? "Seleccione una tarjeta para ver los procesos de esa categoría"
            : "Seleccione una tarjeta para ver los entregables de esa categoría"
        }
        badge="Analítica"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            <IoDownloadOutline size={16} />
            {exporting ? "Generando PDF..." : "Exportar PDF"}
          </Button>
        }
      />

      <StatisticsFiltersBar
        periodFilter={periodFilter}
        years={periodOptions.years}
        semesters={periodOptions.semesters}
        onPeriodChange={setPeriodFilter}
        dimensionFilters={dimensionFilters}
        options={filterOptions}
        getOptions={getFilterOptions}
        onDimensionsChange={setDimensionFilters}
        onClearDimensions={clearDimensionFilters}
        periodSubtitle={periodSubtitle}
        scopeMode={scope.mode}
        scopeLabel={scopeLabel}
      />

      <div className="inline-flex rounded-full border border-border bg-surface p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setViewMode("process")}
          className={clsx(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition",
            viewMode === "process"
              ? "bg-primary text-white"
              : "text-muted hover:text-primary",
          )}
        >
          Por proceso
        </button>
        <button
          type="button"
          onClick={() => setViewMode("deliverable")}
          className={clsx(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition",
            viewMode === "deliverable"
              ? "bg-primary text-white"
              : "text-muted hover:text-primary",
          )}
        >
          Por entregable
        </button>
      </div>

      {viewMode === "process" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Total procesos"
              value={metrics.totalProcesses}
              icon={<IoBookOutline size={22} />}
              color="primary"
              subtitle={periodSubtitle}
              onClick={() =>
                setProcessDrill({ kind: "all", title: "Todos los procesos" })
              }
            />
            <StatCard
              label="En progreso"
              value={metrics.inProgress}
              icon={<IoTimeOutline size={22} />}
              color="warning"
              subtitle="Activos en alguna fase"
              onClick={() =>
                setProcessDrill({
                  kind: "inProgress",
                  title: "Procesos en progreso",
                })
              }
            />
            <StatCard
              label="Por aprobar"
              value={metrics.pendingApproval}
              icon={<IoWarningOutline size={22} />}
              color="accent"
              subtitle="En revisión de validación"
              onClick={() =>
                setProcessDrill({
                  kind: "pendingApproval",
                  title: "Procesos por aprobar",
                })
              }
            />
            <StatCard
              label="Completados"
              value={metrics.completed}
              icon={<IoCheckmarkDoneOutline size={22} />}
              color="success"
              subtitle={`${metrics.completionRate}% del total`}
              onClick={() =>
                setProcessDrill({
                  kind: "completed",
                  title: "Procesos completados",
                })
              }
            />
            <StatCard
              label="Avance de entregables"
              value={`${deliverableMetrics.completionRate}%`}
              icon={<IoLayersOutline size={22} />}
              color="secondary"
              subtitle={`${deliverableMetrics.approved} de ${deliverableMetrics.totalDeliverables} aprobados`}
              onClick={() => {
                setViewMode("deliverable");
                setDeliverableDrill({
                  kind: "approved",
                  title: "Entregables aprobados",
                });
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Actividades totales"
              value={metrics.totalActivities}
              icon={<IoPulseOutline size={22} />}
              color="secondary"
              subtitle="Registros de actividades"
            />
            <StatCard
              label="Promedio actividades"
              value={metrics.avgActivitiesPerProcess}
              icon={<IoLayersOutline size={22} />}
              color="primary"
              subtitle="Por cada proceso"
            />
            <StatCard
              label="Procesos este mes"
              value={metrics.processesThisMonth}
              icon={<IoAnalyticsOutline size={22} />}
              color="accent"
              subtitle="Creados en el mes actual"
            />
            <StatCard
              label="Actividad este mes"
              value={metrics.activitiesThisMonth}
              icon={<IoFlashOutline size={22} />}
              color="secondary"
              subtitle="Acciones registradas este mes"
            />
          </div>

          <div>
            <div className="mb-3">
              <p className="text-sm font-semibold text-primary">Por estado</p>
              <p className="text-xs text-muted">
                Clic en una fase para ver exactamente qué procesos están ahí
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {statistics.phaseDistribution.map((phase) => (
                <button
                  key={phase.name}
                  type="button"
                  onClick={() =>
                    setProcessDrill({
                      kind: "status",
                      status: phase.name,
                      title: phase.shortName,
                    })
                  }
                  className="rounded-[1.25rem] border border-border bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: phase.color }}
                    />
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
                      {phase.shortName}
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {phase.value}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-primary/55">
                    Ver procesos →
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PhaseDonutChart
                data={statistics.phaseDistribution}
                onPhaseClick={(phaseName) => {
                  const phase = statistics.phaseDistribution.find(
                    (item) => item.name === phaseName,
                  );
                  setProcessDrill({
                    kind: "status",
                    status: phaseName,
                    title: phase?.shortName ?? phaseName,
                  });
                }}
              />
            </div>
            <CompletionGauge
              rate={metrics.completionRate}
              completed={metrics.completed}
              total={metrics.totalProcesses}
              onSelect={() =>
                setProcessDrill({
                  kind: "completed",
                  title: "Procesos completados",
                })
              }
            />
          </div>

          <ElapsedDaysChart
            data={statistics.processElapsedCounts.map((item) => ({
              key: String(item.days),
              label: elapsedDayLabel(item.days),
              count: item.count,
            }))}
            title="Días transcurridos por proceso"
            subtitle="Cantidad de procesos según sus días hábiles totales. Clic para verlos"
            onSelect={(key) => {
              const days = Number(key);
              setProcessDrill({
                kind: "elapsed",
                days,
                title: `Procesos con ${elapsedDayLabel(days)}`,
              });
            }}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <FacultyBarChart
              data={statistics.facultyDistribution}
              subtitle="Clic en una facultad para ver sus procesos"
              onSelect={(facultyName) =>
                setProcessDrill({
                  kind: "faculty",
                  facultyName,
                  title: facultyName,
                })
              }
            />
            <ProgramBarChart
              data={statistics.programDistribution}
              subtitle="Clic en un programa para ver sus procesos"
              onSelect={(programName) =>
                setProcessDrill({
                  kind: "program",
                  programName,
                  title: programName,
                })
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <MonthlyTrendChart
              data={statistics.monthlyTrend}
              onSelect={(monthKey, label) =>
                setProcessDrill({
                  kind: "month",
                  monthKey,
                  title: `Procesos creados en ${label}`,
                })
              }
            />
            <ActivityRoleChart
              data={statistics.activitiesByRole}
              onSelect={(role) => {
                const match = statistics.activitiesByRole.find(
                  (item) => item.role === role,
                );
                setProcessDrill({
                  kind: "ids",
                  processIds: match?.processIds ?? [],
                  title: role,
                });
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total entregables"
              value={deliverableMetrics.totalDeliverables}
              icon={<IoLayersOutline size={22} />}
              color="primary"
              subtitle={periodSubtitle}
              onClick={() =>
                setDeliverableDrill({
                  kind: "all",
                  title: "Todos los entregables",
                })
              }
            />
            <StatCard
              label="Pendientes"
              value={deliverableMetrics.pending}
              icon={<IoTimeOutline size={22} />}
              color="warning"
              subtitle="Sin iniciar o pendientes de carga"
              onClick={() =>
                setDeliverableDrill({
                  kind: "pending",
                  title: "Entregables pendientes",
                })
              }
            />
            <StatCard
              label="En revisión"
              value={deliverableMetrics.inReview}
              icon={<IoWarningOutline size={22} />}
              color="accent"
              subtitle="En etapas de validación o asesoría"
              onClick={() =>
                setDeliverableDrill({
                  kind: "inReview",
                  title: "Entregables en revisión",
                })
              }
            />
            <StatCard
              label="Aprobados"
              value={deliverableMetrics.approved}
              icon={<IoCheckmarkDoneOutline size={22} />}
              color="success"
              subtitle={`${deliverableMetrics.completionRate}% del total`}
              onClick={() =>
                setDeliverableDrill({
                  kind: "approved",
                  title: "Entregables aprobados",
                })
              }
            />
          </div>

          <div>
            <div className="mb-3">
              <p className="text-sm font-semibold text-primary">Por estado</p>
              <p className="text-xs text-muted">
                Clic en una fase para ver los entregables que están ahí
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {statistics.deliverableDistribution.map((phase) => (
                <button
                  key={phase.name}
                  type="button"
                  onClick={() =>
                    setDeliverableDrill({
                      kind: "status",
                      status: phase.name,
                      title: phase.shortName,
                    })
                  }
                  className="rounded-[1.25rem] border border-border bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: phase.color }}
                    />
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
                      {phase.shortName}
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {phase.value}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-primary/55">
                    Ver entregables →
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PhaseDonutChart
                data={statistics.deliverableDistribution}
                title="Distribución por fase"
                subtitle="Clic en una fase para ver esos entregables"
                unitLabel="entregable"
                onPhaseClick={(phaseName) => {
                  const phase = statistics.deliverableDistribution.find(
                    (item) => item.name === phaseName,
                  );
                  setDeliverableDrill({
                    kind: "status",
                    status: phaseName,
                    title: phase?.shortName ?? phaseName,
                  });
                }}
              />
            </div>
            <CompletionGauge
              rate={deliverableMetrics.completionRate}
              completed={deliverableMetrics.approved}
              total={deliverableMetrics.totalDeliverables}
              title="Avance de entregables"
              subtitle="Entregables aprobados sobre el total. Clic para verlos"
              onSelect={() =>
                setDeliverableDrill({
                  kind: "approved",
                  title: "Entregables aprobados",
                })
              }
            />
          </div>

          <ElapsedDaysChart
            data={statistics.deliverableElapsedCounts.map((item) => ({
              key: String(item.days),
              label: elapsedDayLabel(item.days),
              count: item.count,
            }))}
            title="Días transcurridos por entregable"
            unitLabel="entregable"
            subtitle="Cantidad de entregables según sus días hábiles. Clic para verlos"
            onSelect={(key) => {
              const days = Number(key);
              setDeliverableDrill({
                kind: "elapsed",
                days,
                title: `Entregables con ${elapsedDayLabel(days)}`,
              });
            }}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <FacultyBarChart
              data={statistics.deliverableFacultyDistribution}
              title="Entregables por facultad"
              subtitle="Clic en una facultad para ver sus entregables"
              onSelect={(facultyName) =>
                setDeliverableDrill({
                  kind: "faculty",
                  facultyName,
                  title: facultyName,
                })
              }
              completedLabel="Aprobados"
              inProgressLabel="En curso"
            />
            <ProgramBarChart
              data={filteredDeliverables
                .reduce<{ name: string; value: number }[]>((acc, item) => {
                  const name = item.programName || "Sin programa";
                  const found = acc.find((row) => row.name === name);
                  if (found) found.value += 1;
                  else acc.push({ name, value: 1 });
                  return acc;
                }, [])
                .sort((a, b) => b.value - a.value)
                .slice(0, 8)}
              title="Top programas"
              subtitle="Clic en un programa para ver sus entregables"
              onSelect={(programName) =>
                setDeliverableDrill({
                  kind: "program",
                  programName,
                  title: programName,
                })
              }
              unitLabel="entregable"
            />
          </div>
        </>
      )}

      <StatisticsProcessesModal
        isOpen={Boolean(processDrill)}
        onClose={() => setProcessDrill(null)}
        title={
          processDrill
            ? `${processDrill.title} (${drilledProcesses.length})`
            : "Procesos"
        }
        processes={drilledProcesses}
        detailBasePath={detailBasePath}
      />

      <StatisticsDeliverablesModal
        isOpen={Boolean(deliverableDrill)}
        onClose={() => setDeliverableDrill(null)}
        title={
          deliverableDrill
            ? `${deliverableDrill.title} (${drilledDeliverables.length})`
            : "Entregables"
        }
        deliverables={drilledDeliverables}
        detailBasePath={detailBasePath}
      />
    </div>
  );
};

export default Statistics;
