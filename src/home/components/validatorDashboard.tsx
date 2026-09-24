import { Link } from "react-router-dom";
import {
  IoBookOutline,
  IoCheckmarkDoneOutline,
  IoCheckmarkCircleOutline,
  IoListOutline,
  IoTimeOutline,
  IoWarningOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";

import DashboardHero from "../../global/components/dashboardHero";
import StatCard from "../../global/components/statCard";
import RecentList from "../../global/components/recentList";
import Button from "../../global/components/button";
import FormatsFolderButton from "../../global/components/formatsFolderButton";

import type { Course, DashboardMetrics } from "../../courses/types/course.types";
import { PROCESS_PHASES } from "../../global/constants/domainConstants";

interface ValidatorDashboardProps {
  metrics: DashboardMetrics;
  userName: string;
  roleLabel: string;
  courses: Course[];
  /** validate = aprobar/devolver; finalize = cargar enlaces (Diseñador DIDE). */
  mode?: "validate" | "finalize";
}

function ValidatorDashboard({
  metrics,
  userName,
  roleLabel,
  courses,
  mode = "validate",
}: ValidatorDashboardProps) {
  const isDide = mode === "finalize";
  const isAdvisor = roleLabel.toLowerCase().includes("asesor");
  const pendingCourses = courses.filter((c) => {
    if (isDide) return c.canFinalize;
    if (isAdvisor) {
      const guidePending =
        (c.phaseBreakdown?.counts[PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD] ?? 0) >
        0;
      const avPending =
        (c.phaseBreakdown?.counts[PROCESS_PHASES.ADVISOR_AV_APPROVAL] ?? 0) > 0;
      return c.canValidate || (c.canUpload && guidePending) || avPending;
    }
    return c.canValidate || c.canUpload;
  });

  const recentItems = pendingCourses.slice(0, 5).map((c) => {
    const avPending =
      (c.phaseBreakdown?.counts[PROCESS_PHASES.ADVISOR_AV_APPROVAL] ?? 0) > 0;
    const guidePending =
      (c.phaseBreakdown?.counts[PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD] ?? 0) > 0;
    const badge = isDide
      ? "Por registrar enlaces"
      : c.canValidate && avPending
        ? "Aprobar AV DIDE"
        : c.canValidate
          ? "Por validar"
          : guidePending
            ? "Cargar guión"
            : "Pendiente";

    return {
      id: c.processId,
      title: c.processName,
      subtitle: `${c.courseName} · Autor: ${c.authorName}`,
      badge,
      badgeColor: isDide ? "#86c127" : "#004040",
      link: `/courses/${c.processId}`,
      icon: isDide ? (
        <IoCheckmarkCircleOutline size={16} />
      ) : (
        <IoShieldCheckmarkOutline size={16} />
      ),
    };
  });

  const otherItems = courses
    .filter((c) =>
      isDide ? !c.canFinalize : !(c.canValidate || c.canUpload),
    )
    .slice(0, 3)
    .map((c) => ({
      id: c.processId,
      title: c.processName,
      subtitle: c.courseName,
      link: `/courses/${c.processId}`,
      icon: <IoBookOutline size={16} />,
    }));

  return (
    <div className="space-y-6">
      <DashboardHero
        userName={userName}
        role={roleLabel}
        description={
          isDide
            ? "Revise el material, registre los enlaces audiovisuales y confirme el cargue para avanzar. No es posible devolverlo."
            : isAdvisor
              ? "Tienes tres momentos: (1) revisar el material, (2) cargar el guión instruccional y (3) aprobar el material audiovisual DIDE."
              : "Revise el material académico cargado por los autores; apruebe o devuelva con observaciones para garantizar la calidad."
        }
      >
        <Link to="/my-courses">
          <Button size="sm">
            <IoCheckmarkCircleOutline size={16} />
            {isDide ? "Ver cursos" : "Validar cursos"}
          </Button>
        </Link>
        {isAdvisor ? (
          <Link to="/tracking">
            <Button variant="soft" size="sm">
              <IoListOutline size={16} />
              Seguimiento
            </Button>
          </Link>
        ) : null}
        <FormatsFolderButton />
      </DashboardHero>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cursos asignados"
          value={metrics.total}
          icon={<IoBookOutline size={22} />}
          color="primary"
          subtitle="Bajo su supervisión"
        />
        <StatCard
          label={isDide ? "Por cargar" : "Por validar"}
          value={pendingCourses.length}
          icon={<IoWarningOutline size={22} />}
          color="warning"
          subtitle={
            isDide ? "Listos para su cargue" : "Requieren su revisión"
          }
        />
        <StatCard
          label="En progreso"
          value={metrics.inProgress}
          icon={<IoTimeOutline size={22} />}
          color="accent"
          subtitle="En otras fases del proceso"
        />
        <StatCard
          label="Completados"
          value={metrics.completed}
          icon={<IoCheckmarkDoneOutline size={22} />}
          color="success"
          subtitle={isDide ? "Procesos con enlaces cargados" : "Material aprobado"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentList
          title={
            isDide ? "Pendientes de cargue" : "Pendientes de validación"
          }
          items={recentItems}
          viewAllLink="/my-courses"
          viewAllLabel="Ver todos"
          emptyMessage={
            isDide
              ? "No hay cursos pendientes de aprobación"
              : "No hay cursos pendientes de validación"
          }
        />
        <RecentList
          title="Otros cursos asignados"
          items={otherItems}
          viewAllLink="/my-courses"
          emptyMessage="Sin otros cursos asignados"
        />
      </div>

      {pendingCourses.length > 0 && (
        <div className="rounded-[1.5rem] border border-secondary/30 bg-acacia-10/80 p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <IoCheckmarkCircleOutline
              className="mt-0.5 shrink-0 text-secondary"
              size={20}
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-primary">
                {pendingCourses.length} curso
                {pendingCourses.length > 1 ? "s" : ""}{" "}
                {isDide ? "esperan su cargue" : "esperan su validación"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {isDide
                  ? "Revise el material, registre los enlaces audiovisuales y confirme."
                  : "Revise el material y emita su aprobación o devolución con comentarios."}
              </p>
              <Link
                to={`/courses/${pendingCourses[0].processId}`}
                className="mt-3 inline-flex items-center rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {isDide ? "Revisar y cargar →" : "Comenzar validación →"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ValidatorDashboard;
