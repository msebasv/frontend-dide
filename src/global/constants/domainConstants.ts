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
  VALIDATOR_REVIEW: "Revisión y aprobación validador disciplinar",
  /** 1/3 asesor: aprueba o devuelve el material del autor. */
  ADVISOR_REVIEW: "Revisión y aprobación asesor pedagógico",
  /**
   * 2/3 asesor: tras aprobar la revisión, carga el guión instruccional.
   * Nombre exacto de la plantilla/fase en Dataverse.
   */
  ADVISOR_GUIDE_UPLOAD: "Cargar Guión instruccional",
  /**
   * Tras el guión instruccional: el diseñador DIDE registra enlaces audiovisuales.
   * Nombre exacto de la plantilla/fase en Dataverse.
   */
  DIDE_REVIEW: "Registrar Enlaces Audiovisuales",
  /**
   * 3/3 asesor: tras los enlaces del diseñador, aprueba o devuelve el material audiovisual.
   * Nombre exacto de la plantilla/fase en Dataverse.
   */
  ADVISOR_AV_APPROVAL: "Aprobar material audiovisual DIDE",
  /**
   * Tras aprobar el audiovisual DIDE en todas las categorías obligatorias:
   * el líder de virtualización confirma el cargue en el aula y cierra el proceso.
   * Nombre exacto de la plantilla/fase en Dataverse.
   */
  LEADER_CLASSROOM_CONFIRM: "Validación Cargue en el Aula",
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
  /** Asigna el Diseñador DIDE a cada proceso; vista de gestión sin crear/editar. */
  DESIGNER_COORDINATOR: "Coordinador Diseñador",
  DIDE_DESIGNER: "Diseñador DIDE",
  ADMIN: "Administrador",
} as const;

/** Compara claves de rol (acentos / casing) sin mapear al canónico de la app. */
export const normalizeRoleKey = (value: string): string =>
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

/**
 * Roles globales que solo deben resolverse desde Leaders Users.
 * El Diseñador DIDE se asigna por proceso (assign roles), igual que autor/asesor.
 */
export const LEADER_USERS_ONLY_ROLES: readonly string[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.DIDE_COORDINATOR,
  USER_ROLES.DESIGNER_COORDINATOR,
];

/**
 * Roles con alcance de gestión global (misma UI de procesos / seguimiento / stats).
 * Conjunto usado por isLeaderRole y el sidebar.
 */
export const MANAGEMENT_ROLES = [
  USER_ROLES.LEADER,
  USER_ROLES.DIDE_COORDINATOR,
  USER_ROLES.DESIGNER_COORDINATOR,
  USER_ROLES.ADMIN,
] as const;

export const isAdminRole = (role: string): boolean =>
  canonicalizeUserRole(role) === USER_ROLES.ADMIN;

export const isDideCoordinatorRole = (role: string): boolean =>
  canonicalizeUserRole(role) === USER_ROLES.DIDE_COORDINATOR;

export const isDesignerCoordinatorRole = (role: string): boolean =>
  canonicalizeUserRole(role) === USER_ROLES.DESIGNER_COORDINATOR;

/** Solo el rol "Líder de virtualización" (no admin ni coordinadores). */
export const isVirtualizationLeaderRole = (role: string): boolean =>
  canonicalizeUserRole(role) === USER_ROLES.LEADER;

/**
 * Roles con alcance global de gestión (misma UI de procesos/estadísticas).
 * Incluye Coordinador DIDE, Coordinador Diseñador y Administrador.
 */
export const isLeaderRole = (role: string): boolean =>
  (MANAGEMENT_ROLES as readonly string[]).includes(canonicalizeUserRole(role));

/**
 * Quién puede crear procesos y cursos nuevos.
 * El Líder de virtualización solo opera sobre procesos asignados (sin alta).
 */
export const canCreateProcesses = (role: string): boolean => {
  const canonical = canonicalizeUserRole(role);
  return (
    canonical === USER_ROLES.DIDE_COORDINATOR ||
    canonical === USER_ROLES.ADMIN
  );
};

/**
 * Quién puede editar procesos existentes (nombre, roles base, etc.).
 * Incluye Líder de virtualización en sus procesos asignados.
 */
export const canCreateOrEditProcesses = (role: string): boolean => {
  const canonical = canonicalizeUserRole(role);
  return (
    canonical === USER_ROLES.LEADER ||
    canonical === USER_ROLES.DIDE_COORDINATOR ||
    canonical === USER_ROLES.ADMIN
  );
};

/** Quién puede asignar el Diseñador DIDE a un proceso. */
export const canAssignDideDesigner = (role: string): boolean => {
  const canonical = canonicalizeUserRole(role);
  return (
    canonical === USER_ROLES.DESIGNER_COORDINATOR ||
    canonical === USER_ROLES.ADMIN ||
    canonical === USER_ROLES.DIDE_COORDINATOR
  );
};

/** Coordinador DIDE o Coordinador Diseñador (retorno a Seguimiento, etc.). */
export const isCoordinatorRole = (role: string): boolean =>
  isDideCoordinatorRole(role) || isDesignerCoordinatorRole(role);

/**
 * Etiquetas cortas para gráficas y dashboards.
 * Las claves corresponden a PROCESS_PHASES.
 */
export const PHASE_SHORT_LABELS: Record<string, string> = {
  [PROCESS_PHASES.LEADER_SYLLABUS]: "Syllabus (Líder)",
  [PROCESS_PHASES.AUTHOR_UPLOAD]: "Cargue Autor",
  [PROCESS_PHASES.VALIDATOR_REVIEW]: USER_ROLES.VALIDATOR,
  [PROCESS_PHASES.ADVISOR_REVIEW]: "Asesor Pedagógico",
  [PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD]: "Guión instruccional",
  [PROCESS_PHASES.DIDE_REVIEW]: "Enlaces audiovisuales",
  [PROCESS_PHASES.ADVISOR_AV_APPROVAL]: "Aprobar AV DIDE",
  [PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM]: "Cargue en aula",
  [PROCESS_PHASES.COMPLETED]: "Proceso finalizado",
};

/** Fases que se consideran "pendientes de aprobación" en métricas. */
export const PENDING_APPROVAL_PHASES = [
  PROCESS_PHASES.VALIDATOR_REVIEW,
  PROCESS_PHASES.ADVISOR_REVIEW,
  PROCESS_PHASES.ADVISOR_AV_APPROVAL,
] as const;

/** Orden canónico de fases para gráficas de distribución. */
export const PHASE_DISTRIBUTION_ORDER = [
  PROCESS_PHASES.LEADER_SYLLABUS,
  PROCESS_PHASES.AUTHOR_UPLOAD,
  PROCESS_PHASES.VALIDATOR_REVIEW,
  PROCESS_PHASES.ADVISOR_REVIEW,
  PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD,
  PROCESS_PHASES.DIDE_REVIEW,
  PROCESS_PHASES.ADVISOR_AV_APPROVAL,
  PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM,
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
    canonical === USER_ROLES.DIDE_COORDINATOR ||
    canonical === USER_ROLES.DESIGNER_COORDINATOR
  );
};

/**
 * Status Reason (statuscode) del proceso de virtualización.
 * Columna "Status Reason" en Dataverse: Active | Inactive | Closed.
 * Nota: el cierre funcional tras "Confirmar cargue en el aula" ya no usa Closed;
 * se marca con el booleano close-ready (dev_closeready).
 */
export const PROCESS_STATUS_REASONS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  CLOSED: "Closed",
} as const;

/**
 * Indica si el proceso está listo/cerrado tras confirmar el cargue en el aula.
 * Campo Dataverse: close-ready (dev_closeready).
 */
export const isProcessCloseReady = (
  closeReady?: boolean | string | number | null,
  closeReadyName?: string | null,
): boolean => {
  if (closeReady === true || closeReady === 1 || closeReady === "1") {
    return true;
  }
  if (typeof closeReady === "string") {
    const raw = closeReady.trim().toLowerCase();
    if (raw === "true" || raw === "yes" || raw === "si" || raw === "sí") {
      return true;
    }
  }

  const name = String(closeReadyName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return (
    name === "yes" ||
    name === "si" ||
    name === "true" ||
    name === "activo" ||
    name.includes("yes") ||
    name.includes("true")
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

/**
 * Estados canónicos de entregable (dev_deliverablestate) tal como se muestran en UI.
 * Claves alineadas con los labels de Dataverse tras normalización.
 */
export const DELIVERABLE_STATES = {
  PENDING: "Pendiente",
  STAGE_2: "En etapa 2",
  STAGE_2_APPROVED: "Etapa 2 aprobada",
  STAGE_3: "En etapa 3",
  APPROVED: "Aprobado",
  NOT_STARTED: "No iniciado",
} as const;
