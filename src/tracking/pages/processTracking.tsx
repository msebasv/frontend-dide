/**
 * Tablero de seguimiento: avance de autor / validador / asesor por proceso.
 * Asesor → solo asignados. Líder / Coordinador / Admin → todos.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import StatCard from "../../global/components/statCard";
import Button from "../../global/components/button";
import ProcessStatusFilterTabs, {
  countByProcessStatusTab,
  filterByProcessStatusTab,
  type ProcessStatusFilterTab,
} from "../../global/components/processStatusFilterTabs";
import { useAuth } from "../../global/hooks/useAuth";
import {
  canCreateProcesses,
  isLeaderRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import { isAdvisorRole } from "../../courses/mappers/courseMappers";
import {
  IoAddCircleOutline,
  IoBookOutline,
  IoCheckmarkDoneOutline,
  IoCloudUploadOutline,
  IoPersonOutline,
  IoWarningOutline,
} from "react-icons/io5";

import { useProcessTracking } from "../hooks/useProcessTracking";
import ProcessTrackingBoard from "../components/processTrackingBoard";

function ProcessTrackingPage() {
  const location = useLocation();
  const { user, currentRole } = useAuth();
  const canAccess =
    isLeaderRole(currentRole) || isAdvisorRole(currentRole);

  const { rows, summary, loading, loadTracking } = useProcessTracking(
    user?.email ?? "",
    currentRole,
  );
  const [activeTab, setActiveTab] = useState<ProcessStatusFilterTab>("all");

  const refreshAt = (location.state as { refreshAt?: number } | null)
    ?.refreshAt;

  useEffect(() => {
    if (canAccess) void loadTracking();
  }, [canAccess, loadTracking, refreshAt]);

  const tabCounts = useMemo(
    () => countByProcessStatusTab(rows, (row) => row.phase),
    [rows],
  );

  const filteredRows = useMemo(
    () => filterByProcessStatusTab(rows, activeTab, (row) => row.phase),
    [rows, activeTab],
  );

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando seguimiento de procesos..." />;
  }

  const isAdvisor = currentRole === USER_ROLES.ADVISOR;
  const description = isAdvisor
    ? "Consulta el avance de cargas y validaciones en los procesos asignados."
    : "Consulta el avance por proceso: despliega General o cada unidad para ver la fase de cada entregable.";

  // Alta de proceso/curso: Coordinador DIDE y Administrador (no el Líder).
  const showCreateActions = canCreateProcesses(currentRole);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguimiento"
        description={description}
        badge={isAdvisor ? "Asesoría" : "Gestión"}
        actions={
          showCreateActions ? (
            <>
              <Link to="/virtualization-processes/create">
                <Button size="sm">
                  <IoAddCircleOutline size={16} />
                  Nuevo Proceso
                </Button>
              </Link>
              <Link to="/virtualization-processes/create-course">
                <Button variant="secondary" size="sm">
                  <IoAddCircleOutline size={16} />
                  Nuevo Curso
                </Button>
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Procesos"
          value={summary.total}
          icon={<IoBookOutline size={22} />}
          color="primary"
          subtitle={isAdvisor ? "Asignados a ti" : "Registrados"}
        />
        <StatCard
          label="Pendientes de autor"
          value={summary.authorPending}
          icon={<IoCloudUploadOutline size={22} />}
          color="warning"
          subtitle="Carga o corrección pendiente"
        />
        <StatCard
          label="Pendientes de validador"
          value={summary.validatorPending}
          icon={<IoPersonOutline size={22} />}
          color="accent"
          subtitle={USER_ROLES.VALIDATOR}
        />
        <StatCard
          label="Pendientes de asesor"
          value={summary.advisorPending}
          icon={<IoWarningOutline size={22} />}
          color="secondary"
          subtitle="Asesoría pedagógica"
        />
        <StatCard
          label="Finalizados"
          value={summary.completed}
          icon={<IoCheckmarkDoneOutline size={22} />}
          color="success"
          subtitle="Procesos finalizados"
        />
      </div>

      <div className="space-y-4">
        <ProcessStatusFilterTabs
          activeTab={activeTab}
          counts={tabCounts}
          onChange={setActiveTab}
        />
        <ProcessTrackingBoard
          rows={filteredRows}
          emptyMessage={
            activeTab === "completed"
              ? "No hay procesos finalizados para mostrar."
              : activeTab === "inProgress"
                ? "No hay procesos en curso para mostrar."
                : "No hay procesos registrados para mostrar."
          }
        />
      </div>
    </div>
  );
}

export default ProcessTrackingPage;
