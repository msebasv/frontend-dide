/**
 * Desglose de fases a partir del estado real de cada entregable.
 * Usado en "Mis cursos" para mostrar pendientes por rol (sin datos de maqueta).
 */
import { PROCESS_PHASES } from "../../global/constants/domainConstants";
import { normalizeComparableText } from "../../global/utils/textUtils";
import {
  findDeliverablePhase,
  formatDeliverableState,
  resolveDeliverableStateLabel,
  resolveEffectiveDeliverableState,
  resolvePhaseExpectedActivity,
} from "../services/deliverableService";
import type { CoursePhaseBreakdown } from "../types/course.types";
import type { Dev_tabledeliverables } from "../../generated/models/Dev_tabledeliverablesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";

export interface DeliverableStateInput {
  stateLabel: string;
  name?: string;
}

const normalize = normalizeComparableText;

const isSyllabusProcessStatus = (status: string): boolean => {
  const normalized = normalize(status);
  if (!normalized) return false;
  if (normalized === normalize(PROCESS_PHASES.COMPLETED)) return false;
  if (
    (normalized.includes("validacion cargue") &&
      normalized.includes("aula")) ||
    normalized.includes("cargue en el aula") ||
    normalized.includes("carga en el aula") ||
    normalized.includes("confirmar cargue")
  ) {
    return false;
  }
  if (normalized === normalize(PROCESS_PHASES.LEADER_SYLLABUS)) return true;
  return (
    normalized.includes("syllabus") &&
    (normalized.includes("cargue") ||
      normalized.includes("carga") ||
      normalized.includes("completado") ||
      normalized === "syllabus" ||
      normalized.startsWith("syllabus (") ||
      normalized.startsWith("syllabus lider"))
  );
};

const isClassroomConfirmProcessStatus = (status: string): boolean => {
  const normalized = normalize(status);
  if (!normalized) return false;
  if (normalized === normalize(PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM)) {
    return true;
  }
  return (
    (normalized.includes("validacion cargue") &&
      normalized.includes("aula")) ||
    normalized.includes("cargue en el aula") ||
    normalized.includes("carga en el aula") ||
    normalized.includes("cargue en aula") ||
    normalized.includes("carga en aula") ||
    (normalized.includes("confirmar cargue") && normalized.includes("aula"))
  );
};

/** Proceso cerrado (close-ready / Proceso finalizado). */
const isCompletedProcessStatus = (status: string): boolean => {
  const normalized = normalize(status);
  if (!normalized) return false;
  return (
    normalized === normalize(PROCESS_PHASES.COMPLETED) ||
    normalized.includes("proceso finalizado")
  );
};
/**
 * Mapea el estado del entregable a la fase de proceso usada por el resumen de UI.
 * Estados intermedios (p. ej. Etapa 2 aprobada) quedan fuera de la fase de acción
 * de validador/asesor para no inflar "pendientes".
 */
export const mapDeliverableStateToPhaseKey = (stateLabel: string): string => {
  const formatted = formatDeliverableState(stateLabel);
  const norm = normalize(formatted);

  if (!norm || norm === "sin estado") {
    return PROCESS_PHASES.AUTHOR_UPLOAD;
  }

  // Estado en syllabus: el proceso aún no llega al cargue del autor.
  if (norm.includes("syllabus")) {
    return PROCESS_PHASES.LEADER_SYLLABUS;
  }

  // Cargue / validación en el aula (líder), antes del match genérico por "cargue"/"aprobado".
  if (
    (norm.includes("validacion cargue") && norm.includes("aula")) ||
    norm.includes("cargue en el aula") ||
    norm.includes("carga en el aula") ||
    norm.includes("cargue en aula") ||
    norm.includes("carga en aula") ||
    (norm.includes("confirmar cargue") && norm.includes("aula"))
  ) {
    return PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM;
  }

  // "No iniciado": entregable opcional, pero sigue siendo cargue del autor.
  if (norm.includes("no iniciado") || norm.includes("noiniciado")) {
    return PROCESS_PHASES.AUTHOR_UPLOAD;
  }

  if (norm.includes("aprobado") && !norm.includes("etapa")) {
    return PROCESS_PHASES.COMPLETED;
  }

  // Nombres de fase de cierre: "Proceso finalizado".
  if (
    norm.includes("finalizado") ||
    norm.includes("completado") ||
    norm.includes("terminado")
  ) {
    return PROCESS_PHASES.COMPLETED;
  }

  // 3/3 asesor: aprobar material audiovisual (antes del match genérico "dide"/enlaces).
  if (
    norm.includes("aprobar material audiovisual") ||
    (norm.includes("material audiovisual") &&
      norm.includes("dide") &&
      !norm.includes("registrar") &&
      !norm.includes("enlace"))
  ) {
    return PROCESS_PHASES.ADVISOR_AV_APPROVAL;
  }

  // Diseñador: registrar enlaces (no la aprobación audiovisual del asesor).
  if (
    norm.includes("enlaces audiovisuales") ||
    (norm.includes("registrar") && norm.includes("enlace")) ||
    (norm.includes("dide") &&
      !norm.includes("aprobar") &&
      !norm.includes("coordinador")) ||
    norm.includes("confirmacion dide")
  ) {
    return PROCESS_PHASES.DIDE_REVIEW;
  }

  // Cargue de guión instruccional (asesor 2/3), antes del match genérico por "asesor".
  if (
    norm.includes("guion instruccional") ||
    norm.includes("guia instruccional") ||
    norm.includes("guion instruct") ||
    norm.includes("guia instruct")
  ) {
    return PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD;
  }

  // "En etapa 3" (no "etapa 3 aprobada" si existiera)
  if (
    (norm.includes("etapa 3") || norm.includes("etapa3")) &&
    !norm.includes("aprobad")
  ) {
    return PROCESS_PHASES.ADVISOR_REVIEW;
  }

  // "En etapa 2" activo — excluye "Etapa 2 aprobada"
  if (
    (norm.includes("etapa 2") || norm.includes("etapa2")) &&
    !norm.includes("aprobad")
  ) {
    return PROCESS_PHASES.VALIDATOR_REVIEW;
  }

  // Etapa 2 ya aprobada: en tránsito hacia asesoría (no cuenta como pendiente del validador)
  if (
    (norm.includes("etapa 2") || norm.includes("etapa2")) &&
    norm.includes("aprobad")
  ) {
    return "Etapa 2 aprobada";
  }

  // Asesor 1/3: "Revisión y aprobación asesor pedagógico".
  // No incluir guión ni aprobación audiovisual DIDE (ya mapeadas arriba).
  if (
    norm.includes("asesor") &&
    !norm.includes("guia") &&
    !norm.includes("guion") &&
    !norm.includes("audiovisual")
  ) {
    return PROCESS_PHASES.ADVISOR_REVIEW;
  }

  if (
    norm.includes("validador") ||
    norm.includes("evaluador") || // compat. datos antiguos
    norm.includes("revision")
  ) {
    return PROCESS_PHASES.VALIDATOR_REVIEW;
  }

  if (
    norm.includes("pendiente") ||
    norm.includes("devuelto") ||
    norm.includes("corregir") ||
    norm.includes("cargue") ||
    norm.includes("autor")
  ) {
    return PROCESS_PHASES.AUTHOR_UPLOAD;
  }

  return PROCESS_PHASES.AUTHOR_UPLOAD;
};

const bump = (
  counts: Partial<Record<string, number>>,
  key: string,
  amount = 1,
) => {
  counts[key] = (counts[key] ?? 0) + amount;
};

/**
 * Construye el desglose real por entregable.
 * Si el proceso sigue en syllabus, reporta esa fase (no mezclar con materiales).
 */
export const buildPhaseBreakdownFromDeliverables = (
  processStatus: string,
  deliverables: DeliverableStateInput[],
): CoursePhaseBreakdown => {
  // Proceso finalizado (close-ready): los opcionales no deben quedar como
  // "otras etapas"; todo el proceso se muestra Completado.
  if (isCompletedProcessStatus(processStatus)) {
    return {
      counts: {
        [PROCESS_PHASES.COMPLETED]: Math.max(deliverables.length, 1),
      },
      isMock: false,
    };
  }

  if (isSyllabusProcessStatus(processStatus)) {
    return {
      counts: {
        [PROCESS_PHASES.LEADER_SYLLABUS]: Math.max(deliverables.length, 1),
      },
      isMock: false,
    };
  }

  if (isClassroomConfirmProcessStatus(processStatus)) {
    return {
      counts: {
        [PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM]: Math.max(
          deliverables.length,
          1,
        ),
      },
      isMock: false,
    };
  }

  if (deliverables.length === 0) {
    // Sin entregables configurados: un solo bucket según estado del proceso.
    if (isSyllabusProcessStatus(processStatus)) {
      return {
        counts: { [PROCESS_PHASES.LEADER_SYLLABUS]: 1 },
        isMock: false,
      };
    }
    if (isClassroomConfirmProcessStatus(processStatus)) {
      return {
        counts: { [PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM]: 1 },
        isMock: false,
      };
    }
    const key = mapDeliverableStateToPhaseKey(processStatus);
    return { counts: { [key]: 1 }, isMock: false };
  }

  const counts: Partial<Record<string, number>> = {};
  for (const item of deliverables) {
    bump(counts, mapDeliverableStateToPhaseKey(item.stateLabel));
  }

  return { counts, isMock: false };
};

/**
 * Desglose de un proceso a partir de sus entregables de Dataverse.
 * Fuente única para "Mis cursos" y el listado de procesos del líder: resuelve el
 * estado efectivo de cada entregable igual que el detalle del proceso.
 */
export const buildProcessPhaseBreakdown = <
  T extends { dev_activityname?: string },
>(input: {
  processStatus: string;
  deliverables: Dev_tabledeliverables[];
  phases: Dev_tablephases[];
  templatesMap?: Map<string, T>;
}): CoursePhaseBreakdown => {
  const states: DeliverableStateInput[] = input.deliverables.map((row) => {
    const linkedPhase = findDeliverablePhase(row, input.phases);

    return {
      stateLabel: resolveEffectiveDeliverableState({
        rawStateLabel: resolveDeliverableStateLabel(row),
        deliverableName: row.dev_namedeliverable ?? "",
        phaseExpectedActivity: linkedPhase
          ? resolvePhaseExpectedActivity(linkedPhase, input.templatesMap)
          : "",
        processCurrentActivity: input.processStatus,
      }),
      name: row.dev_namedeliverable ?? "",
    };
  });

  return buildPhaseBreakdownFromDeliverables(input.processStatus, states);
};

/** true si el desglose tiene materiales pendientes de acción para la(s) fase(s) del rol. */
export const breakdownHasActionForRole = (
  breakdown: CoursePhaseBreakdown | undefined,
  phase: string | readonly string[],
): boolean => {
  if (!breakdown) return false;
  const phases = typeof phase === "string" ? [phase] : phase;
  return phases.some((key) => (breakdown.counts[key] ?? 0) > 0);
};
