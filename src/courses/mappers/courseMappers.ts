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
import type { HistoryEntry, HistoryProcess } from "../../history/types/history.types";
import { getLatestDate } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import {
  ACTIVITY_STATUS_LABELS,
  canonicalizeUserRole,
  PENDING_APPROVAL_PHASES,
  PROCESS_PHASES,
  USER_ROLES,
} from "../../global/constants/domainConstants";

/** Re-exportaciones para compatibilidad con imports existentes. */
export const AUTHOR_UPLOAD_STATUS = PROCESS_PHASES.AUTHOR_UPLOAD;
export const VALIDATOR_STATUS = PROCESS_PHASES.VALIDATOR_REVIEW;
export const ADVISOR_STATUS = PROCESS_PHASES.ADVISOR_REVIEW;
export const DIDE_STATUS = PROCESS_PHASES.DIDE_REVIEW;

const COMPLETED_STATUS = PROCESS_PHASES.COMPLETED;

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
 * Indica si el autor puede cargar material en la fase actual del proceso.
 */
export const canUserUploadStatus = (
  userRole: string,
  status: string,
): boolean => isAuthorRole(userRole) && status === AUTHOR_UPLOAD_STATUS;

/**
 * Indica si el usuario puede validar en la fase actual del proceso.
 * Solo el validador (fase validador) o el asesor (fase asesor) pueden actuar.
 */
export const canUserValidateStatus = (
  userRole: string,
  status: string,
): boolean =>
  (isValidatorRole(userRole) && status === VALIDATOR_STATUS) ||
  (isAdvisorRole(userRole) && status === ADVISOR_STATUS);

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

type PhaseWithFormatted = Dev_tablephases & {
  "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
};

/** Obtiene el estado visible del proceso a partir de su fase más reciente. */
const getCurrentStatus = (phases: PhaseWithFormatted[]): string => {
  const lastPhase = [...phases].sort(
    (a, b) =>
      new Date(b.createdon ?? "").getTime() -
      new Date(a.createdon ?? "").getTime(),
  )[0];

  return (
    lastPhase?.[
      "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
    ] ?? PROCESS_PHASES.UNKNOWN
  );
};

/** Traduce el estado del proceso al rol responsable en lenguaje de negocio. */
const getCurrentRole = (status: string): string => {
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
  userEmail,
  userRole,
}: MapCoursesParams): Course[] => {
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
    const status = getCurrentStatus(processPhases);
    const currentRole = getCurrentRole(status);

    return {
      processId,
      processName: process.dev_nameprocess ?? "",
      courseName: course?.dev_namecourse ?? "",
      programName: program?.dev_nameprogram ?? "",
      facultyName: faculty?.dev_namefaculty ?? "",
      authorName: authorByProcess.get(processId) ?? "—",
      status,
      currentRole,
      modifiedOn: getProcessModifiedOn(
        processId,
        phases,
        activities,
        process.modifiedon,
      ),
      canUpload: canUserUploadStatus(userRole, status),
      canValidate: canUserValidateStatus(userRole, status),
      canFinalize: canUserFinalizeStatus(userRole, status),
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
    normalized.includes("revision dide") ||
    normalized.includes("syllabus completado")
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
}: MapCourseDetailParams): CourseDetail => {
  const status = getCurrentStatus(phases);
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
  const templatesMap = new Map(
    activityTemplates.map((template) => [
      template.dev_tableactivitytemplateid,
      template,
    ]),
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

  const authorUploadsSorted = processActivities
    .filter((activity) =>
      isAuthorUploadActivity(
        activity,
        authorTemplateIds,
        reviewTemplateIds,
      ),
    )
    .sort(
      (a, b) =>
        new Date(a.createdon ?? 0).getTime() -
        new Date(b.createdon ?? 0).getTime(),
    );

  const versionByActivityId = new Map(
    authorUploadsSorted.map((activity, index) => [
      activity.dev_tableactivityid,
      index + 1,
    ]),
  );

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

/** Quita prefijos "Estado" / "Estado de" / "Estado del" del nombre de actividad. */
const cleanHistoryActionLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const withoutPrefix = trimmed
    .replace(/^estado(\s+de(l)?)?\s+/i, "")
    .trim();

  return withoutPrefix || trimmed;
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

const formatAssignedPersonLabel = (person: AssignedPersonInfo): string => {
  if (person.name && person.email && person.name !== person.email) {
    return `${person.name} (${person.email})`;
  }
  return person.name || person.email || "—";
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

const resolveHistoryUser = (
  activity: Dev_tableactivities,
  processId: string,
  roleName: string,
  personByProcessRole: Map<string, AssignedPersonInfo>,
): string =>
  formatAssignedPersonLabel(
    resolveHistoryActor(activity, processId, roleName, personByProcessRole),
  );

export const mapHistoryEntries = (
  activities: Dev_tableactivities[],
  processes: Dev_tablevirtualizationprocesses[],
  courses: Dev_tablecourseinstances[],
  phases: Dev_tablephases[],
  activityTemplates: Dev_tableactivitytemplates[] = [],
  assignRoles: AssignRoleWithFormatted[] = [],
): HistoryEntry[] => {
  const processesMap = new Map(
    processes.map((p) => [p.dev_tablevirtualizationprocessid, p]),
  );
  const coursesMap = new Map(
    courses.map((c) => [c.dev_tablecourseinstanceid, c]),
  );
  const phasesMap = new Map(phases.map((p) => [p.dev_tablephaseid, p]));
  const templatesMap = new Map(
    activityTemplates.map((template) => [
      template.dev_tableactivitytemplateid,
      template,
    ]),
  );

  const personByProcessRole = new Map<string, AssignedPersonInfo>();
  for (const assignRole of assignRoles) {
    const processId = assignRole._dev_tablevirtualizationprocess_value ?? "";
    const roleName =
      assignRole[
        "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
      ]?.trim() ||
      assignRole.dev_tablerolename?.trim() ||
      "";
    const person = toAssignedPerson(assignRole);
    if (!processId || !roleName || (!person.name && !person.email)) continue;
    const canonicalRole = canonicalizeUserRole(roleName);
    personByProcessRole.set(`${processId}::${normalizeRole(roleName)}`, person);
    personByProcessRole.set(
      `${processId}::${normalizeRole(canonicalRole)}`,
      person,
    );
  }

  const phasesWithFormatted = phases as PhaseWithFormatted[];
  const authorTemplateIds = collectAuthorUploadTemplateIds(
    phasesWithFormatted,
    activityTemplates,
  );
  const reviewTemplateIds = collectReviewTemplateIds(
    phasesWithFormatted,
    activityTemplates,
  );

  const activitiesByProcess = new Map<string, Dev_tableactivities[]>();
  for (const activity of activities) {
    const phase = phasesMap.get(activity._dev_tablephase_value ?? "");
    const processId = phase?._dev_tablevirtualizationprocess_value ?? "";
    if (!processId) continue;
    const current = activitiesByProcess.get(processId) ?? [];
    current.push(activity);
    activitiesByProcess.set(processId, current);
  }

  const versionByActivityId = new Map<string, number>();
  for (const processActivities of activitiesByProcess.values()) {
    const authorUploadsSorted = processActivities
      .filter((activity) =>
        isAuthorUploadActivity(
          activity,
          authorTemplateIds,
          reviewTemplateIds,
        ),
      )
      .sort(
        (a, b) =>
          new Date(a.createdon ?? 0).getTime() -
          new Date(b.createdon ?? 0).getTime(),
      );

    authorUploadsSorted.forEach((activity, index) => {
      versionByActivityId.set(activity.dev_tableactivityid, index + 1);
    });
  }

  return activities
    .map((activity) => {
      const phase = phasesMap.get(activity._dev_tablephase_value ?? "");
      const processId = phase?._dev_tablevirtualizationprocess_value ?? "";
      const process = processesMap.get(processId);
      const course = coursesMap.get(process?._dev_tablecourse_value ?? "");
      const template = templatesMap.get(
        activity._dev_tableactivitytemplate_value ?? "",
      );
      const isAuthorUpload =
        versionByActivityId.has(activity.dev_tableactivityid);
      const templateRole = resolveHistoryRole(activity, template);
      const role = isAuthorUpload ? USER_ROLES.AUTHOR : templateRole;
      const templateLabel =
        getActivityTemplateDisplayName(activity) ||
        template?.dev_activityname?.trim() ||
        "";

      return {
        id: activity.dev_tableactivityid,
        processId,
        processName: process?.dev_nameprocess ?? "—",
        courseName: course?.dev_namecourse ?? "—",
        action: cleanHistoryActionLabel(
          activity.dev_activityname?.trim() ||
            templateLabel ||
            "Sin nombre",
        ),
        role,
        user: resolveHistoryUser(
          activity,
          processId,
          role,
          personByProcessRole,
        ),
        date: activity.createdon ?? "",
        modifiedOn: activity.modifiedon ?? activity.createdon ?? "",
        comments: activity.dev_observations ?? "",
        status: resolveActivityStatusRaw(activity),
        version: versionByActivityId.get(activity.dev_tableactivityid),
        folderBase: process?.dev_folderbase ?? "",
        documents: activity.dev_documents ?? "",
      };
    })
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
};

export const buildHistoryProcesses = (
  courses: Course[],
  entries: HistoryEntry[],
): HistoryProcess[] => {
  const entriesByProcess = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const current = entriesByProcess.get(entry.processId) ?? [];
    current.push(entry);
    entriesByProcess.set(entry.processId, current);
  }

  return courses
    .map((course) => ({
      processId: course.processId,
      processName: course.processName,
      courseName: course.courseName,
      status: course.status,
      lastModified: course.modifiedOn,
      activityCount: entriesByProcess.get(course.processId)?.length ?? 0,
    }))
    .sort(
      (a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
    );
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
