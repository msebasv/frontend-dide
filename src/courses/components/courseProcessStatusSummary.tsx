/**
 * Estado de los materiales en tablas: badge con el estado del rol (sin conteo)
 * y debajo cuántos van en otras etapas. El color del badge es el del detalle.
 */
import {
  PHASE_SHORT_LABELS,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
import { processStatusStyles } from "../../processVirtualization/constants/processStatusStyles";
import { formatDomainLabel } from "../../global/utils/textUtils";
import type { CoursePhaseBreakdown } from "../types/course.types";
import {
  getRoleActionPhases,
  isVirtualizationLeaderRole,
} from "../mappers/courseMappers";

interface CourseProcessStatusSummaryProps {
  breakdown: CoursePhaseBreakdown;
  viewerRole: string;
}

/** Etiqueta corta para tablas; el nombre completo queda en el title del ProcessStatus. */
const stateLabel = (phase: string): string =>
  PHASE_SHORT_LABELS[phase] ?? formatDomainLabel(phase);

const NEUTRAL_BADGE =
  "bg-[#004040]/10 text-[#004040] border border-[#004040]/25";

const badgeClass = (phase: string): string =>
  `inline-flex whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-semibold ${
    processStatusStyles[phase] ?? NEUTRAL_BADGE
  }`;

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
  const classroomPending =
    counts[PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM] ?? 0;
  const completed = counts[PROCESS_PHASES.COMPLETED] ?? 0;
  const actionPhases = getRoleActionPhases(viewerRole);
  // Preferir la fase propia con pendientes (revisión antes que guión si ambas tienen).
  const actionPhase =
    actionPhases.find((phase) => (counts[phase] ?? 0) > 0) ??
    actionPhases[0] ??
    null;
  const pendingInPhase = actionPhase ? (counts[actionPhase] ?? 0) : 0;
  const otherOwnPending = actionPhases
    .filter((phase) => phase !== actionPhase)
    .reduce((sum, phase) => sum + (counts[phase] ?? 0), 0);
  const pendingForMe = pendingInPhase + otherOwnPending;
  const others = Math.max(total - pendingForMe - completed, 0);

  const otherPhase =
    otherOwnPending > 0
      ? actionPhases.find((phase) => phase !== actionPhase)
      : null;

  const restText =
    otherPhase && otherOwnPending > 0
      ? `${otherOwnPending} en ${stateLabel(otherPhase)}`
      : others > 0
        ? `${others} en otras etapas`
        : completed > 0
          ? `${completed} aprobado${completed === 1 ? "" : "s"}`
          : null;

  if (total === 0) {
    return <span className="text-xs text-muted">Sin materiales</span>;
  }

  // Cargue de syllabus: bloquea todo el proceso, mismo mensaje para todos los roles.
  if (syllabusPending > 0) {
    return (
      <div className="space-y-0.5">
        <span className={badgeClass(PROCESS_PHASES.LEADER_SYLLABUS)}>
          {stateLabel(PROCESS_PHASES.LEADER_SYLLABUS)}
        </span>
        <p className="text-[11px] leading-snug text-muted">
          {isVirtualizationLeaderRole(viewerRole)
            ? "Pendiente"
            : "En espera del líder de virtualización"}
        </p>
      </div>
    );
  }

  // Validación cargue en el aula: visible para todos; solo el líder actúa.
  if (classroomPending > 0) {
    return (
      <div className="space-y-0.5">
        <span className={badgeClass(PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM)}>
          {stateLabel(PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM)}
        </span>
        <p className="text-[11px] leading-snug text-muted">
          {isVirtualizationLeaderRole(viewerRole)
            ? "Pendiente de confirmar"
            : "En espera del líder de virtualización"}
        </p>
      </div>
    );
  }

  if (completed === total) {
    return (
      <div className="space-y-0.5">
        <span className={badgeClass(PROCESS_PHASES.COMPLETED)}>
          Proceso finalizado
        </span>
      </div>
    );
  }

  // Roles de gestión sin estado propio: solo el avance general.
  if (!actionPhase) {
    return (
      <div className="space-y-0.5">
        <span
          className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-bold ${NEUTRAL_BADGE}`}
        >
          En proceso
        </span>
        {restText ? (
          <p className="text-[11px] leading-snug text-muted">{restText}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {pendingInPhase > 0 ? (
        <span className={badgeClass(actionPhase)}>
          {stateLabel(actionPhase)}
        </span>
      ) : (
        <span
          className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-bold ${NEUTRAL_BADGE}`}
        >
          Sin pendientes
        </span>
      )}
      {restText ? (
        <p className="text-[11px] leading-snug text-muted">{restText}</p>
      ) : null}
    </div>
  );
}

export default CourseProcessStatusSummary;
