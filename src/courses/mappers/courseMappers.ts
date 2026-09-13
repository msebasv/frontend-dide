/**
 * Mappers del módulo de cursos.
 *
 * Responsabilidad: transformar registros de Dataverse (procesos, fases,
 * actividades, asignaciones) en tipos de dominio que la UI consume.
 *
 * Reglas de negocio clave:
 * - El estado actual de un proceso = plantilla de la fase más reciente (por createdon).
 * - Un usuario solo ve procesos donde tiene asignación con su rol activo.
 * - modifiedOn = fecha más reciente entre proceso, fases y actividades.
 * - canUpload / canValidate se derivan del rol del usuario y la fase actual.
 */
import type { Dev_tableassignroles } from "../../generated/models/Dev_tableassignrolesModel";
import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import type { Dev_tablecourseinstances } from "../../generated/models/Dev_tablecourseinstancesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import type { Dev_tableactivitytemplates } from "../../generated/models/Dev_tableactivitytemplatesModel";
import type { Dev_tabledeliverables } from "../../generated/models/Dev_tabledeliverablesModel";
import {
  Dev_tableactivitiesstatuscode,
  type Dev_tableactivities,
} from "../../generated/models/Dev_tableactivitiesModel";

import type {
  Course,
  CourseDetail,
  CourseMaterial,
  DashboardMetrics,
} from "../types/course.types";
import { getLatestDate, getRecordTimestamp } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import {
  ACTIVITY_STATUS_LABELS,
  canonicalizeUserRole,
  isLeaderRole,
  PENDING_APPROVAL_PHASES,
  PROCESS_PHASES,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import { buildPhaseBreakdownFromDeliverables } from "../utils/phaseBreakdown";
import { formatDeliverableState } from "../services/deliverableService";
import type { Dev_tabledeliverables } from "../../generated/models/Dev_tabledeliverablesModel";

/** Re-exportaciones para compatibilidad con imports existentes. */
export const LEADER_SYLLABUS_STATUS = PROCESS_PHASES.LEADER_SYLLABUS;
export const AUTHOR_UPLOAD_STATUS = PROCESS_PHASES.AUTHOR_UPLOAD;
export const VALIDATOR_STATUS = PROCESS_PHASES.VALIDATOR_REVIEW;
export const ADVISOR_STATUS = PROCESS_PHASES.ADVISOR_REVIEW;
export const DIDE_STATUS = PROCESS_PHASES.DIDE_REVIEW;

const COMPLETED_STATUS = PROCESS_PHASES.COMPLETED;

const normalizeRole = (role: string): string => role.trim().toLowerCase();

const normalizePhaseLabel = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Determina si el rol activo corresponde al autor de asignatura. */
export const isAuthorRole = (role: string): boolean =>
  normalizeRole(role) === normalizeRole(USER_ROLES.AUTHOR);

/** Líder de virtualización (no incluye admin / coordinador DIDE). */
export const isVirtualizationLeaderRole = (role: string): boolean =>
  canonicalizeUserRole(role) === USER_ROLES.LEADER;

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
 * Fase en la que el líder debe cargar el syllabus.
 * Canónico en Dataverse: "Cargue Syllabus".
 * También acepta variantes históricas (p. ej. "Syllabus Completado y Aprobado").
 */
export const isLeaderSyllabusStatus = (status: string): boolean => {
  const normalized = normalizePhaseLabel(status);
  if (!normalized) return false;

  if (normalized === normalizePhaseLabel(COMPLETED_STATUS)) return false;

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
 * Indica si el usuario puede cargar material en la fase actual.
 * - Autor: cargue de documentos por el autor.
 * - Líder / gestión: fase de syllabus (el flujo avanza al autor).
 */
export const canUserUploadStatus = (
  userRole: string,
  status: string,
): boolean =>
  (isAuthorRole(userRole) &&
    normalizePhaseLabel(status) === normalizePhaseLabel(AUTHOR_UPLOAD_STATUS)) ||
  (isLeaderRole(userRole) && isLeaderSyllabusStatus(status));

/**
 * Indica si el usuario puede validar en la fase actual del proceso o de un entregable.
 * Solo el validador (fase validador) o el asesor (fase asesor) pueden actuar.
 */
export const canUserValidateStatus = (
  userRole: string,
  status: string,
): boolean => {
  const norm = normalizePhaseLabel(status);
  if (isValidatorRole(userRole)) {
    return (
      norm === normalizePhaseLabel(VALIDATOR_STATUS) ||
      norm.includes("evaluador disciplinar") ||
      norm.includes("validador")
    );
  }
  if (isAdvisorRole(userRole)) {
    return (
      norm === normalizePhaseLabel(ADVISOR_STATUS) ||
      norm.includes("asesor pedagogico") ||
      norm.includes("asesoria")
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
      norm.includes("evaluador disciplinar") ||
      (norm.includes("validador") && !norm.includes("aprobad")) ||
      isEtapa2Active;
    return { canApprove: isMatch, canReturn: isMatch, isValidationPhase: isMatch };
  }

  if (isAdvisorRole(userRole)) {
    const isEtapa3Active =
      (norm.includes("etapa 3") || norm.includes("etapa3")) &&
      !norm.includes("aprobad");
    const isMatch =
      norm === normalizePhaseLabel(ADVISOR_STATUS) ||
      norm.includes("asesor pedagogico") ||
      norm.includes("asesoria") ||
      isEtapa3Active;
    return { canApprove: isMatch, canReturn: isMatch, isValidationPhase: isMatch };
  }

  if (isDideDesignerRole(userRole)) {
    const isMatch =
      norm === normalizePhaseLabel(DIDE_STATUS) ||
      norm.includes("confirmacion dide") ||
      norm.includes("disenador dide") ||
      norm.includes("revision dide") ||
      (norm.includes("dide") && !norm.includes("coordinador"));
    return { canApprove: isMatch, canReturn: false, isValidationPhase: isMatch };
  }

  return { canApprove: false, canReturn: false, isValidationPhase: false };
};

const isDideConfirmationStatus = (status: string): boolean => {
  const normalized = normalizeActivityLabel(status);
  if (!normalized) return false;

  return (
    normalized === normalizeActivityLabel(DIDE_STATUS) ||
    normalized.includes("confirmacion dide") ||
    normalized.includes("revision dide")
  );
};

/**
 * Indica si el diseñador DIDE puede aprobar en la fase actual.
 * Revisa material, adjunta Word y aprueba (sin devolver).
 */
export const canUserFinalizeStatus = (
  userRole: string,
  status: string,
): boolean => isDideDesignerRole(userRole) && isDideConfirmationStatus(status);

/** Convierte statuscodename de actividad a etiqueta de UI (Aprobado, Devuelto...). */
export const formatActivityStatus = (status: string): string => {
  const trimmed = status.trim();
  if (!trimmed || trimmed === "—") return "Sin estado";

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
 * o el regreso al autor según el flag `approved`.
 *
 * - Validador disciplinar → "Revisión y aprobación evaluador disciplinar"
 * - Asesor pedagógico → "Revisión y aprobación asesor pedagógico"
 * - Diseñador DIDE → "Confirmación DIDE"
 */
export const getValidationTargetPhaseName = (
  userRole: string,
  _approved: boolean,
): string => {
  if (isValidatorRole(userRole)) {
    return VALIDATOR_STATUS;
  }

  if (isAdvisorRole(userRole)) {
    return ADVISOR_STATUS;
  }

  if (isDideDesignerRole(userRole)) {
    return DIDE_STATUS;
  }

  throw new Error("Rol no autorizado para validar material.");
};

type AssignRoleWithFormatted = Dev_tableassignroles & {
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
};

export type PhaseWithFormatted = Dev_tablephases & {
  "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
};

/**
 * Extrae de forma resiliente el nombre de la plantilla esperada de una fase.
 * Prioridad:
 * 1) @OData.Community.Display.V1.FormattedValue
 * 2) dev_expectedactivitytemplatename
 * 3) Búsqueda por ID en templatesMap (lookup GUID)
 * 4) dev_namephase
 */
export const getPhaseExpectedActivityName = (
  phase?: PhaseWithFormatted,
  templatesMap?: Map<string, Dev_tableactivitytemplates>,
): string => {
  if (!phase) return PROCESS_PHASES.UNKNOWN;

  const odata = phase[
    "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
  ]?.trim();
  if (odata) return odata;

  const rawName = phase.dev_expectedactivitytemplatename?.trim();
  if (rawName) return rawName;

  const templateId = phase._dev_expectedactivitytemplate_value;
  if (templateId && templatesMap) {
    const templateName = templatesMap.get(templateId)?.dev_activityname?.trim();
    if (templateName) return templateName;
  }

  return phase.dev_namephase?.trim() || PROCESS_PHASES.UNKNOWN;
};

/** Obtiene el estado visible del proceso a partir de su fase más reciente (por modifiedon o createdon). */
export const getCurrentStatus = (
  phases: PhaseWithFormatted[],
  templatesMap?: Map<string, Dev_tableactivitytemplates>,
): string => {
  const lastPhase = [...phases].sort(
    (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
  )[0];

  return getPhaseExpectedActivityName(lastPhase, templatesMap);
};

/** Traduce el estado del proceso al rol responsable en lenguaje de negocio. */
const getCurrentRole = (status: string): string => {
  if (isLeaderSyllabusStatus(status)) return USER_ROLES.LEADER;
  if (status === AUTHOR_UPLOAD_STATUS) return USER_ROLES.AUTHOR;
  if (status === VALIDATOR_STATUS) return USER_ROLES.VALIDATOR;
  if (status === ADVISOR_STATUS) return USER_ROLES.ADVISOR;
  if (isDideConfirmationStatus(status)) return USER_ROLES.DIDE_DESIGNER;
  if (status === COMPLETED_STATUS) return "Completado";
  return "—";
};

/**
 * Calcula la última fecha de modificación de un proceso.
 * Considera el registro del proceso, sus fases y sus actividades.
 */
const getProcessModifiedOn = (
  processId: string,
  phases: Dev_tablephases[],
  activities: Dev_tableactivities[],
  processModifiedOn?: string,
): string => {
  const phaseIds = new Set(
    phases
      .filter((phase) => phase._dev_tablevirtualizationprocess_value === processId)
      .map((phase) => phase.dev_tablephaseid),
  );

  const processPhases = phases.filter(
    (phase) => phase._dev_tablevirtualizationprocess_value === processId,
  );
  const processActivities = activities.filter((activity) =>
    phaseIds.has(activity._dev_tablephase_value ?? ""),
  );

  return getLatestDate(
    processModifiedOn,
    ...processPhases.flatMap((phase) => [phase.modifiedon, phase.createdon]),
    ...processActivities.flatMap((activity) => [
      activity.modifiedon,
      activity.createdon,
    ]),
  );
};

interface MapCoursesParams {
  assignRoles: AssignRoleWithFormatted[];
  processes: Dev_tablevirtualizationprocesses[];
  courses: Dev_tablecourseinstances[];
  programs: Dev_table_programs[];
  faculties: Dev_table_faculties[];
  phases: Dev_tablephases[];
  activities: Dev_tableactivities[];
  activityTemplates?: Dev_tableactivitytemplates[];
  deliverables?: Dev_tabledeliverables[];
  userEmail: string;
  userRole: string;
}

/**
 * Lista los cursos/procesos visibles para un usuario según su rol activo.
 * Filtra por asignaciones en dev_tableassignroles y ordena por modifiedOn desc.
 */
export const mapCoursesForUser = ({
  assignRoles,
  processes,
  courses,
  programs,
  faculties,
  phases,
  activities,
  activityTemplates,
  deliverables = [],
  userEmail,
  userRole,
}: MapCoursesParams): Course[] => {
  const templatesMap = activityTemplates
    ? new Map(activityTemplates.map((t) => [t.dev_tableactivitytemplateid, t]))
    : undefined;

  const processesMap = new Map(
    processes.map((p) => [p.dev_tablevirtualizationprocessid, p]),
  );
  const coursesMap = new Map(
    courses.map((c) => [c.dev_tablecourseinstanceid, c]),
  );
  const programsMap = new Map(
    programs.map((p) => [p.dev_table_programid, p]),
  );
  const facultiesMap = new Map(
    faculties.map((f) => [f.dev_table_facultyid, f]),
  );

  const phasesByProcess = new Map<string, PhaseWithFormatted[]>();
  for (const phase of phases) {
    const processId = phase._dev_tablevirtualizationprocess_value;
    if (!processId) continue;
    const current = phasesByProcess.get(processId) ?? [];
    current.push(phase as PhaseWithFormatted);
    phasesByProcess.set(processId, current);
  }

  const deliverablesByProcess = new Map<string, Dev_tabledeliverables[]>();
  for (const deliverable of deliverables) {
    const processId =
      deliverable._dev_tablevirtualizationprocess_value?.trim() ?? "";
    if (!processId) continue;
    const list = deliverablesByProcess.get(processId) ?? [];
    list.push(deliverable);
    deliverablesByProcess.set(processId, list);
  }

  const resolveDeliverableStateLabel = (row: Dev_tabledeliverables): string => {
    const formatted = (
      row as Dev_tabledeliverables & {
        "dev_deliverablestate@OData.Community.Display.V1.FormattedValue"?: string;
      }
    )["dev_deliverablestate@OData.Community.Display.V1.FormattedValue"]?.trim();

    if (formatted) return formatDeliverableState(formatted);
    if (row.dev_deliverablestatename?.trim()) {
      return formatDeliverableState(row.dev_deliverablestatename);
    }
    return formatDeliverableState(row.dev_deliverablestate);
  };

  const authorByProcess = new Map<string, string>();
  for (const assignRole of assignRoles) {
    const roleName =
      assignRole[
        "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
      ] ?? "";
    if (roleName === USER_ROLES.AUTHOR) {
      const processId = assignRole._dev_tablevirtualizationprocess_value ?? "";
      authorByProcess.set(processId, assignRole.dev_person ?? "");
    }
  }

  const buildCourse = (processId: string): Course | null => {
    const process = processesMap.get(processId);
    if (!process) return null;

    const course = coursesMap.get(process._dev_tablecourse_value ?? "");
    const program = programsMap.get(course?._dev_tableprogram_value ?? "");
    const faculty = facultiesMap.get(program?._dev_table_faculty_value ?? "");
    const processPhases = phasesByProcess.get(processId) ?? [];
    const status = getCurrentStatus(processPhases, templatesMap);
    const currentRole = getCurrentRole(status);
    const processDeliverables = deliverablesByProcess.get(processId) ?? [];
    const phaseBreakdown = buildPhaseBreakdownFromDeliverables(
      status,
      processDeliverables.map((row) => ({
        stateLabel: resolveDeliverableStateLabel(row),
        name: row.dev_namedeliverable ?? "",
      })),
    );
    const activeBuckets = Object.values(phaseBreakdown.counts).filter(
      (count) => (count ?? 0) > 0,
    ).length;

    const hasAnyPhaseForRole = processPhases.some((phase) => {
      const pStatus = getPhaseExpectedActivityName(phase, templatesMap);
      return (
        canUserValidateStatus(userRole, pStatus) ||
        canUserFinalizeStatus(userRole, pStatus)
      );
    });

    const canUpload = canUserUploadStatus(userRole, status);
    const canValidate =
      canUserValidateStatus(userRole, status) || hasAnyPhaseForRole;
    const canFinalize =
      canUserFinalizeStatus(userRole, status) || hasAnyPhaseForRole;

    return {
      processId,
      processName: process.dev_nameprocess ?? "",
      courseName: course?.dev_namecourse ?? "",
      programName: program?.dev_nameprogram ?? "",
      facultyName: faculty?.dev_namefaculty ?? "",
      authorName: authorByProcess.get(processId) ?? "—",
      status,
      currentRole: activeBuckets > 1 ? "Varios" : currentRole,
      modifiedOn: getProcessModifiedOn(
        processId,
        phases,
        activities,
        process.modifiedon,
      ),
      canUpload,
      canValidate,
      canFinalize,
      phaseBreakdown,
    };
  };

  // Diseñador DIDE es global (Leaders Users): ve todos los procesos.
  const userProcessIds = isDideDesignerRole(userRole)
    ? processes.map((process) => process.dev_tablevirtualizationprocessid)
    : assignRoles
        .filter((ar) => {
          const roleName =
            ar[
              "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
            ] ?? "";
          return (
            ar.dev_person === userEmail &&
            normalizeRole(roleName) === normalizeRole(userRole)
          );
        })
        .map((ar) => ar._dev_tablevirtualizationprocess_value ?? "")
        .filter(Boolean);

  return userProcessIds
    .map((processId) => buildCourse(processId))
    .filter((c): c is Course => c !== null)
    .sort(
      (a, b) =>
        new Date(b.modifiedOn).getTime() - new Date(a.modifiedOn).getTime(),
    );
};

interface MapCourseDetailParams {
  process: Dev_tablevirtualizationprocesses;
  course: Dev_tablecourseinstances | undefined;
  program: Dev_table_programs | undefined;
  faculty: Dev_table_faculties | undefined;
  phases: PhaseWithFormatted[];
  activities: Dev_tableactivities[];
  activityTemplates?: Dev_tableactivitytemplates[];
  assignRoles?: AssignRoleWithFormatted[];
  deliverables?: Dev_tabledeliverables[];
}

const normalizeActivityLabel = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const isAuthorUploadTemplateName = (name: string): boolean => {
  const normalized = normalizeActivityLabel(name);
  if (!normalized) return false;

  return (
    normalized === normalizeActivityLabel(AUTHOR_UPLOAD_STATUS) ||
    (normalized.includes("cargue") && normalized.includes("autor")) ||
    (normalized.includes("cargue") && normalized.includes("documento"))
  );
};

const isReviewTemplateName = (name: string): boolean => {
  const normalized = normalizeActivityLabel(name);
  if (!normalized) return false;

  return (
    normalized === normalizeActivityLabel(VALIDATOR_STATUS) ||
    normalized === normalizeActivityLabel(ADVISOR_STATUS) ||
    normalized === normalizeActivityLabel(DIDE_STATUS) ||
    normalized.includes("revision y aprobacion") ||
    normalized.includes("confirmacion dide") ||
    normalized.includes("revision dide")
  );
};

const getActivityTemplateDisplayName = (
  activity: Dev_tableactivities,
): string =>
  activity.dev_tableactivitytemplatename ??
  (
    activity as Dev_tableactivities & {
      "dev_tableactivitytemplate@OData.Community.Display.V1.FormattedValue"?: string;
    }
  )["dev_tableactivitytemplate@OData.Community.Display.V1.FormattedValue"] ??
  "";

const getPhaseExpectedTemplateLabel = (
  phase: PhaseWithFormatted,
): string =>
  phase[
    "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
  ] ??
  phase.dev_expectedactivitytemplatename ??
  phase.dev_tablephasetemplatename ??
  phase.dev_namephase ??
  "";

/**
 * IDs de plantilla de "Cargue de documentos por el autor".
 * Se arman desde la tabla de plantillas y desde las fases del proceso
 * (el GUID usado al cargar material).
 */
const collectAuthorUploadTemplateIds = (
  phases: PhaseWithFormatted[],
  activityTemplates: Dev_tableactivitytemplates[],
): Set<string> => {
  const authorIds = new Set<string>();

  for (const phase of phases) {
    const label = getPhaseExpectedTemplateLabel(phase);
    const templateId = phase._dev_expectedactivitytemplate_value;
    if (templateId && isAuthorUploadTemplateName(label)) {
      authorIds.add(templateId);
    }
  }

  for (const template of activityTemplates) {
    const name = template.dev_activityname ?? "";
    const roleName = template.dev_tablerolename ?? "";
    const typeCode = Number(template.dev_typeactivity);
    const typeName = normalizeActivityLabel(
      template.dev_typeactivityname ?? "",
    );

    const isAuthorByName = isAuthorUploadTemplateName(name);
    const isAuthorByRole =
      normalizeActivityLabel(roleName) ===
      normalizeActivityLabel(USER_ROLES.AUTHOR);
    // 3 = Entrega (carga de material)
    const isAuthorByType =
      typeCode === 3 || typeName.includes("entrega");

    if (
      template.dev_tableactivitytemplateid &&
      (isAuthorByName || isAuthorByRole || isAuthorByType) &&
      !isReviewTemplateName(name)
    ) {
      authorIds.add(template.dev_tableactivitytemplateid);
    }
  }

  return authorIds;
};

const collectReviewTemplateIds = (
  phases: PhaseWithFormatted[],
  activityTemplates: Dev_tableactivitytemplates[],
): Set<string> => {
  const reviewIds = new Set<string>();

  for (const phase of phases) {
    const label = getPhaseExpectedTemplateLabel(phase);
    const templateId = phase._dev_expectedactivitytemplate_value;
    if (templateId && isReviewTemplateName(label)) {
      reviewIds.add(templateId);
    }
  }

  for (const template of activityTemplates) {
    const name = template.dev_activityname ?? "";
    const typeCode = Number(template.dev_typeactivity);
    // 1 = Aprobación, 2 = Revisión
    if (
      template.dev_tableactivitytemplateid &&
      (isReviewTemplateName(name) || typeCode === 1 || typeCode === 2)
    ) {
      reviewIds.add(template.dev_tableactivitytemplateid);
    }
  }

  return reviewIds;
};

const getActivityTemplateId = (activity: Dev_tableactivities): string => {
  if (activity._dev_tableactivitytemplate_value) {
    return activity._dev_tableactivitytemplate_value;
  }

  const nested = activity.dev_tableactivitytemplate as
    | { id?: string; activitytemplateid?: string }
    | undefined;

  return nested?.id ?? nested?.activitytemplateid ?? "";
};

/**
 * Versiones = solo actividades de cargue del autor.
 * Aprobar/devolver usan plantillas de revisión y no cuentan como versión.
 */
const isAuthorUploadActivity = (
  activity: Dev_tableactivities,
  authorTemplateIds: Set<string>,
  reviewTemplateIds: Set<string>,
): boolean => {
  const templateId = getActivityTemplateId(activity);
  const templateName = getActivityTemplateDisplayName(activity);

  if (templateId && authorTemplateIds.has(templateId)) return true;
  if (templateId && reviewTemplateIds.has(templateId)) return false;
  if (isAuthorUploadTemplateName(templateName)) return true;
  if (isReviewTemplateName(templateName)) return false;

  if (authorTemplateIds.size > 0) return false;

  if (templateId) return !reviewTemplateIds.has(templateId);
  return !isReviewTemplateName(templateName);
};

export const mapCourseDetail = ({
  process,
  course,
  program,
  faculty,
  phases,
  activities,
  activityTemplates = [],
  assignRoles = [],
  deliverables = [],
}: MapCourseDetailParams): CourseDetail => {
  const templatesMap = new Map(
    activityTemplates.map((template) => [
      template.dev_tableactivitytemplateid,
      template,
    ]),
  );

  const status = getCurrentStatus(phases, templatesMap);
  const currentRole = getCurrentRole(status);
  const processId = process.dev_tablevirtualizationprocessid;

  const authorTemplateIds = collectAuthorUploadTemplateIds(
    phases,
    activityTemplates,
  );
  const reviewTemplateIds = collectReviewTemplateIds(
    phases,
    activityTemplates,
  );

  const personByProcessRole = new Map<string, AssignedPersonInfo>();
  for (const assignRole of assignRoles) {
    if (assignRole._dev_tablevirtualizationprocess_value !== processId) {
      continue;
    }

    const roleName =
      assignRole[
        "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
      ]?.trim() ||
      assignRole.dev_tablerolename?.trim() ||
      "";
    const person = toAssignedPerson(assignRole);
    if (!roleName || (!person.name && !person.email)) continue;

    const canonicalRole = canonicalizeUserRole(roleName);
    personByProcessRole.set(`${processId}::${normalizeRole(roleName)}`, person);
    personByProcessRole.set(
      `${processId}::${normalizeRole(canonicalRole)}`,
      person,
    );
  }

  const phaseIds = new Set(phases.map((p) => p.dev_tablephaseid));
  const processActivities = activities.filter((activity) =>
    phaseIds.has(activity._dev_tablephase_value ?? ""),
  );

  const authorUploads = processActivities.filter((activity) =>
    isAuthorUploadActivity(
      activity,
      authorTemplateIds,
      reviewTemplateIds,
    ),
  );

  const phaseById = new Map(
    phases.map((phase) => [phase.dev_tablephaseid, phase]),
  );

  // Agrupar las cargas de autor por categoría / entregable para que cada archivo
  // tenga su propia numeración de versión independiente (V1, V2, etc.)
  const authorUploadsByDeliverable = new Map<string, Dev_tableactivities[]>();
  for (const activity of authorUploads) {
    const phase = phaseById.get(activity._dev_tablephase_value ?? "");
    let deliverableKey = phase?._dev_tabledeliverable_value?.trim();

    if (!deliverableKey && deliverables.length > 0) {
      const actName = (activity.dev_activityname || "").toLowerCase();
      const isSyllabus = actName.includes("syllabus");
      const matched = deliverables.find((d) => {
        const dName = (d.dev_namedeliverable || "").toLowerCase();
        if (isSyllabus && dName.includes("syllabus")) return true;
        return dName && (actName.includes(dName) || dName.includes(actName));
      });
      if (matched) {
        deliverableKey = matched.dev_tabledeliverableid;
      }
    }

    if (!deliverableKey) {
      deliverableKey =
        (activity.dev_activityname || "").trim().toLowerCase() ||
        activity._dev_tablephase_value ||
        "general";
    }

    const list = authorUploadsByDeliverable.get(deliverableKey) ?? [];
    list.push(activity);
    authorUploadsByDeliverable.set(deliverableKey, list);
  }

  const versionByActivityId = new Map<string, number>();
  for (const list of authorUploadsByDeliverable.values()) {
    list.sort(
      (a, b) =>
        new Date(a.createdon ?? 0).getTime() -
        new Date(b.createdon ?? 0).getTime(),
    );
    list.forEach((activity, index) => {
      versionByActivityId.set(activity.dev_tableactivityid, index + 1);
    });
  }

  // Todas las actividades del proceso (cargues + revisiones), más recientes primero.
  const materials: CourseMaterial[] = [...processActivities]
    .sort(
      (a, b) =>
        new Date(b.createdon ?? 0).getTime() -
        new Date(a.createdon ?? 0).getTime(),
    )
    .map((activity) => {
      const version = versionByActivityId.get(activity.dev_tableactivityid);
      const template = templatesMap.get(
        activity._dev_tableactivitytemplate_value ?? "",
      );
      const isAuthorUpload = version != null;
      const templateRole = resolveHistoryRole(activity, template);
      // Cargas del autor: siempre el Autor del assign-role (createdby suele ser la cuenta de servicio).
      const performedByRole = isAuthorUpload
        ? USER_ROLES.AUTHOR
        : templateRole;
      const actor = resolveHistoryActor(
        activity,
        processId,
        performedByRole,
        personByProcessRole,
      );
      const phaseId = activity._dev_tablephase_value ?? "";
      const phase = phaseById.get(phaseId);

      let deliverableId = phase?._dev_tabledeliverable_value ?? "";
      if (!deliverableId && deliverables.length > 0) {
        const actName = (activity.dev_activityname || "").toLowerCase();
        const isSyllabus = actName.includes("syllabus");
        const matched = deliverables.find((d) => {
          const dName = (d.dev_namedeliverable || "").toLowerCase();
          if (isSyllabus && dName.includes("syllabus")) return true;
          return dName && (actName.includes(dName) || dName.includes(actName));
        });
        if (matched) {
          deliverableId = matched.dev_tabledeliverableid;
        }
      }

      return {
        activityId: activity.dev_tableactivityid,
        name: activity.dev_activityname ?? "Sin título",
        description: activity.dev_observations ?? "",
        documents: activity.dev_documents ?? "",
        status: resolveActivityStatusRaw(activity),
        version,
        isAuthorUpload,
        performedBy: actor.name,
        performedByEmail: actor.email,
        performedByRole,
        phaseId,
        deliverableId,
        createdOn: activity.createdon ?? "",
        modifiedOn: activity.modifiedon ?? activity.createdon ?? "",
      };
    });

  return {
    processId,
    processName: process.dev_nameprocess ?? "",
    courseName: course?.dev_namecourse ?? "",
    programName: program?.dev_nameprogram ?? "",
    facultyName: faculty?.dev_namefaculty ?? "",
    folderBase: process.dev_folderbase ?? "",
    status,
    currentRole,
    materials,
  };
};

const getFormattedLookup = (
  record: object,
  field: string,
): string => {
  const value = (
    record as Record<string, unknown>
  )[`${field}@OData.Community.Display.V1.FormattedValue`];
  return typeof value === "string" ? value.trim() : "";
};


const resolveHistoryRole = (
  activity: Dev_tableactivities,
  template: Dev_tableactivitytemplates | undefined,
): string => {
  const fromTemplateRole =
    template?.dev_tablerolename?.trim() ||
    (template
      ? getFormattedLookup(template, "_dev_tablerole_value") ||
        getFormattedLookup(template, "dev_tablerole")
      : "");
  if (fromTemplateRole) return fromTemplateRole;

  const templateLabel =
    getActivityTemplateDisplayName(activity) ||
    template?.dev_activityname?.trim() ||
    "";
  if (templateLabel) {
    const inferred = getCurrentRole(templateLabel);
    if (inferred && inferred !== "—") return inferred;
  }

  return templateLabel || "—";
};

interface AssignedPersonInfo {
  name: string;
  email: string;
}

const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const toAssignedPerson = (
  assignRole: Pick<AssignRoleWithFormatted, "dev_username" | "dev_person">,
): AssignedPersonInfo => {
  const username = assignRole.dev_username?.trim() || "";
  const person = assignRole.dev_person?.trim() || "";

  const email = looksLikeEmail(person)
    ? person
    : looksLikeEmail(username)
      ? username
      : "";
  const name =
    username && !looksLikeEmail(username)
      ? username
      : person && !looksLikeEmail(person)
        ? person
        : "";

  return { name, email };
};


const findAssignedPerson = (
  processId: string,
  roleName: string,
  personByProcessRole: Map<string, AssignedPersonInfo>,
): AssignedPersonInfo | undefined => {
  if (!processId || !roleName || roleName === "—") return undefined;

  const keys = [
    normalizeRole(roleName),
    normalizeRole(canonicalizeUserRole(roleName)),
  ];

  for (const key of keys) {
    const assigned = personByProcessRole.get(`${processId}::${key}`);
    if (assigned) return assigned;
  }

  return undefined;
};

/**
 * Prioriza la persona del assign-role del proceso: las actividades las crea
 * a menudo la cuenta de servicio vía Power Automate, no el usuario real.
 */
const resolveHistoryActor = (
  activity: Dev_tableactivities,
  processId: string,
  roleName: string,
  personByProcessRole: Map<string, AssignedPersonInfo>,
): AssignedPersonInfo => {
  const assigned = findAssignedPerson(
    processId,
    roleName,
    personByProcessRole,
  );
  if (assigned) return assigned;

  const candidates = [
    activity.createdbyname?.trim(),
    getFormattedLookup(activity, "createdby"),
    getFormattedLookup(activity, "_createdby_value"),
    activity.modifiedbyname?.trim(),
    getFormattedLookup(activity, "modifiedby"),
    activity.owneridname?.trim(),
  ].filter((value): value is string => Boolean(value));

  const meaningful = candidates.find(
    (value) => !/^system$/i.test(value) && !/^#/i.test(value),
  );
  const fallback = meaningful || candidates[0] || "";
  if (!fallback) return { name: "—", email: "" };

  if (looksLikeEmail(fallback)) {
    return { name: "", email: fallback };
  }
  return { name: fallback, email: "" };
};


export const computeMetrics = (courses: Course[]): DashboardMetrics => {
  const completed = courses.filter((c) => c.status === COMPLETED_STATUS).length;
  const pendingApproval = courses.filter((c) =>
    PENDING_APPROVAL_PHASES.includes(
      c.status as (typeof PENDING_APPROVAL_PHASES)[number],
    ),
  ).length;
  const inProgress = courses.filter(
    (c) => c.status !== COMPLETED_STATUS && c.status !== PROCESS_PHASES.UNKNOWN,
  ).length;

  return {
    total: courses.length,
    inProgress,
    pendingApproval,
    completed,
  };
};

export const computeLeaderMetrics = (
  processes: { status: string }[],
): DashboardMetrics => {
  const completed = processes.filter(
    (p) => p.status === COMPLETED_STATUS,
  ).length;
  const pendingApproval = processes.filter((p) =>
    PENDING_APPROVAL_PHASES.includes(
      p.status as (typeof PENDING_APPROVAL_PHASES)[number],
    ),
  ).length;
  const inProgress = processes.filter(
    (p) => p.status !== COMPLETED_STATUS && p.status !== PROCESS_PHASES.UNKNOWN,
  ).length;

  return {
    total: processes.length,
    inProgress,
    pendingApproval,
    completed,
  };
};
