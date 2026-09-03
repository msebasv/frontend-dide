/**
 * Página de inicio — dashboard dinámico según el rol activo.
 *
 * Cada rol tiene su propio componente de dashboard con métricas y accesos rápidos.
 * Los datos se cargan solo para el rol que corresponde (evita llamadas innecesarias).
 */
import { useEffect } from "react";

import { useAuth } from "../../global/hooks/useAuth";
import LoadingState from "../../global/components/loadingState";
import {
  isLeaderRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";

import { useCourses } from "../../courses/hooks/useCourses";
import { useVirtualizationProcesses } from "../../processVirtualization/hooks/useVirtualizationProcess";
import { computeLeaderMetrics } from "../../courses/mappers/courseMappers";

import LeaderDashboard from "../components/leaderDashboard";
import AuthorDashboard from "../components/authorDashboard";
import ValidatorDashboard from "../components/validatorDashboard";

function Home() {
  const { user, currentRole } = useAuth();
  const { courses, metrics, loading: coursesLoading, loadCourses } = useCourses(
    user?.email ?? "",
    currentRole,
  );
  const {
    processes,
    loading: processesLoading,
    loadProcesses,
  } = useVirtualizationProcesses();

  const leaderView = isLeaderRole(currentRole);

  useEffect(() => {
    if (leaderView) {
      void loadProcesses();
    } else if (
      currentRole === USER_ROLES.AUTHOR ||
      currentRole === USER_ROLES.VALIDATOR ||
      currentRole === USER_ROLES.ADVISOR ||
      currentRole === USER_ROLES.DIDE_DESIGNER
    ) {
      void loadCourses();
    }
  }, [currentRole, leaderView, loadCourses, loadProcesses]);

  const loading = leaderView ? processesLoading : coursesLoading;

  if (loading) {
    return <LoadingState message="Cargando panel de inicio..." />;
  }

  const userName = user?.name?.split(" ")[0] ?? "Usuario";

  if (isLeaderRole(currentRole)) {
    const roleLabel =
      currentRole === USER_ROLES.ADMIN
        ? "Administrador"
        : currentRole === USER_ROLES.DIDE_COORDINATOR
          ? "Coordinador DIDE"
          : "Líder de Virtualización";

    return (
      <LeaderDashboard
        metrics={computeLeaderMetrics(processes)}
        userName={userName}
        processes={processes}
        roleLabel={roleLabel}
      />
    );
  }

  switch (currentRole) {
    case USER_ROLES.AUTHOR:
      return (
        <AuthorDashboard
          metrics={metrics}
          userName={userName}
          courses={courses}
        />
      );
    case USER_ROLES.VALIDATOR:
      return (
        <ValidatorDashboard
          metrics={metrics}
          userName={userName}
          roleLabel="Validador disciplinar"
          courses={courses}
        />
      );
    case USER_ROLES.ADVISOR:
      return (
        <ValidatorDashboard
          metrics={metrics}
          userName={userName}
          roleLabel="Asesor Pedagógico"
          courses={courses}
        />
      );
    case USER_ROLES.DIDE_DESIGNER:
      return (
        <ValidatorDashboard
          metrics={metrics}
          userName={userName}
          roleLabel="Diseñador DIDE"
          courses={courses}
          mode="finalize"
        />
      );
    default:
      return (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-bold text-primary">
            Bienvenido, {userName}
          </h1>
          <p className="mt-2 text-muted">
            Selecciona una opción del menú lateral para comenzar.
          </p>
        </div>
      );
  }
}

export default Home;
