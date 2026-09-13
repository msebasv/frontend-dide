/**
 * Constantes de dominio de AcademicPlus.
 *
 * Fuente única de verdad para nombres de fases, roles y estados tal como
 * existen en Dataverse. Centralizar estos valores evita inconsistencias entre
 * módulos (cursos, historial, estadísticas, dashboards).
 *
 * Regla: si un string aparece en la lógica de negocio, debe vivir aquí.
 */

/** Fases del flujo de virtualización (nombres exactos de plantillas en Dataverse). */
export const PROCESS_PHASES = {
  /**
   * Tras crear el proceso: el líder carga el syllabus.
   * Nombre exacto de la plantilla/fase en Dataverse.
   */
  LEADER_SYLLABUS: "Cargue Syllabus",
  AUTHOR_UPLOAD: "Cargue de documentos por el autor",
  VALIDATOR_REVIEW: "Revisión y aprobación evaluador disciplinar",
  ADVISOR_REVIEW: "Revisión y aprobación asesor pedagógico",
  DIDE_REVIEW: "Confirmación DIDE",
  /**
   * Cierre del proceso (si Dataverse usa otro nombre al final, actualizar aquí).
   * Ya no coincide con LEADER_SYLLABUS.
   */
  COMPLETED: "Proceso finalizado",
  UNKNOWN: "Sin estado",
} as const;

/** Roles de usuario reconocidos por la aplicación. */
export const USER_ROLES = {
  AUTHOR: "Autor de asignatura",
  LEADER: "Líder de virtualización",
  VALIDATOR: "Validador disciplinar",
  ADVISOR: "Asesor pedagógico",
  DIDE_COORDINATOR: "Coordinador DIDE",
  DIDE_DESIGNER: "Diseñador DIDE",
  ADMIN: "Administrador",
} as const;

const normalizeRoleKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Unifica variantes de nombre de rol de Dataverse al valor canónico de la app
 * (p. ej. "Líder de Virtualización" → "Líder de virtualización").
 */
export const canonicalizeUserRole = (role: string): string => {
  const normalized = normalizeRoleKey(role);
  if (!normalized) return "";

  for (const canonical of Object.values(USER_ROLES)) {
    if (normalizeRoleKey(canonical) === normalized) return canonical;
  }

  return role.trim();
};

/** Roles globales que solo deben resolverse desde Leaders Users. */
export const LEADER_USERS_ONLY_ROLES: readonly string[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.DIDE_COORDINATOR,
  USER_ROLES.DIDE_DESIGNER,
];

export const isAdminRole = (role: string): boolean =>
  canonicalizeUserRole(role) === USER_ROLES.ADMIN;

/**
 * Roles con alcance global de gestión (misma UI de procesos/estadísticas).
 * Incluye Coordinador DIDE y Administrador (tabla leader users).
 */
export const isLeaderRole = (role: string): boolean => {
  const canonical = canonicalizeUserRole(role);
  return (
    canonical === USER_ROLES.LEADER ||
    canonical === USER_ROLES.DIDE_COORDINATOR ||
    canonical === USER_ROLES.ADMIN
  );
};

/**
 * Etiquetas cortas para gráficas y dashboards.
 * Las claves corresponden a PROCESS_PHASES.
 */
export const PHASE_SHORT_LABELS: Record<string, string> = {
  [PROCESS_PHASES.LEADER_SYLLABUS]: "Syllabus (Líder)",
  [PROCESS_PHASES.AUTHOR_UPLOAD]: "Cargue Autor",
  [PROCESS_PHASES.VALIDATOR_REVIEW]: "Validador Disciplinar",
  [PROCESS_PHASES.ADVISOR_REVIEW]: "Asesor Pedagógico",
  [PROCESS_PHASES.DIDE_REVIEW]: "Diseñador DIDE",
  [PROCESS_PHASES.COMPLETED]: "Completado",
};

/** Fases que se consideran "pendientes de aprobación" en métricas. */
export const PENDING_APPROVAL_PHASES = [
  PROCESS_PHASES.VALIDATOR_REVIEW,
  PROCESS_PHASES.ADVISOR_REVIEW,
] as const;

/** Orden canónico de fases para gráficas de distribución. */
export const PHASE_DISTRIBUTION_ORDER = [
  PROCESS_PHASES.LEADER_SYLLABUS,
  PROCESS_PHASES.AUTHOR_UPLOAD,
  PROCESS_PHASES.VALIDATOR_REVIEW,
  PROCESS_PHASES.ADVISOR_REVIEW,
  PROCESS_PHASES.DIDE_REVIEW,
  PROCESS_PHASES.COMPLETED,
] as const;

/**
 * Roles con vista global de estadísticas (facultad / programa / todo).
 * El líder de virtualización y el asesor solo ven procesos asignados.
 */
export const isGlobalStatisticsRole = (role: string): boolean => {
  const canonical = canonicalizeUserRole(role);
  return (
    canonical === USER_ROLES.ADMIN ||
    canonical === USER_ROLES.DIDE_COORDINATOR
  );
};

/**
 * Etiquetas legibles para statuscode de actividades (dev_tableactivities).
 * Dataverse puede devolver el nombre compacto (Poraprobar) o con espacios (Por aprobar).
 */
export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  Activo: "Activo",
  Inactive: "Inactivo",
  Inactivo: "Inactivo",
  Enproceso: "En proceso",
  "En proceso": "En proceso",
  Terminado: "Terminado",
  Poraprobar: "Por aprobar",
  "Por aprobar": "Por aprobar",
  Aprobado: "Aprobado",
  Porcorregir: "Devuelto",
  "Por corregir": "Devuelto",
  Noaprobado: "No aprobado",
  "No aprobado": "No aprobado",
};
