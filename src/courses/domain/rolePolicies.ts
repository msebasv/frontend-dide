/**
 * Políticas de rol del módulo de cursos.
 * Checks de rol de participante (normalizeRole = trim/lower, sin quitar acentos)
 * y permisos de visibilidad / fases de acción por rol.
 */
import {
  canonicalizeUserRole,
  isAdminRole,
  isDesignerCoordinatorRole,
  isDideCoordinatorRole,
  isVirtualizationLeaderRole,
  PROCESS_PHASES,
  USER_ROLES,
} from "../../global/constants/domainConstants";

/** Solo casing/espacios; no quita acentos (distinto de normalizeRoleKey). */
const normalizeRole = (role: string): string => role.trim().toLowerCase();

/** Determina si el rol activo corresponde al autor de asignatura. */
export const isAuthorRole = (role: string): boolean =>
  normalizeRole(role) === normalizeRole(USER_ROLES.AUTHOR);

/** Determina si el rol activo corresponde al validador disciplinar. */
export const isValidatorRole = (role: string): boolean =>
  normalizeRole(role) === normalizeRole(USER_ROLES.VALIDATOR);

/** Determina si el rol activo corresponde al asesor pedagógico. */
export const isAdvisorRole = (role: string): boolean =>
  normalizeRole(role) === normalizeRole(USER_ROLES.ADVISOR);

/** Determina si el rol activo corresponde al diseñador DIDE. */
export const isDideDesignerRole = (role: string): boolean =>
  normalizeRole(role) === normalizeRole(USER_ROLES.DIDE_DESIGNER);

/**
 * Indica si el proceso ya tiene validador disciplinar asignado.
 * Requerido antes de permitir el cargue de syllabus.
 */
export const hasAssignedValidator = (
  assignedRoles?: Array<{ role: string; email?: string; name?: string }>,
  validatorEmail?: string,
): boolean => {
  if (validatorEmail?.trim()) return true;
  if (!assignedRoles?.length) return false;

  return assignedRoles.some((assigned) => {
    const role = canonicalizeUserRole(assigned.role);
    return (
      role === USER_ROLES.VALIDATOR &&
      Boolean(assigned.email?.trim() || assigned.name?.trim())
    );
  });
};

/**
 * Indica si el proceso ya tiene diseñador DIDE asignado.
 * Requerido antes de permitir el cargue de guión instruccional.
 */
export const hasAssignedDideDesigner = (
  assignedRoles?: Array<{ role: string; email?: string; name?: string }>,
  designerEmail?: string,
): boolean => {
  if (designerEmail?.trim()) return true;
  if (!assignedRoles?.length) return false;

  return assignedRoles.some((assigned) => {
    const role = canonicalizeUserRole(assigned.role);
    return (
      role === USER_ROLES.DIDE_DESIGNER &&
      Boolean(assigned.email?.trim() || assigned.name?.trim())
    );
  });
};

/**
 * Roles que ven los documentos finales del entregable (última versión del autor
 * y guión instruccional): gestión global, asesor pedagógico y diseñador DIDE.
 */
export const canRoleViewFinalDocuments = (role: string): boolean =>
  isAdminRole(role) ||
  isDideCoordinatorRole(role) ||
  isDesignerCoordinatorRole(role) ||
  isAdvisorRole(role) ||
  isDideDesignerRole(role);

/**
 * Fase(s) en las que el rol debe actuar sobre los entregables.
 * El asesor tiene tres (sin mezclar):
 * 1) revisión/aprobación del material,
 * 2) cargue de guión instruccional,
 * 3) aprobación del material audiovisual DIDE.
 * Vacío para coordinadores: el syllabus lo carga el líder, no el coordinador.
 */
export const getRoleActionPhases = (role: string): string[] => {
  if (isVirtualizationLeaderRole(role)) {
    return [
      PROCESS_PHASES.LEADER_SYLLABUS,
      PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM,
    ];
  }
  if (isAdminRole(role)) {
    return [PROCESS_PHASES.LEADER_SYLLABUS];
  }
  if (isAuthorRole(role)) return [PROCESS_PHASES.AUTHOR_UPLOAD];
  if (isValidatorRole(role)) return [PROCESS_PHASES.VALIDATOR_REVIEW];
  if (isAdvisorRole(role)) {
    return [
      PROCESS_PHASES.ADVISOR_REVIEW,
      PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD,
      PROCESS_PHASES.ADVISOR_AV_APPROVAL,
    ];
  }
  if (isDideDesignerRole(role)) return [PROCESS_PHASES.DIDE_REVIEW];
  return [];
};

/**
 * Fase principal del rol (la primera de getRoleActionPhases).
 * null para roles de gestión sin etapa propia.
 */
export const getRoleActionPhase = (role: string): string | null =>
  getRoleActionPhases(role)[0] ?? null;
