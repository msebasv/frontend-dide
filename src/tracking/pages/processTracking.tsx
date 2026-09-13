/**
 * Tablero de seguimiento: avance de autor / validador / asesor por proceso.
 * Asesor → solo asignados. Líder / Coordinador / Admin → todos.
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import StatCard from "../../global/components/statCard";
import { useAuth } from "../../global/hooks/useAuth";
import {
  isLeaderRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import { isAdvisorRole } from "../../courses/mappers/courseMappers";
import {
  IoBookOutline,
  IoCheckmarkDoneOutline,
  IoCloudUploadOutline,
  IoPersonOutline,
  IoWarningOutline,
} from "react-icons/io5";

import { useProcessTracking } from "../hooks/useProcessTracking";
import ProcessTrackingBoard from "../components/processTrackingBoard";

function ProcessTrackingPage() {
  const { user, currentRole } = useAuth();
  const canAccess =
    isLeaderRole(currentRole) || isAdvisorRole(currentRole);

  const { rows, summary, loading, loadTracking } = useProcessTracking(
    user?.email ?? "",
    currentRole,
  );

  useEffect(() => {
    if (canAccess) void loadTracking();
  }, [canAccess, loadTracking]);

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando seguimiento de procesos..." />;
  }

  const isAdvisor = currentRole === USER_ROLES.ADVISOR;
  const description = isAdvisor
    ? "Consulta el avance de cargas y validaciones en los procesos asignados."
    : "Consulta el avance por proceso: despliega General o cada crédito para ver la fase de cada entregable.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguimiento"
        description={description}
        badge={isAdvisor ? "Asesoría" : "Gestión"}
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
          subtitle="Validador disciplinar"
        />
        <StatCard
          label="Pendientes de asesor"
          value={summary.advisorPending}
          icon={<IoWarningOutline size={22} />}
          color="secondary"
          subtitle="Asesoría pedagógica"
        />
        <StatCard
          label="Completados"
          value={summary.completed}
          icon={<IoCheckmarkDoneOutline size={22} />}
          color="success"
          subtitle="Procesos finalizados"
        />
      </div>

      <ProcessTrackingBoard rows={rows} />
    </div>
  );
}

export default ProcessTrackingPage;
