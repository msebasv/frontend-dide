/**
 * Mappers del módulo de cursos.
 *
 * Responsabilidad: transformar registros de Dataverse (procesos, fases,
 * actividades, asignaciones) en tipos de dominio que la UI consume.
 *
 * Políticas de rol → domain/rolePolicies.ts
 * Reglas de fase/estado → domain/processRules.ts
 * Métricas → metrics/courseMetrics.ts
 * Este archivo re-exporta esas APIs para no romper consumidores existentes.
 */
import type { Dev_tableassignroles } from "../../generated/models/Dev_tableassignrolesModel";
import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import type { Dev_tablecourseinstances } from "../../generated/models/Dev_tablecourseinstancesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import type { Dev_tableactivitytemplates } from "../../generated/models/Dev_tableactivitytemplatesModel";
import type { Dev_tabledeliverables } from "../../generated/models/Dev_tabledeliverablesModel";
import type { Dev_tableactivities } from "../../generated/models/Dev_tableactivitiesModel";

import type {
  Course,
  CourseAssignedRole,
  CourseDetail,
  CourseMaterial,
} from "../types/course.types";
import { getLatestDate, getRecordTimestamp } from "../../global/utils/dateUtils";
import { isActiveDataverseRecord } from "../../global/utils/dataverseState";
import { resolveProcessSemester } from "../../global/utils/semesterUtils";
import { normalizeComparableText } from "../../global/utils/textUtils";
import {
  canUploadProcessSyllabus,
  canonicalizeUserRole,
  isAdminRole,
  isProcessCloseReady,
  isVirtualizationLeaderRole,
  PROCESS_PHASES,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import {
  breakdownHasActionForRole,
  buildProcessPhaseBreakdown,
} from "../utils/phaseBreakdown";

import {
  isAdvisorRole,
  isAuthorRole,
  isDideDesignerRole,
  isValidatorRole,
  getRoleActionPhases,
} from "../domain/rolePolicies";
import {
  ADVISOR_AV_APPROVAL_STATUS,
  ADVISOR_GUIDE_UPLOAD_STATUS,
  ADVISOR_STATUS,
  AUTHOR_UPLOAD_STATUS,
  DIDE_STATUS,
  VALIDATOR_STATUS,
  canUserFinalizeStatus,
  canUserUploadStatus,
  canUserValidateStatus,
  isAdvisorAudiovisualApprovalStatus,
  isAdvisorGuideUploadStatus,
  isDideConfirmationStatus,
  isLeaderClassroomConfirmStatus,
  isLeaderSyllabusStatus,
  resolveActivityStatusRaw,
} from "../domain/processRules";

/* ── Re-exports de compatibilidad (consumidores existentes) ── */
export {
  isAuthorRole,
  isValidatorRole,
  isAdvisorRole,
  isDideDesignerRole,
  hasAssignedValidator,
  hasAssignedDideDesigner,
  canRoleViewFinalDocuments,
  getRoleActionPhases,
  getRoleActionPhase,
} from "../domain/rolePolicies";

export { isVirtualizationLeaderRole };

export {
  LEADER_SYLLABUS_STATUS,
  AUTHOR_UPLOAD_STATUS,
  VALIDATOR_STATUS,
  ADVISOR_STATUS,
  ADVISOR_GUIDE_UPLOAD_STATUS,
  DIDE_STATUS,
  ADVISOR_AV_APPROVAL_STATUS,
  LEADER_CLASSROOM_CONFIRM_STATUS,
  isLeaderSyllabusStatus,
  isLeaderClassroomConfirmStatus,
  isActivityProcessingStatus,
  isAdvisorGuideUploadStatus,
  isAdvisorAudiovisualApprovalStatus,
  canUserUploadStatus,
  canUserConfirmClassroomStatus,
  canUserValidateStatus,
  canRoleValidateDeliverable,
  isDideConfirmationStatus,
  canUserFinalizeStatus,
  formatActivityStatus,
  resolveActivityStatusRaw,
  getValidationTargetPhaseName,
} from "../domain/processRules";

export { computeMetrics, computeLeaderMetrics } from "../metrics/courseMetrics";

const COMPLETED_STATUS = PROCESS_PHASES.COMPLETED;

/** Solo casing/espacios; no quita acentos (distinto de normalizeRoleKey). */
const normalizeRole = (role: string): string => role.trim().toLowerCase();
const normalizeActivityLabel = normalizeComparableText;

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

const DELIVERABLE_APPROVED = 775730004;
const DELIVERABLE_NOT_STARTED = 775730005;

/** Hay un entregable ya iniciado que todavía no está aprobado. */
const hasOpenStartedDeliverable = (
  deliverables?: Dev_tabledeliverables[],
): boolean =>
  (deliverables ?? []).some((row) => {
    const recordState = Number(row.statecode);
    if (Number.isFinite(recordState) && recordState !== 0) return false;
    const code = Number(row.dev_deliverablestate);
    if (!Number.isFinite(code)) return false;
    return code !== DELIVERABLE_NOT_STARTED && code !== DELIVERABLE_APPROVED;
  });

const phaseIsClassroomConfirm = (
  phase: PhaseWithFormatted,
  templatesMap?: Map<string, Dev_tableactivitytemplates>,
): boolean => {
  const expected = getPhaseExpectedActivityName(phase, templatesMap);
  const phaseName = phase.dev_namephase?.trim() ?? "";
  const templateName = phase.dev_tablephasetemplatename?.trim() ?? "";
  return (
    isLeaderClassroomConfirmStatus(expected) ||
    isLeaderClassroomConfirmStatus(phaseName) ||
    isLeaderClassroomConfirmStatus(templateName)
  );
};

/**
 * Estado visible del proceso.
 * La validación del aula solo queda al frente si ya está abierta y
 * todos los entregables iniciados están aprobados. Uno opcional a medio
 * cargar devuelve la fase real de ese trabajo.
 */
export const getCurrentStatus = (
  phases: PhaseWithFormatted[],
  templatesMap?: Map<string, Dev_tableactivitytemplates>,
  deliverables?: Dev_tabledeliverables[],
): string => {
  const lastPhase = [...phases].sort(
    (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
  )[0];
  const latest = getPhaseExpectedActivityName(lastPhase, templatesMap);
  const classroomOpen = phases.some((phase) =>
    phaseIsClassroomConfirm(phase, templatesMap),
  );
  if (classroomOpen && !hasOpenStartedDeliverable(deliverables)) {
    return PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM;
  }
  return latest;
};

/** Traduce el estado del proceso al rol responsable en lenguaje de negocio. */
const getCurrentRole = (status: string): string => {
  if (isLeaderSyllabusStatus(status)) return USER_ROLES.LEADER;
  if (isLeaderClassroomConfirmStatus(status)) return USER_ROLES.LEADER;
  if (status === AUTHOR_UPLOAD_STATUS) return USER_ROLES.AUTHOR;
  if (status === VALIDATOR_STATUS) return USER_ROLES.VALIDATOR;
  if (isAdvisorAudiovisualApprovalStatus(status)) return USER_ROLES.ADVISOR;
  if (status === ADVISOR_STATUS || isAdvisorGuideUploadStatus(status)) {
    return USER_ROLES.ADVISOR;
  }
  if (isDideConfirmationStatus(status)) return USER_ROLES.DIDE_DESIGNER;
  if (status === COMPLETED_STATUS) return "Finalizado";
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
    processes
      .filter((process) => isActiveDataverseRecord(process.statecode))
      .map((p) => [p.dev_tablevirtualizationprocessid, p]),
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
    const processDeliverables = deliverablesByProcess.get(processId) ?? [];
    const phaseStatus = getCurrentStatus(
      processPhases,
      templatesMap,
      processDeliverables,
    );
    const processClosed = isProcessCloseReady(
      process.dev_closeready,
      process.dev_closereadyname,
    );
    const status = processClosed ? PROCESS_PHASES.COMPLETED : phaseStatus;
    const currentRole = getCurrentRole(status);

    // Mismo estado que muestra el detalle del proceso.
    const phaseBreakdown = buildProcessPhaseBreakdown({
      processStatus: status,
      deliverables: processDeliverables,
      phases: processPhases,
      templatesMap,
    });
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

    /**
     * Con entregables independientes, la acción del rol depende de cuántos
     * materiales están en su etapa (no de haber pasado por ella alguna vez).
     */
    const roleActionPhases = getRoleActionPhases(userRole);
    const hasDeliverables = processDeliverables.length > 0;
    const hasDeliverableActionForRole =
      hasDeliverables &&
      roleActionPhases.length > 0 &&
      breakdownHasActionForRole(phaseBreakdown, roleActionPhases);

    const hasGuideUploadPending =
      hasDeliverables &&
      breakdownHasActionForRole(
        phaseBreakdown,
        PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD,
      );
    const hasAdvisorReviewPending =
      hasDeliverables &&
      breakdownHasActionForRole(phaseBreakdown, PROCESS_PHASES.ADVISOR_REVIEW);
    const hasAdvisorAvApprovalPending =
      hasDeliverables &&
      breakdownHasActionForRole(
        phaseBreakdown,
        PROCESS_PHASES.ADVISOR_AV_APPROVAL,
      );
    const hasSyllabusPending =
      breakdownHasActionForRole(
        phaseBreakdown,
        PROCESS_PHASES.LEADER_SYLLABUS,
      ) || isLeaderSyllabusStatus(status);
    const hasClassroomConfirmPending =
      breakdownHasActionForRole(
        phaseBreakdown,
        PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM,
      ) || isLeaderClassroomConfirmStatus(status);

    const processHasDideDesigner = assignRoles.some((ar) => {
      if (ar._dev_tablevirtualizationprocess_value !== processId) return false;
      const roleName =
        ar[
          "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
        ] ??
        ar.dev_tablerolename ??
        "";
      if (canonicalizeUserRole(roleName) !== USER_ROLES.DIDE_DESIGNER) {
        return false;
      }
      return Boolean(ar.dev_person?.trim() || ar.dev_username?.trim());
    });

    const canUpload =
      !processClosed &&
      (hasDeliverables
        ? (canUploadProcessSyllabus(userRole) && hasSyllabusPending) ||
          (isAuthorRole(userRole) &&
            breakdownHasActionForRole(
              phaseBreakdown,
              PROCESS_PHASES.AUTHOR_UPLOAD,
            )) ||
          (isAdvisorRole(userRole) &&
            hasGuideUploadPending &&
            processHasDideDesigner)
        : canUserUploadStatus(userRole, status) &&
          !(
            isAdvisorRole(userRole) &&
            isAdvisorGuideUploadStatus(status) &&
            !processHasDideDesigner
          ));
    const canValidate =
      !processClosed &&
      (hasDeliverables
        ? (isValidatorRole(userRole) && hasDeliverableActionForRole) ||
          (isAdvisorRole(userRole) &&
            (hasAdvisorReviewPending || hasAdvisorAvApprovalPending))
        : canUserValidateStatus(userRole, status) || hasAnyPhaseForRole);
    const canFinalize =
      !processClosed &&
      isDideDesignerRole(userRole) &&
      (hasDeliverables
        ? hasDeliverableActionForRole
        : canUserFinalizeStatus(userRole, status) || hasAnyPhaseForRole);
    const canConfirmClassroom =
      !processClosed &&
      (isVirtualizationLeaderRole(userRole) || isAdminRole(userRole)) &&
      hasClassroomConfirmPending;

    return {
      processId,
      processName: process.dev_nameprocess ?? "",
      courseName: course?.dev_namecourse ?? "",
      programName: program?.dev_nameprogram ?? "",
      facultyName: faculty?.dev_namefaculty ?? "",
      semester: resolveProcessSemester(
        process.dev_nameprocess ?? "",
        process.createdon,
      ),
      createdOn: process.createdon ?? "",
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
      canConfirmClassroom,
      phaseBreakdown,
    };
  };

  // Diseñador DIDE: solo procesos donde está asignado (igual que autor/asesor).
  const userProcessIds = assignRoles
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

/** Cargue de guión instruccional del asesor (no es versión del autor). */
const isAdvisorGuideTemplateName = (name: string): boolean => {
  const normalized = normalizeActivityLabel(name);
  if (!normalized) return false;
  if (normalized === normalizeActivityLabel(ADVISOR_GUIDE_UPLOAD_STATUS)) {
    return true;
  }
  return (
    normalized.includes("guion instruccional") ||
    normalized.includes("guia instruccional") ||
    normalized.includes("guion instruct") ||
    normalized.includes("guia instruct")
  );
};

/** Cargue de syllabus del líder. No es una versión del autor. */
const isSyllabusUploadLabel = (name: string): boolean => {
  if (isLeaderSyllabusStatus(name)) return true;
  const normalized = normalizeActivityLabel(name);
  return normalized.includes("syllabus");
};

const isAuthorUploadTemplateName = (name: string): boolean => {
  const normalized = normalizeActivityLabel(name);
  if (!normalized) return false;
  if (isSyllabusUploadLabel(normalized)) return false;
  if (isAdvisorGuideTemplateName(normalized)) return false;

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
    normalized === normalizeActivityLabel(ADVISOR_AV_APPROVAL_STATUS) ||
    normalized.includes("revision y aprobacion") ||
    normalized.includes("enlaces audiovisuales") ||
    normalized.includes("aprobar material audiovisual") ||
    (normalized.includes("registrar") && normalized.includes("enlace")) ||
    normalized.includes("confirmacion dide") ||
    normalized.includes("revision dide")
  );
};

const getActivityTemplateDisplayName = (
  activity: Dev_tableactivities,
): string => {
  const extended = activity as Dev_tableactivities & {
    "dev_tableactivitytemplate@OData.Community.Display.V1.FormattedValue"?: string;
    "_dev_tableactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
  };

  return (
    activity.dev_tableactivitytemplatename?.trim() ||
    extended[
      "_dev_tableactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
    ]?.trim() ||
    extended[
      "dev_tableactivitytemplate@OData.Community.Display.V1.FormattedValue"
    ]?.trim() ||
    ""
  );
};

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
    if (
      templateId &&
      isAuthorUploadTemplateName(label) &&
      !isAdvisorGuideTemplateName(label) &&
      !isSyllabusUploadLabel(label)
    ) {
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

    if (isAdvisorGuideTemplateName(name) || isSyllabusUploadLabel(name)) {
      continue;
    }

    const isAuthorByName = isAuthorUploadTemplateName(name);
    const isAuthorByRole =
      normalizeActivityLabel(roleName) ===
      normalizeActivityLabel(USER_ROLES.AUTHOR);
    // 3 = Entrega (carga de material del autor). No incluir guión del asesor.
    const isAuthorByType =
      (typeCode === 3 || typeName.includes("entrega")) &&
      normalizeActivityLabel(roleName) !==
        normalizeActivityLabel(USER_ROLES.ADVISOR);

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
 * Aprobar/devolver y el guión instruccional no cuentan como versión.
 */
const isAuthorUploadActivity = (
  activity: Dev_tableactivities,
  authorTemplateIds: Set<string>,
  reviewTemplateIds: Set<string>,
): boolean => {
  const templateId = getActivityTemplateId(activity);
  const templateName = getActivityTemplateDisplayName(activity);
  const activityName = activity.dev_activityname ?? "";
  const observations = activity.dev_observations ?? "";

  if (
    isSyllabusUploadLabel(templateName) ||
    isSyllabusUploadLabel(activityName)
  ) {
    return false;
  }

  if (
    isAdvisorGuideTemplateName(templateName) ||
    isAdvisorGuideTemplateName(activityName) ||
    isAdvisorGuideTemplateName(observations)
  ) {
    return false;
  }

  if (templateId && reviewTemplateIds.has(templateId)) return false;
  if (isReviewTemplateName(templateName)) return false;

  if (templateId && authorTemplateIds.has(templateId)) return true;
  if (isAuthorUploadTemplateName(templateName)) return true;

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

  const phaseStatus = getCurrentStatus(phases, templatesMap, deliverables);
  const processClosed = isProcessCloseReady(
    process.dev_closeready,
    process.dev_closereadyname,
  );
  const status = processClosed ? PROCESS_PHASES.COMPLETED : phaseStatus;
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
      const templateLabel =
        getActivityTemplateDisplayName(activity) ||
        template?.dev_activityname?.trim() ||
        "";
      const isSyllabusUpload =
        isSyllabusUploadLabel(templateLabel) ||
        isSyllabusUploadLabel(activity.dev_activityname ?? "");
      // Cargas del autor: siempre el Autor del assign-role (createdby suele ser la cuenta de servicio).
      // El syllabus lo carga el líder; no heredar el rol Autor de la plantilla.
      const performedByRole = isSyllabusUpload
        ? USER_ROLES.LEADER
        : isAuthorUpload
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
        name:
          getActivityTemplateDisplayName(activity).trim() ||
          template?.dev_activityname?.trim() ||
          activity.dev_activityname?.trim() ||
          "Sin título",
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

  // Responsables del proceso, en el orden del flujo.
  const assignedRoles: CourseAssignedRole[] = [
    USER_ROLES.LEADER,
    USER_ROLES.AUTHOR,
    USER_ROLES.VALIDATOR,
    USER_ROLES.ADVISOR,
    USER_ROLES.DIDE_DESIGNER,
  ].map((role) => {
    const person = findAssignedPerson(processId, role, personByProcessRole);
    return {
      role,
      name: person?.name ?? "",
      email: person?.email ?? "",
    };
  });

  return {
    processId,
    processName: process.dev_nameprocess ?? "",
    courseName: course?.dev_namecourse ?? "",
    programName: program?.dev_nameprogram ?? "",
    facultyName: faculty?.dev_namefaculty ?? "",
    folderBase: process.dev_folderbase ?? "",
    createdOn: process.createdon ?? "",
    status,
    isDeleted: !isActiveDataverseRecord(process.statecode),
    currentRole,
    materials,
    assignedRoles,
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

