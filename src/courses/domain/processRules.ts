/**
 * Reglas de fase/estado del proceso de virtualización.
 * Matching canónico + variantes históricas (fuzzy) — no alterar el matching.
 */
import {
  Dev_tableactivitiesstatuscode,
  type Dev_tableactivities,
} from "../../generated/models/Dev_tableactivitiesModel";
import {
  ACTIVITY_STATUS_LABELS,
  isLeaderRole,
  isVirtualizationLeaderRole,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
import {
  formatDomainLabel,
  normalizeComparableText,
} from "../../global/utils/textUtils";
import {
  isAdvisorRole,
  isAuthorRole,
  isDideDesignerRole,
  isValidatorRole,
} from "./rolePolicies";

export const LEADER_SYLLABUS_STATUS = PROCESS_PHASES.LEADER_SYLLABUS;
export const AUTHOR_UPLOAD_STATUS = PROCESS_PHASES.AUTHOR_UPLOAD;
export const VALIDATOR_STATUS = PROCESS_PHASES.VALIDATOR_REVIEW;
export const ADVISOR_STATUS = PROCESS_PHASES.ADVISOR_REVIEW;
export const ADVISOR_GUIDE_UPLOAD_STATUS = PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD;
export const DIDE_STATUS = PROCESS_PHASES.DIDE_REVIEW;
export const ADVISOR_AV_APPROVAL_STATUS = PROCESS_PHASES.ADVISOR_AV_APPROVAL;
export const LEADER_CLASSROOM_CONFIRM_STATUS =
  PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM;

const COMPLETED_STATUS = PROCESS_PHASES.COMPLETED;
const normalizePhaseLabel = normalizeComparableText;
const normalizeActivityLabel = normalizeComparableText;

/**
 * Fase en la que el líder debe cargar el syllabus.
 * Canónico en Dataverse: "Cargue Syllabus".
 * También acepta variantes históricas (p. ej. "Syllabus Completado y Aprobado").
 */
export const isLeaderSyllabusStatus = (status: string): boolean => {
  const normalized = normalizePhaseLabel(status);
  if (!normalized) return false;

  if (normalized === normalizePhaseLabel(COMPLETED_STATUS)) return false;
  if (isLeaderClassroomConfirmStatus(status)) return false;

  if (normalized === normalizePhaseLabel(LEADER_SYLLABUS_STATUS)) return true;

  if (
    normalized.includes("cargue syllabus") ||
    normalized.includes("carga syllabus") ||
    normalized.includes("cargue de syllabus") ||
    normalized.includes("carga de syllabus") ||
    normalized.includes("syllabus completado")
  ) {
    return true;
  }

  // "Syllabus (Líder)" u otras etiquetas cortas de UI
  if (
    normalized === "syllabus" ||
    normalized.startsWith("syllabus (") ||
    normalized.startsWith("syllabus lider")
  ) {
    return true;
  }

  // Variante histórica: "Syllabus Completado y Aprobado"
  return (
    normalized.includes("syllabus") &&
    normalized.includes("aprobado") &&
    !normalized.includes("proceso finalizado")
  );
};

/**
 * Tras el audiovisual DIDE: el líder confirma el cargue en el aula.
 * Canónico: "Validación Cargue en el Aula".
 */
export const isLeaderClassroomConfirmStatus = (status: string): boolean => {
  const normalized = normalizePhaseLabel(status);
  if (!normalized) return false;
  if (normalized === normalizePhaseLabel(LEADER_CLASSROOM_CONFIRM_STATUS)) {
    return true;
  }
  return (
    ((normalized.includes("validacion cargue") &&
      normalized.includes("aula")) ||
      normalized.includes("cargue en el aula") ||
      normalized.includes("carga en el aula") ||
      normalized.includes("cargue en aula") ||
      normalized.includes("carga en aula") ||
      (normalized.includes("confirmar cargue") &&
        normalized.includes("aula"))) &&
    !normalized.includes("syllabus")
  );
};

/**
 * Indica si el estado corresponde al cargue de guión instruccional del asesor.
 * Acepta el nombre canónico y variantes (guía/guión) sin tilde / mayúsculas.
 * No confundir con la revisión del asesor ni con la aprobación audiovisual DIDE.
 */
export const isAdvisorGuideUploadStatus = (status: string): boolean => {
  const normalized = normalizePhaseLabel(status);
  if (!normalized) return false;
  if (normalized.includes("audiovisual")) return false;
  if (normalized === normalizePhaseLabel(ADVISOR_GUIDE_UPLOAD_STATUS)) {
    return true;
  }
  return (
    normalized.includes("guion instruccional") ||
    normalized.includes("guia instruccional") ||
    normalized.includes("guion instruct") ||
    normalized.includes("guia instruct")
  );
};

/**
 * 3/3 asesor: aprobar o devolver el material audiovisual registrado por el diseñador DIDE.
 * No confundir con "Registrar Enlaces Audiovisuales" (diseñador) ni con la revisión/guía.
 */
export const isAdvisorAudiovisualApprovalStatus = (status: string): boolean => {
  const normalized = normalizePhaseLabel(status);
  if (!normalized) return false;
  if (normalized === normalizePhaseLabel(ADVISOR_AV_APPROVAL_STATUS)) {
    return true;
  }
  return (
    normalized.includes("aprobar material audiovisual") ||
    (normalized.includes("material audiovisual") &&
      normalized.includes("dide") &&
      !normalized.includes("registrar") &&
      !normalized.includes("enlace"))
  );
};

/**
 * Indica si el usuario puede cargar material en la fase actual.
 * - Autor: cargue de documentos por el autor.
 * - Líder / gestión: fase de syllabus (el flujo avanza al autor).
 * - Asesor: fase "Cargar Guión instruccional" (tras aprobar la revisión).
 */
export const canUserUploadStatus = (
  userRole: string,
  status: string,
): boolean =>
  (isAuthorRole(userRole) &&
    normalizePhaseLabel(status) === normalizePhaseLabel(AUTHOR_UPLOAD_STATUS)) ||
  (isLeaderRole(userRole) && isLeaderSyllabusStatus(status)) ||
  (isAdvisorRole(userRole) && isAdvisorGuideUploadStatus(status));

/**
 * Indica si el líder de virtualización puede confirmar el cargue en el aula.
 */
export const canUserConfirmClassroomStatus = (
  userRole: string,
  status: string,
): boolean =>
  isVirtualizationLeaderRole(userRole) &&
  isLeaderClassroomConfirmStatus(status);

/**
 * Indica si el usuario puede validar en la fase actual del proceso o de un entregable.
 * Validador: su fase. Asesor: revisión pedagógica O aprobación audiovisual DIDE
 * (nunca el cargue de guión).
 */
export const canUserValidateStatus = (
  userRole: string,
  status: string,
): boolean => {
  const norm = normalizePhaseLabel(status);
  if (isAdvisorGuideUploadStatus(status)) return false;

  if (isValidatorRole(userRole)) {
    return (
      norm === normalizePhaseLabel(VALIDATOR_STATUS) ||
      norm.includes("validador disciplinar") ||
      norm.includes("evaluador disciplinar") || // compat. datos antiguos
      norm.includes("validador")
    );
  }
  if (isAdvisorRole(userRole)) {
    if (isAdvisorAudiovisualApprovalStatus(status)) return true;
    return (
      norm === normalizePhaseLabel(ADVISOR_STATUS) ||
      (norm.includes("asesor pedagogico") && !norm.includes("audiovisual")) ||
      (norm.includes("asesoria") && !norm.includes("audiovisual"))
    );
  }
  return false;
};

/**
 * Evalúa las acciones de validación (Aprobar / Devolver) para un rol
 * según el estado específico de un entregable o categoría.
 * "Etapa 2 aprobada" no habilita al validador; "Etapa 3" activa sí al asesor.
 */
export const canRoleValidateDeliverable = (
  userRole: string,
  stateLabel: string,
): { canApprove: boolean; canReturn: boolean; isValidationPhase: boolean } => {
  const norm = normalizePhaseLabel(stateLabel);

  if (isValidatorRole(userRole)) {
    const isEtapa2Active =
      (norm.includes("etapa 2") || norm.includes("etapa2")) &&
      !norm.includes("aprobad");
    const isMatch =
      norm === normalizePhaseLabel(VALIDATOR_STATUS) ||
      norm.includes("validador disciplinar") ||
      norm.includes("evaluador disciplinar") || // compat. datos antiguos
      (norm.includes("validador") && !norm.includes("aprobad")) ||
      isEtapa2Active;
    return { canApprove: isMatch, canReturn: isMatch, isValidationPhase: isMatch };
  }

  if (isAdvisorRole(userRole)) {
    // 2/3: solo cargue de guión (sin aprobar/devolver).
    if (isAdvisorGuideUploadStatus(stateLabel)) {
      return {
        canApprove: false,
        canReturn: false,
        isValidationPhase: false,
      };
    }
    // 3/3: aprobar/devolver material audiovisual DIDE.
    if (isAdvisorAudiovisualApprovalStatus(stateLabel)) {
      return {
        canApprove: true,
        canReturn: true,
        isValidationPhase: true,
      };
    }
    // 1/3: revisión del material del autor.
    const isEtapa3Active =
      (norm.includes("etapa 3") || norm.includes("etapa3")) &&
      !norm.includes("aprobad");
    const isMatch =
      norm === normalizePhaseLabel(ADVISOR_STATUS) ||
      (norm.includes("asesor pedagogico") && !norm.includes("audiovisual")) ||
      (norm.includes("asesoria") && !norm.includes("audiovisual")) ||
      isEtapa3Active;
    return { canApprove: isMatch, canReturn: isMatch, isValidationPhase: isMatch };
  }

  if (isDideDesignerRole(userRole)) {
    // No mezclar con la fase del asesor "Aprobar material audiovisual DIDE".
    if (isAdvisorAudiovisualApprovalStatus(stateLabel)) {
      return {
        canApprove: false,
        canReturn: false,
        isValidationPhase: false,
      };
    }
    const isMatch =
      norm === normalizePhaseLabel(DIDE_STATUS) ||
      norm.includes("enlaces audiovisuales") ||
      (norm.includes("registrar") && norm.includes("enlace")) ||
      norm.includes("confirmacion dide") ||
      norm.includes("disenador dide") ||
      norm.includes("revision dide") ||
      (norm.includes("dide") &&
        !norm.includes("coordinador") &&
        !norm.includes("aprobar material"));
    return { canApprove: isMatch, canReturn: false, isValidationPhase: isMatch };
  }

  return { canApprove: false, canReturn: false, isValidationPhase: false };
};

export const isDideConfirmationStatus = (status: string): boolean => {
  const normalized = normalizeActivityLabel(status);
  if (!normalized) return false;
  if (isAdvisorAudiovisualApprovalStatus(status)) return false;

  return (
    normalized === normalizeActivityLabel(DIDE_STATUS) ||
    normalized.includes("enlaces audiovisuales") ||
    (normalized.includes("registrar") && normalized.includes("enlace")) ||
    normalized.includes("confirmacion dide") ||
    normalized.includes("revision dide")
  );
};

/**
 * Indica si el diseñador DIDE puede cargar (registrar enlaces) en la fase actual.
 * Revisa material, registra observaciones y aprueba (sin devolver).
 */
export const canUserFinalizeStatus = (
  userRole: string,
  status: string,
): boolean => isDideDesignerRole(userRole) && isDideConfirmationStatus(status);

/** Convierte statuscodename de actividad a etiqueta de UI (Aprobado, Devuelto...). */
export const formatActivityStatus = (status: string): string => {
  const trimmed = status.trim();
  if (!trimmed || trimmed === "—") return PROCESS_PHASES.UNKNOWN;

  const direct = ACTIVITY_STATUS_LABELS[trimmed];
  if (direct) return direct;

  const match = Object.entries(ACTIVITY_STATUS_LABELS).find(
    ([key]) => key.toLowerCase() === trimmed.toLowerCase(),
  );
  if (match) return match[1];

  return formatDomainLabel(trimmed);
};

/**
 * Obtiene el estado crudo de una actividad desde Dataverse.
 * Preferimos statuscodename; si no viene, usamos statuscode (número o texto).
 */
export const resolveActivityStatusRaw = (
  activity: Dev_tableactivities,
): string => {
  const formattedName = activity.statuscodename?.trim();
  if (formattedName) return formattedName;

  const formattedValue = (
    activity as Dev_tableactivities & {
      "samuel.w@example.com"?: string;
    }
  )["samuel.w@example.com"]?.trim();
  if (formattedValue) return formattedValue;

  const code = activity.statuscode as unknown;
  if (code == null || code === "") return "—";

  if (typeof code === "string") {
    const trimmed = code.trim();
    if (!trimmed) return "—";

    // A veces llega el label directo ("Aprobado", "Por aprobar")
    if (Number.isNaN(Number(trimmed))) return trimmed;

    const fromEnum =
      Dev_tableactivitiesstatuscode[
        Number(trimmed) as keyof typeof Dev_tableactivitiesstatuscode
      ];
    return fromEnum ?? trimmed;
  }

  if (typeof code === "number") {
    const fromEnum =
      Dev_tableactivitiesstatuscode[
        code as keyof typeof Dev_tableactivitiesstatuscode
      ];
    return fromEnum ?? String(code);
  }

  return "—";
};

/**
 * Resuelve la plantilla de actividad del rol que valida.
 * Aprobar y devolver usan la misma plantilla; el flujo decide el avance
 * o el regreso según el flag `approved`.
 *
 * - Validador disciplinar → "Revisión y aprobación validador disciplinar"
 * - Asesor (1/3) → "Revisión y aprobación asesor pedagógico"
 * - Asesor (3/3) → "Aprobar material audiovisual DIDE" (si currentStatus lo indica)
 * - Diseñador DIDE → "Registrar Enlaces Audiovisuales"
 */
export const getValidationTargetPhaseName = (
  userRole: string,
  _approved: boolean,
  currentStatus?: string,
): string => {
  if (isValidatorRole(userRole)) {
    return VALIDATOR_STATUS;
  }

  if (isAdvisorRole(userRole)) {
    if (currentStatus && isAdvisorAudiovisualApprovalStatus(currentStatus)) {
      return ADVISOR_AV_APPROVAL_STATUS;
    }
    return ADVISOR_STATUS;
  }

  if (isDideDesignerRole(userRole)) {
    return DIDE_STATUS;
  }

  throw new Error("Rol no autorizado para validar material.");
};
