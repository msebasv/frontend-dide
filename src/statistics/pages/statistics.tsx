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
  USER_ROLES,
  canonicalizeUserRole,
  isLeaderRole,
} from "../../global/constants/domainConstants";
import { isAdvisorRole } from "../../courses/mappers/courseMappers";
import { COMPLETED_STATUS } from "../constants/phaseConfig";
import { resolveDeliverableStatBucket } from "../constants/deliverableStatsConfig";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import type {
  StatisticsDeliverableRow,
  StatisticsViewMode,
} from "../types/statistics.types";

import { useStatistics } from "../hooks/useStatistics";
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
  | { kind: "status"; status: string; title: string };

type DeliverableDrill =
  | { kind: "all"; title: string }
  | { kind: "pending"; title: string }
  | { kind: "inReview"; title: string }
  | { kind: "approved"; title: string }
  | { kind: "status"; status: string; title: string };

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
          process.status !== "Sin estado" &&
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
      return deliverables.filter(
        (item) =>
          item.stateLabel.toLowerCase() === drill.status.toLowerCase(),
      );
    default:
      return deliverables;
  }
};

const Statistics = () => {
  const { user, currentRole } = useAuth();
  const canAccess =
    isLeaderRole(currentRole) || isAdvisorRole(currentRole);

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
  } = useStatistics(user?.email ?? "", currentRole);

  const [viewMode, setViewMode] = useState<StatisticsViewMode>("process");
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
            ? "Haz clic en una tarjeta para ver los procesos de esa categoría"
            : "Haz clic en una tarjeta para ver los entregables de esa categoría"
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
                      title: `Estado: ${phase.shortName}`,
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
                    title: `Estado: ${phase?.shortName ?? phaseName}`,
                  });
                }}
              />
            </div>
            <CompletionGauge
              rate={metrics.completionRate}
              completed={metrics.completed}
              total={metrics.totalProcesses}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <FacultyBarChart data={statistics.facultyDistribution} />
            <ProgramBarChart data={statistics.programDistribution} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <MonthlyTrendChart data={statistics.monthlyTrend} />
            <ActivityRoleChart data={statistics.activitiesByRole} />
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
              <p className="text-sm font-semibold text-primary">
                Por estado del entregable
              </p>
              <p className="text-xs text-muted">
                Cada entregable avanza de forma independiente dentro del proceso
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {statistics.deliverableDistribution.map((phase) => (
                <button
                  key={phase.name}
                  type="button"
                  onClick={() =>
                    setDeliverableDrill({
                      kind: "status",
                      status: phase.name,
                      title: `Estado: ${phase.shortName}`,
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
                title="Distribución por estado del entregable"
                subtitle="Clic en un estado para ver esos entregables"
                unitLabel="entregable"
                onPhaseClick={(phaseName) => {
                  const phase = statistics.deliverableDistribution.find(
                    (item) => item.name === phaseName,
                  );
                  setDeliverableDrill({
                    kind: "status",
                    status: phaseName,
                    title: `Estado: ${phase?.shortName ?? phaseName}`,
                  });
                }}
              />
            </div>
            <CompletionGauge
              rate={deliverableMetrics.completionRate}
              completed={deliverableMetrics.approved}
              total={deliverableMetrics.totalDeliverables}
              title="Avance de entregables"
              subtitle="Entregables aprobados sobre el total"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <FacultyBarChart
              data={statistics.deliverableFacultyDistribution}
              title="Entregables por facultad"
              subtitle="Comparativa de avance de materiales por unidad académica"
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
              subtitle="Programas con mayor cantidad de entregables"
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
