import { Link } from "react-router-dom";
import {
  IoAddCircleOutline,
  IoBookOutline,
  IoCheckmarkDoneOutline,
  IoIdCardOutline,
  IoListOutline,
  IoTimeOutline,
  IoWarningOutline,
  IoLayersOutline,
} from "react-icons/io5";

import DashboardHero from "../../global/components/dashboardHero";
import StatCard from "../../global/components/statCard";
import PhaseDistribution from "../../global/components/phaseDistribution";
import RecentList from "../../global/components/recentList";
import Button from "../../global/components/button";
import FormatsFolderButton from "../../global/components/formatsFolderButton";
import VideoTutorialsButton from "../../global/components/videoTutorialsButton";

import { processStatusColors } from "../../processVirtualization/constants/processStatusStyles";
import type { DashboardMetrics } from "../../courses/types/course.types";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import {
  PHASE_DISTRIBUTION_ORDER,
  PHASE_SHORT_LABELS,
  USER_ROLES,
  isVirtualizationLeaderRole,
} from "../../global/constants/domainConstants";

interface LeaderDashboardProps {
  metrics: DashboardMetrics;
  userName: string;
  processes: VirtualizationProcess[];
  roleLabel?: string;
  /** false para Coordinador Diseñador (solo ver / asignar diseñador). */
  canManageProcesses?: boolean;
}

function LeaderDashboard({
  metrics,
  userName,
  processes,
  roleLabel = "Líder de Virtualización",
  canManageProcesses = true,
}: LeaderDashboardProps) {
  const completionRate =
    metrics.total > 0
      ? Math.round((metrics.completed / metrics.total) * 100)
      : 0;

  const phaseItems = PHASE_DISTRIBUTION_ORDER.map((label) => ({
    label: PHASE_SHORT_LABELS[label] ?? label,
    count: processes.filter((p) => p.status === label).length,
    color: processStatusColors[label] ?? "#64748b",
  }));

  // Sin estado: el detalle del proceso es el que muestra la fase real.
  const recentItems = processes.slice(0, 5).map((p) => ({
    id: p.processId,
    title: p.processName,
    subtitle: `${p.courseName} · ${p.facultyName}`,
    link: `/virtualization-processes/${p.processId}`,
    icon: <IoLayersOutline size={16} />,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        userName={userName}
        role={roleLabel}
        description={
          isVirtualizationLeaderRole(roleLabel)
            ? "Supervise el avance de los procesos en los que está asignado como líder de virtualización."
            : canManageProcesses
              ? "Supervise el avance de todos los procesos, asigne roles y gestione la virtualización de asignaturas de la Universidad El Bosque."
              : "Consulte el avance de los procesos y asigne el Diseñador DIDE cuando corresponda la carga del guión instruccional."
        }
      >
        {canManageProcesses && (
          <>
            <Link to="/virtualization-processes/create">
              <Button size="sm">
                <IoAddCircleOutline size={16} />
                Nuevo Proceso
              </Button>
            </Link>
            <Link to="/virtualization-processes/create-course">
              <Button variant="soft" size="sm">
                <IoAddCircleOutline size={16} />
                Nuevo Curso
              </Button>
            </Link>
          </>
        )}
        <Link to="/tracking">
          <Button variant="soft" size="sm">
            <IoListOutline size={16} />
            Seguimiento
          </Button>
        </Link>
        {roleLabel === USER_ROLES.ADMIN && (
          <>
            <Link to="/admin/people">
              <Button variant="soft" size="sm">
                <IoIdCardOutline size={16} />
                Personas
              </Button>
            </Link>
            <Link to="/admin/programs">
              <Button variant="soft" size="sm">
                <IoAddCircleOutline size={16} />
                Nuevo programa
              </Button>
            </Link>
            <Link to="/admin/leader-users">
              <Button variant="soft" size="sm">
                <IoAddCircleOutline size={16} />
                Usuarios líderes
              </Button>
            </Link>
          </>
        )}
        <FormatsFolderButton />
        <VideoTutorialsButton />
      </DashboardHero>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total procesos"
          value={metrics.total}
          icon={<IoBookOutline size={22} />}
          color="primary"
          subtitle="Procesos activos en el sistema"
        />
        <StatCard
          label="En progreso"
          value={metrics.inProgress}
          icon={<IoTimeOutline size={22} />}
          color="warning"
          subtitle="En alguna fase de virtualización"
        />
        <StatCard
          label="Por aprobar"
          value={metrics.pendingApproval}
          icon={<IoWarningOutline size={22} />}
          color="accent"
          subtitle="Esperando validación"
        />
        <StatCard
          label="Completados"
          value={metrics.completed}
          icon={<IoCheckmarkDoneOutline size={22} />}
          color="success"
          subtitle={`${completionRate}% tasa de finalización`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <PhaseDistribution
            title="Distribución por fase"
            items={phaseItems}
            total={metrics.total}
          />
        </div>

        <div className="lg:col-span-3">
          <RecentList
            title="Procesos recientes"
            items={recentItems}
            viewAllLink="/virtualization-processes"
            viewAllLabel="Ver todos"
            emptyMessage="No hay procesos creados"
          />
        </div>
      </div>

    </div>
  );
}

export default LeaderDashboard;
