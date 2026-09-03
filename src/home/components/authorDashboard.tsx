import { Link } from "react-router-dom";
import {
  IoBookOutline,
  IoCheckmarkDoneOutline,
  IoCloudUploadOutline,
  IoTimeOutline,
  IoWarningOutline,
  IoDocumentTextOutline,
} from "react-icons/io5";

import DashboardHero from "../../global/components/dashboardHero";
import StatCard from "../../global/components/statCard";
import RecentList from "../../global/components/recentList";
import PhaseDistribution from "../../global/components/phaseDistribution";
import Button from "../../global/components/button";
import FormatsFolderButton from "../../global/components/formatsFolderButton";

import { processStatusColors } from "../../processVirtualization/constants/processStatusStyles";
import type { Course, DashboardMetrics } from "../../courses/types/course.types";
import { formatDomainLabel } from "../../global/utils/textUtils";

interface AuthorDashboardProps {
  metrics: DashboardMetrics;
  userName: string;
  courses: Course[];
}

function AuthorDashboard({ metrics, userName, courses }: AuthorDashboardProps) {
  const pendingUpload = courses.filter((c) => c.canUpload);
  const completionRate =
    metrics.total > 0
      ? Math.round((metrics.completed / metrics.total) * 100)
      : 0;

  const phaseItems = [
    {
      label: "Pendiente de carga",
      count: pendingUpload.length,
      color: "#d97706",
    },
    {
      label: "En revisión",
      count: metrics.pendingApproval,
      color: "#004040",
    },
    {
      label: "Completados",
      count: metrics.completed,
      color: "#86c127",
    },
  ];

  const recentItems = courses.slice(0, 5).map((c) => ({
    id: c.processId,
    title: c.courseName,
    subtitle: c.processName,
    badge: c.canUpload ? "Cargar" : formatDomainLabel(c.status.slice(0, 28)),
    badgeColor: c.canUpload
      ? "#d97706"
      : processStatusColors[c.status] ??
        Object.entries(processStatusColors).find(
          ([key]) => key.toLowerCase() === c.status.toLowerCase(),
        )?.[1],
    link: c.canUpload
      ? `/courses/${c.processId}/upload`
      : `/courses/${c.processId}`,
    icon: <IoDocumentTextOutline size={16} />,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        userName={userName}
        role="Autor de Asignatura"
        description="Carga y gestiona el material académico de tus cursos asignados para el proceso de virtualización."
      >
        <Link to="/my-courses">
          <Button size="sm">
            <IoCloudUploadOutline size={16} />
            Mis cursos
          </Button>
        </Link>
        <FormatsFolderButton />
      </DashboardHero>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cursos asignados"
          value={metrics.total}
          icon={<IoBookOutline size={22} />}
          color="primary"
          subtitle="Bajo tu responsabilidad"
        />
        <StatCard
          label="Por cargar"
          value={pendingUpload.length}
          icon={<IoCloudUploadOutline size={22} />}
          color="warning"
          subtitle="Requieren material académico"
        />
        <StatCard
          label="En revisión"
          value={metrics.pendingApproval}
          icon={<IoTimeOutline size={22} />}
          color="accent"
          subtitle="En manos de validadores"
        />
        <StatCard
          label="Completados"
          value={metrics.completed}
          icon={<IoCheckmarkDoneOutline size={22} />}
          color="success"
          subtitle={`${completionRate}% de avance total`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <PhaseDistribution
            title="Estado de mis cursos"
            items={phaseItems}
            total={metrics.total}
          />
        </div>

        <div className="lg:col-span-3">
          <RecentList
            title="Actividad reciente"
            items={recentItems}
            viewAllLink="/my-courses"
            viewAllLabel="Ver todos"
            emptyMessage="No tienes cursos asignados aún"
          />
        </div>
      </div>

      {pendingUpload.length > 0 && (
        <div className="rounded-[1.5rem] border border-warning/25 bg-amber-50/70 p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <IoWarningOutline className="mt-0.5 shrink-0 text-warning" size={20} />
            <div className="flex-1">
              <p className="text-sm font-bold text-primary">
                Tienes {pendingUpload.length} curso
                {pendingUpload.length > 1 ? "s" : ""} pendiente
                {pendingUpload.length > 1 ? "s" : ""} de carga
              </p>
              <p className="mt-1 text-xs text-muted">
                Sube el material académico para continuar el proceso de
                virtualización.
              </p>
              <Link
                to={`/courses/${pendingUpload[0].processId}/upload`}
                className="mt-3 inline-flex items-center rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-secondary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
              >
                Ir a cargar material →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthorDashboard;
