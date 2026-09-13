/**
 * Estado simple en "Mis cursos": solo cuántos materiales te tocan,
 * y cuántos van en otras etapas. El detalle vive dentro del proceso.
 */
import { PROCESS_PHASES } from "../../global/constants/domainConstants";
import type { CoursePhaseBreakdown } from "../types/course.types";
import {
  isAdvisorRole,
  isAuthorRole,
  isDideDesignerRole,
  isValidatorRole,
  isVirtualizationLeaderRole,
} from "../mappers/courseMappers";

interface CourseProcessStatusSummaryProps {
  breakdown: CoursePhaseBreakdown;
  viewerRole: string;
}

type PhaseKey = (typeof PROCESS_PHASES)[keyof typeof PROCESS_PHASES];

const actionPhaseForRole = (viewerRole: string): PhaseKey | null => {
  if (isVirtualizationLeaderRole(viewerRole)) {
    return PROCESS_PHASES.LEADER_SYLLABUS;
  }
  if (isAuthorRole(viewerRole)) return PROCESS_PHASES.AUTHOR_UPLOAD;
  if (isValidatorRole(viewerRole)) return PROCESS_PHASES.VALIDATOR_REVIEW;
  if (isAdvisorRole(viewerRole)) return PROCESS_PHASES.ADVISOR_REVIEW;
  if (isDideDesignerRole(viewerRole)) return PROCESS_PHASES.DIDE_REVIEW;
  return null;
};

function CourseProcessStatusSummary({
  breakdown,
  viewerRole,
}: CourseProcessStatusSummaryProps) {
  const counts = breakdown.counts;
  const total: number = Object.values(counts).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const syllabusPending = counts[PROCESS_PHASES.LEADER_SYLLABUS] ?? 0;
  const completed = counts[PROCESS_PHASES.COMPLETED] ?? 0;
  const actionPhase = actionPhaseForRole(viewerRole);
  const pendingForMe = actionPhase ? (counts[actionPhase] ?? 0) : 0;
  const others = Math.max(total - pendingForMe - completed, 0);
  const allDone = total > 0 && completed === total && syllabusPending === 0;

  if (total === 0) {
    return <span className="text-xs text-muted">Sin materiales</span>;
  }

  // Fase de syllabus: misma etiqueta para todos los roles (no confundir con Completado).
  if (syllabusPending > 0) {
    return (
      <div className="space-y-0.5">
        <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-950 ring-1 ring-orange-300/70">
          Cargue Syllabus
        </span>
        <p className="text-[11px] leading-snug text-muted">
          {isVirtualizationLeaderRole(viewerRole)
            ? "Pendiente"
            : "En espera del líder de virtualización"}
        </p>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="space-y-0.5">
        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-emerald-300/70">
          Completado
        </span>
        <p className="text-[11px] text-muted">
          {total} material{total === 1 ? "" : "es"}
        </p>
      </div>
    );
  }

  if (pendingForMe > 0) {
    return (
      <div className="space-y-0.5">
        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-300/70">
          {pendingForMe} pendiente{pendingForMe === 1 ? "" : "s"}
        </span>
        <p className="text-[11px] leading-snug text-muted">
          {others > 0
            ? `${others} en otras etapas`
            : completed > 0
              ? `${completed} completado${completed === 1 ? "" : "s"}`
              : `${total} en total`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 ring-1 ring-gray-200/80">
          Sin pendientes
        </span>
      <p className="text-[11px] leading-snug text-muted">
        {others > 0
          ? `${others} material${others === 1 ? "" : "es"} en otras etapas`
          : `${total} material${total === 1 ? "" : "es"} en el proceso`}
      </p>
    </div>
  );
}

export default CourseProcessStatusSummary;
