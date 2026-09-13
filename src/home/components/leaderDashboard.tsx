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
import ProgressBar from "../../global/components/progressBar";

import { processStatusColors } from "../../processVirtualization/constants/processStatusStyles";
import type { DashboardMetrics } from "../../courses/types/course.types";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import {
  PHASE_DISTRIBUTION_ORDER,
  PHASE_SHORT_LABELS,
} from "../../global/constants/domainConstants";
import { formatDomainLabel } from "../../global/utils/textUtils";

interface LeaderDashboardProps {
  metrics: DashboardMetrics;
  userName: string;
  processes: VirtualizationProcess[];
  roleLabel?: string;
}

function LeaderDashboard({
  metrics,
  userName,
  processes,
  roleLabel = "Líder de Virtualización",
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

  const recentItems = processes.slice(0, 5).map((p) => ({
    id: p.processId,
    title: p.processName,
    subtitle: `${p.courseName} · ${p.facultyName}`,
    badge: formatDomainLabel(
      p.status.replace(/revisión y aprobación /i, "").slice(0, 28),
    ),
    badgeColor:
      processStatusColors[p.status] ??
      Object.entries(processStatusColors).find(
        ([key]) => key.toLowerCase() === p.status.toLowerCase(),
      )?.[1],
    link: `/virtualization-processes/${p.processId}`,
    icon: <IoLayersOutline size={16} />,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        userName={userName}
        role={roleLabel}
        description="Supervisa el avance de todos los procesos, asigna roles y gestiona la virtualización de asignaturas de la Universidad El Bosque."
      >
        <Link to="/virtualization-processes/create">
          <Button size="sm">
            <IoAddCircleOutline size={16} />
            Nuevo proceso
          </Button>
        </Link>
        <Link to="/virtualization-processes/create-course">
          <Button variant="soft" size="sm">
            <IoAddCircleOutline size={16} />
            Nuevo curso
          </Button>
        </Link>
        <Link to="/tracking">
          <Button variant="soft" size="sm">
            <IoListOutline size={16} />
            Seguimiento
          </Button>
        </Link>
        {roleLabel === "Administrador" && (
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
            emptyMessage="Aún no hay procesos creados"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.25rem] border border-border bg-acacia-5 p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">Acceso rápido</p>
            <p className="text-xs text-muted">
              Gestiona procesos, consulta estadísticas y el seguimiento
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/virtualization-processes">
              <Button size="sm">Ver procesos</Button>
            </Link>
            <Link to="/statistics">
              <Button variant="secondary" size="sm">
                Estadísticas
              </Button>
            </Link>
            <Link to="/tracking">
              <Button variant="outline" size="sm">
                Seguimiento
              </Button>
            </Link>
          </div>
        </div>
        {metrics.total > 0 && (
          <div className="mt-4">
            <ProgressBar value={completionRate} label="Progreso" />
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderDashboard;
