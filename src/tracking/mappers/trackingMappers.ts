/**
 * Construye el tablero de seguimiento a partir de datos Dataverse.
 */
import type { Dev_tableassignroles } from "../../generated/models/Dev_tableassignrolesModel";
import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import type { Dev_tablecourseinstances } from "../../generated/models/Dev_tablecourseinstancesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import type { Dev_tableactivities } from "../../generated/models/Dev_tableactivitiesModel";
import type { Dev_tabledeliverables } from "../../generated/models/Dev_tabledeliverablesModel";
import type { Dev_tableactivitytemplates } from "../../generated/models/Dev_tableactivitytemplatesModel";

import {
  PHASE_SHORT_LABELS,
  PROCESS_PHASES,
  USER_ROLES,
  VISUAL_CLASSROOM_UPLOAD_LABEL,
  canonicalizeUserRole,
  isProcessCloseReady,
  isLeaderRole,
  isVirtualizationLeaderRole,
} from "../../global/constants/domainConstants";
import { getLatestDate, getRecordTimestamp } from "../../global/utils/dateUtils";
import { isActiveDataverseRecord } from "../../global/utils/dataverseState";
import {
  deliverableElapsedDayCount,
  formatActorElapsed,
  processElapsedLabel,
} from "../../global/utils/colombiaBusinessDays";
import { resolveProcessSemester } from "../../global/utils/semesterUtils";
import { normalizeComparableText } from "../../global/utils/textUtils";
import {
  formatActivityStatus,
  isAdvisorAudiovisualApprovalStatus,
  isAdvisorGuideUploadStatus,
  isAdvisorRole,
  isLeaderClassroomConfirmStatus,
  isLeaderSyllabusStatus,
  isActivityProcessingStatus,
  resolveActivityStatusRaw,
} from "../../courses/mappers/courseMappers";
import { isSyllabusDeliverable } from "../../courses/services/deliverableService";
import type {
  ActorProgressCode,
  DeliverableTrackingItem,
  ProcessTrackingRow,
  ProcessTrackingSummary,
} from "../types/tracking.types";

type AssignRoleWithFormatted = Dev_tableassignroles & {
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
};

type PhaseWithFormatted = Dev_tablephases & {
  "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
};

const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizePhase = normalizeComparableText;

const matchPhase = (status: string, target: string): boolean =>
  normalizePhase(status) === normalizePhase(target);

const ACTOR_STATUS_LABELS: Record<ActorProgressCode, string> = {
  pending: "Pendiente",
  done: "Completado",
  returned: "Devuelto",
  waiting: "En espera",
  na: "—",
};

const creditLabelFor = (creditNumber: number): string =>
  creditNumber === 0 ? "General" : `Unidad ${creditNumber}`;

const activityStamp = (activity: Dev_tableactivities): string =>
  activity.createdon || activity.modifiedon || "";

const latestActivity = (
  activities: Dev_tableactivities[],
): Dev_tableactivities | undefined =>
  [...activities].sort(
    (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
  )[0];

const WAITING_ACTORS: { key: keyof ActorStatusSet; label: string }[] = [
  { key: "leaderPre", label: "Líder" },
  { key: "author", label: "Autor" },
  { key: "validator", label: "Validador" },
  { key: "advisor", label: "Asesor" },
  { key: "designer", label: "Diseñador" },
  { key: "advisorAv", label: "Asesor" },
  { key: "leaderClassroom", label: "Líder" },
];

const deliverableElapsedLabel = (params: {
  statuses: ActorStatusSet;
  activities: Dev_tableactivities[];
  processCreatedOn: string;
  syllabusCompletedOn?: string;
  isSyllabus: boolean;
  syllabusLoaded: boolean;
  finalized: boolean;
}): string => {
  const {
    statuses,
    activities,
    processCreatedOn,
    syllabusCompletedOn,
    isSyllabus,
    syllabusLoaded,
    finalized,
  } = params;
  const settled = activities.filter(
    (activity) =>
      !isActivityProcessingStatus(resolveActivityStatusRaw(activity)),
  );
  const pool = settled.length > 0 ? settled : activities;
  const latest = latestActivity(pool);
  const latestReturned = latest
    ? isReturnedLabel(formatActivityStatus(resolveActivityStatusRaw(latest)))
    : false;
  const eventDates = [...pool]
    .map(activityStamp)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const pending = WAITING_ACTORS.find(
    (actor) => statuses[actor.key] === "pending",
  );

  let actor = "En este estado";
  if (latestReturned) {
    actor = "Devuelto";
  } else if (pending) {
    actor = pending.label;
  } else if (syllabusLoaded) {
    actor = "Syllabus listo";
  } else if (
    finalized ||
    WAITING_ACTORS.every(
      (item) => statuses[item.key] === "done" || statuses[item.key] === "na",
    )
  ) {
    actor = "Completado";
  }

  const days = deliverableElapsedDayCount({
    isSyllabus,
    returned: latestReturned,
    eventDates,
    processCreatedOn,
    syllabusCompletedOn: isSyllabus ? undefined : syllabusCompletedOn,
  });

  return formatActorElapsed(actor, days);
};

const guidKey = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/[{}]/g, "")
    .trim()
    .toLowerCase();

/** El host a veces devuelve el lookup como GUID suelto y a veces como objeto. */
const deliverableProcessId = (deliverable: Dev_tabledeliverables): string => {
  const row = deliverable as unknown as Record<string, unknown>;
  const direct = deliverable._dev_tablevirtualizationprocess_value?.trim();
  if (direct) return direct;
  const lookup = row.dev_tablevirtualizationprocess;
  if (typeof lookup === "string" && lookup.trim()) return lookup.trim();
  if (lookup && typeof lookup === "object") {
    const nested = lookup as { id?: unknown; value?: unknown };
    const id = nested.id ?? nested.value;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return "";
};

const resolvePerson = (
  assignRole: AssignRoleWithFormatted,
): { email: string; label: string } | null => {
  const email =
    assignRole.dev_person?.trim() ||
    (looksLikeEmail(assignRole.dev_username?.trim() ?? "")
      ? assignRole.dev_username!.trim()
      : "");
  if (!email) return null;

  const name = assignRole.dev_username?.trim() || "";
  const label =
    name && !looksLikeEmail(name) && name.toLowerCase() !== email.toLowerCase()
      ? name
      : email;

  return { email: email.toLowerCase(), label };
};

const getCurrentPhase = (
  phases: PhaseWithFormatted[],
  templatesMap?: Map<string, Dev_tableactivitytemplates>,
): string => {
  const lastPhase = [...phases].sort(
    (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
  )[0];

  const odata = lastPhase?.[
    "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
  ]?.trim();
  if (odata) return odata;

  const rawName = lastPhase?.dev_expectedactivitytemplatename?.trim();
  if (rawName) return rawName;

  const templateId = lastPhase?._dev_expectedactivitytemplate_value;
  if (templateId && templatesMap) {
    const templateName = templatesMap.get(templateId)?.dev_activityname?.trim();
    if (templateName) return templateName;
  }

  return lastPhase?.dev_namephase?.trim() || PROCESS_PHASES.UNKNOWN;
};

const isReturnedLabel = (label: string): boolean => {
  const normalized = normalizePhase(label);
  return (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  );
};

type ActorStatusSet = {
  leaderPre: ActorProgressCode;
  author: ActorProgressCode;
  validator: ActorProgressCode;
  advisor: ActorProgressCode;
  designer: ActorProgressCode;
  advisorAv: ActorProgressCode;
  leaderClassroom: ActorProgressCode;
};

const waitingPipeline = (): ActorStatusSet => ({
  leaderPre: "waiting",
  author: "waiting",
  validator: "waiting",
  advisor: "waiting",
  designer: "waiting",
  advisorAv: "waiting",
  leaderClassroom: "waiting",
});

const donePipeline = (): ActorStatusSet => ({
  leaderPre: "done",
  author: "done",
  validator: "done",
  advisor: "done",
  designer: "done",
  advisorAv: "done",
  leaderClassroom: "done",
});

/** La aprobación deja la actividad en Aprobado aunque la fase no avance. */
const isApprovedActivityStatus = (raw: string): boolean => {
  const label = normalizePhase(formatActivityStatus(raw));
  if (!label) return false;
  if (
    label.includes("no aprobado") ||
    label.includes("por aprobar") ||
    label.includes("corregir") ||
    label.includes("devuelto") ||
    label.includes("en proceso")
  ) {
    return false;
  }
  return label.includes("aprobado") || label === "terminado";
};

const sameActivityName = (left: string, right: string): boolean =>
  normalizePhase(left).replace(/\s+/g, " ") ===
  normalizePhase(right).replace(/\s+/g, " ");

const activityTemplateLabel = (
  activity: Dev_tableactivities,
  templatesMap?: Map<string, Dev_tableactivitytemplates>,
): string => {
  const named = activity.dev_tableactivitytemplatename?.trim();
  if (named) return named;

  const templateId = activity._dev_tableactivitytemplate_value;
  const fromMap = templateId
    ? templatesMap?.get(templateId)?.dev_activityname?.trim()
    : "";
  if (fromMap) return fromMap;

  return (activity.dev_activityname?.trim() ?? "").replace(/^estado\s+/i, "");
};

/**
 * Actor que el tablero muestra como pendiente mientras la fase no cambia.
 * La fase solo avanza cuando todos los obligatorios cierran ese paso.
 */
const pendingActorForPhase = (phase: string): keyof ActorStatusSet | null => {
  if (isLeaderSyllabusStatus(phase)) return "leaderPre";
  if (isClassroomConfirmPhase(phase)) return "leaderClassroom";
  if (
    matchPhase(phase, PROCESS_PHASES.ADVISOR_AV_APPROVAL) ||
    isAdvisorAudiovisualApprovalStatus(phase)
  ) {
    return "advisorAv";
  }
  if (matchPhase(phase, PROCESS_PHASES.DIDE_REVIEW)) return "designer";
  if (
    matchPhase(phase, PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD) ||
    isAdvisorGuideUploadStatus(phase) ||
    matchPhase(phase, PROCESS_PHASES.ADVISOR_REVIEW)
  ) {
    return "advisor";
  }
  if (matchPhase(phase, PROCESS_PHASES.VALIDATOR_REVIEW)) return "validator";
  if (matchPhase(phase, PROCESS_PHASES.AUTHOR_UPLOAD)) return "author";
  return null;
};

const isClassroomConfirmPhase = (phase: string): boolean => {
  if (!phase.trim()) return false;
  if (matchPhase(phase, VISUAL_CLASSROOM_UPLOAD_LABEL)) return false;
  return isLeaderClassroomConfirmStatus(phase);
};

/**
 * Avance por actor agrupado en macrofases del tablero de seguimiento:
 * Pre validación → Fase documental → Creación DIDE → Cargue en aula.
 */
const deriveActorStatuses = (
  phase: string,
  hasReturnedMaterial: boolean,
): ActorStatusSet => {
  if (isLeaderSyllabusStatus(phase)) {
    return { ...waitingPipeline(), leaderPre: "pending" };
  }

  if (matchPhase(phase, PROCESS_PHASES.COMPLETED)) {
    return donePipeline();
  }

  if (
    isClassroomConfirmPhase(phase) ||
    matchPhase(phase, VISUAL_CLASSROOM_UPLOAD_LABEL)
  ) {
    return { ...donePipeline(), leaderClassroom: "pending" };
  }

  if (
    matchPhase(phase, PROCESS_PHASES.ADVISOR_AV_APPROVAL) ||
    isAdvisorAudiovisualApprovalStatus(phase)
  ) {
    return {
      leaderPre: "done",
      author: "done",
      validator: "done",
      advisor: "done",
      designer: "done",
      advisorAv: "pending",
      leaderClassroom: "waiting",
    };
  }

  if (matchPhase(phase, PROCESS_PHASES.DIDE_REVIEW)) {
    return {
      leaderPre: "done",
      author: "done",
      validator: "done",
      advisor: "done",
      designer: "pending",
      advisorAv: "waiting",
      leaderClassroom: "waiting",
    };
  }

  if (
    matchPhase(phase, PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD) ||
    isAdvisorGuideUploadStatus(phase) ||
    matchPhase(phase, PROCESS_PHASES.ADVISOR_REVIEW)
  ) {
    return {
      leaderPre: "done",
      author: "done",
      validator: "done",
      advisor: "pending",
      designer: "waiting",
      advisorAv: "waiting",
      leaderClassroom: "waiting",
    };
  }

  if (matchPhase(phase, PROCESS_PHASES.VALIDATOR_REVIEW)) {
    return {
      leaderPre: "done",
      author: "done",
      validator: "pending",
      advisor: "waiting",
      designer: "waiting",
      advisorAv: "waiting",
      leaderClassroom: "waiting",
    };
  }

  if (matchPhase(phase, PROCESS_PHASES.AUTHOR_UPLOAD)) {
    const author: ActorProgressCode = hasReturnedMaterial
      ? "returned"
      : "pending";
    return {
      leaderPre: "done",
      author,
      validator: "waiting",
      advisor: "waiting",
      designer: "waiting",
      advisorAv: "waiting",
      leaderClassroom: "waiting",
    };
  }

  return {
    leaderPre: "na",
    author: "na",
    validator: "na",
    advisor: "na",
    designer: "na",
    advisorAv: "na",
    leaderClassroom: "na",
  };
};

/**
 * Si este entregable ya tiene la actividad de la fase en Aprobado,
 * el actor deja de verse pendiente aunque la fase siga igual
 * hasta que el resto de obligatorios termine.
 */
const applyRecordedApproval = (
  statuses: ActorStatusSet,
  phase: string,
  phaseId: string | undefined,
  activities: Dev_tableactivities[],
  templatesMap?: Map<string, Dev_tableactivitytemplates>,
): void => {
  const actor = pendingActorForPhase(phase);
  if (!actor || !phaseId || statuses[actor] !== "pending") return;

  const approved = activities.some((activity) => {
    if ((activity._dev_tablephase_value ?? "") !== phaseId) return false;
    if (!isApprovedActivityStatus(resolveActivityStatusRaw(activity))) {
      return false;
    }
    const template = activityTemplateLabel(activity, templatesMap);
    return Boolean(template) && sameActivityName(template, phase);
  });

  if (approved) statuses[actor] = "done";
};

const rollupActorStatus = (
  codes: ActorProgressCode[],
  fallback: ActorProgressCode,
): ActorProgressCode => {
  const relevant = codes.filter((code) => code !== "na");
  if (relevant.length === 0) return fallback;
  if (relevant.includes("returned")) return "returned";
  if (relevant.includes("pending")) return "pending";
  if (relevant.includes("done")) return "done";
  if (relevant.includes("waiting")) return "waiting";
  return fallback;
};

const formatActorLabels = (
  phase: string,
  statuses: ActorStatusSet,
  hasAuthorMaterial: boolean,
  hasReturnedMaterial: boolean,
): {
  leaderPreStatus: ActorProgressCode;
  leaderPreStatusLabel: string;
  authorStatus: ActorProgressCode;
  authorStatusLabel: string;
  validatorStatus: ActorProgressCode;
  validatorStatusLabel: string;
  advisorStatus: ActorProgressCode;
  advisorStatusLabel: string;
  designerStatus: ActorProgressCode;
  designerStatusLabel: string;
  advisorAvStatus: ActorProgressCode;
  advisorAvStatusLabel: string;
  leaderClassroomStatus: ActorProgressCode;
  leaderClassroomStatusLabel: string;
} => {
  let authorStatus = statuses.author;
  let authorStatusLabel = ACTOR_STATUS_LABELS[authorStatus];

  if (
    matchPhase(phase, PROCESS_PHASES.AUTHOR_UPLOAD) &&
    !hasAuthorMaterial &&
    !hasReturnedMaterial
  ) {
    authorStatus = "pending";
    authorStatusLabel = "Pendiente";
  } else if (
    authorStatus === "pending" &&
    matchPhase(phase, PROCESS_PHASES.AUTHOR_UPLOAD)
  ) {
    authorStatusLabel = "Pendiente";
  } else if (authorStatus === "returned") {
    authorStatusLabel = "Devuelto";
  }

  return {
    leaderPreStatus: statuses.leaderPre,
    leaderPreStatusLabel: ACTOR_STATUS_LABELS[statuses.leaderPre],
    authorStatus,
    authorStatusLabel,
    validatorStatus: statuses.validator,
    validatorStatusLabel: ACTOR_STATUS_LABELS[statuses.validator],
    advisorStatus: statuses.advisor,
    advisorStatusLabel: ACTOR_STATUS_LABELS[statuses.advisor],
    designerStatus: statuses.designer,
    designerStatusLabel: ACTOR_STATUS_LABELS[statuses.designer],
    advisorAvStatus: statuses.advisorAv,
    advisorAvStatusLabel: ACTOR_STATUS_LABELS[statuses.advisorAv],
    leaderClassroomStatus: statuses.leaderClassroom,
    leaderClassroomStatusLabel: ACTOR_STATUS_LABELS[statuses.leaderClassroom],
  };
};

const buildDeliverableTracking = (params: {
  deliverable: Dev_tabledeliverables;
  processPhases: PhaseWithFormatted[];
  activities: Dev_tableactivities[];
  templatesMap?: Map<string, Dev_tableactivitytemplates>;
  processCreatedOn: string;
  syllabusCompletedOn?: string;
  /** Proceso con close-ready: todos los entregables figuran finalizados. */
  processFinalized?: boolean;
  /** Ya existe la fase real de validación del cargue en el aula. */
  classroomPhaseOpen?: boolean;
}): DeliverableTrackingItem => {
  const {
    deliverable,
    processPhases,
    activities,
    templatesMap,
    processCreatedOn,
    syllabusCompletedOn,
    processFinalized = false,
    classroomPhaseOpen = false,
  } = params;
  const deliverableId = deliverable.dev_tabledeliverableid;
  const name = deliverable.dev_namedeliverable?.trim() || "Entregable";
  const creditNumber =
    typeof deliverable.dev_creditnumber === "number"
      ? deliverable.dev_creditnumber
      : Number(deliverable.dev_creditnumber) || 0;
  const isSyllabus = isSyllabusDeliverable({ name });

  const linkedPhases = processPhases.filter((phase) => {
    const phaseDeliverableId = phase._dev_tabledeliverable_value ?? "";
    if (phaseDeliverableId === deliverableId) return true;
    if (
      deliverable._dev_tablephasecurrent_value &&
      deliverable._dev_tablephasecurrent_value === phase.dev_tablephaseid
    ) {
      return true;
    }
    // Syllabus: fases sin deliverable (cargue con null).
    if (isSyllabus && !phaseDeliverableId) return true;
    return false;
  });

  const currentPhaseRecord = [...linkedPhases].sort(
    (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
  )[0];
  let phase = currentPhaseRecord
    ? getCurrentPhase([currentPhaseRecord], templatesMap)
    : PROCESS_PHASES.UNKNOWN;
  const phaseIds = new Set(linkedPhases.map((item) => item.dev_tablephaseid));
  const deliverableActivities = activities.filter((activity) =>
    phaseIds.has(activity._dev_tablephase_value ?? ""),
  );

  const hasAuthorMaterial = deliverableActivities.length > 0;
  const hasReturnedMaterial = deliverableActivities.some((activity) =>
    isReturnedLabel(formatActivityStatus(resolveActivityStatusRaw(activity))),
  );

  const settledActivities = deliverableActivities.filter(
    (activity) =>
      !isActivityProcessingStatus(resolveActivityStatusRaw(activity)),
  );
  let statuses = deriveActorStatuses(
    phase,
    hasReturnedMaterial,
  );
  // La fase sigue llamándose "Cargue Syllabus" después del cargue.
  // Solo si la actividad ya salió de "En proceso" el líder completó la pre validación.
  if (
    isSyllabus &&
    settledActivities.length > 0 &&
    isLeaderSyllabusStatus(phase)
  ) {
    statuses.leaderPre = "done";
  }
  // El syllabus no recorre autor, validador ni las demás aprobaciones.
  if (isSyllabus) {
    statuses.author = "na";
    statuses.validator = "na";
    statuses.advisor = "na";
    statuses.designer = "na";
    statuses.advisorAv = "na";
    statuses.leaderClassroom = "na";
  } else {
    applyRecordedApproval(
      statuses,
      phase,
      currentPhaseRecord?.dev_tablephaseid,
      deliverableActivities,
      templatesMap,
    );
  }
  let syllabusLoaded = isSyllabus && statuses.leaderPre === "done";
  const avApprovedAheadOfPhase =
    !isSyllabus &&
    statuses.advisorAv === "done" &&
    (matchPhase(phase, PROCESS_PHASES.ADVISOR_AV_APPROVAL) ||
      isAdvisorAudiovisualApprovalStatus(phase));
  const onClassroomStep =
    !isSyllabus &&
    (isClassroomConfirmPhase(phase) ||
      matchPhase(phase, VISUAL_CLASSROOM_UPLOAD_LABEL));
  const awaitingClassroomConfirm =
    onClassroomStep ||
    (!isSyllabus && classroomPhaseOpen && statuses.advisorAv === "done");
  if (awaitingClassroomConfirm) {
    statuses.leaderPre = "done";
    statuses.author = "done";
    statuses.validator = "done";
    statuses.advisor = "done";
    statuses.designer = "done";
    statuses.advisorAv = "done";
    statuses.leaderClassroom = "pending";
  }
  let displayPhase = syllabusLoaded
    ? "Syllabus listo"
    : awaitingClassroomConfirm
      ? PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM
      : avApprovedAheadOfPhase
        ? VISUAL_CLASSROOM_UPLOAD_LABEL
        : phase;
  let labels = formatActorLabels(
    phase,
    statuses,
    hasAuthorMaterial,
    hasReturnedMaterial,
  );

  if (processFinalized) {
    phase = PROCESS_PHASES.COMPLETED;
    statuses = deriveActorStatuses(phase, false);
    syllabusLoaded = false;
    displayPhase = phase;
    labels = formatActorLabels(phase, statuses, hasAuthorMaterial, false);
  }

  const phaseShort =
    processFinalized || syllabusLoaded
      ? displayPhase
      : awaitingClassroomConfirm
        ? PHASE_SHORT_LABELS[PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM]
        : avApprovedAheadOfPhase
          ? VISUAL_CLASSROOM_UPLOAD_LABEL
          : (PHASE_SHORT_LABELS[phase] ?? phase);

  return {
    id: deliverableId,
    name,
    creditNumber,
    creditLabel: creditLabelFor(creditNumber),
    phase: displayPhase,
    phaseShort,
    ...labels,
    activityCount: deliverableActivities.length,
    elapsedLabel: deliverableElapsedLabel({
      statuses,
      activities: deliverableActivities,
      processCreatedOn,
      syllabusCompletedOn,
      isSyllabus,
      syllabusLoaded,
      finalized: processFinalized,
    }),
  };
};

export const buildProcessTrackingRows = (params: {
  processes: Dev_tablevirtualizationprocesses[];
  courses: Dev_tablecourseinstances[];
  programs: Dev_table_programs[];
  faculties: Dev_table_faculties[];
  phases: Dev_tablephases[];
  activities: Dev_tableactivities[];
  deliverables: Dev_tabledeliverables[];
  activityTemplates?: Dev_tableactivitytemplates[];
  assignRoles: AssignRoleWithFormatted[];
  userEmail: string;
  userRole: string;
}): ProcessTrackingRow[] => {
  const {
    processes,
    courses,
    programs,
    faculties,
    phases,
    activities,
    deliverables,
    activityTemplates,
    assignRoles,
    userEmail,
    userRole,
  } = params;

  const templatesMap = activityTemplates
    ? new Map(
        activityTemplates.map((template) => [
          template.dev_tableactivitytemplateid,
          template,
        ]),
      )
    : undefined;

  const coursesMap = new Map(
    courses.map((course) => [course.dev_tablecourseinstanceid, course]),
  );
  const programsMap = new Map(
    programs.map((program) => [program.dev_table_programid, program]),
  );
  const facultiesMap = new Map(
    faculties.map((faculty) => [faculty.dev_table_facultyid, faculty]),
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
    const state = Number(deliverable.statecode);
    if (Number.isFinite(state) && state !== 0) continue;
    const processId = guidKey(deliverableProcessId(deliverable));
    if (!processId) continue;
    const current = deliverablesByProcess.get(processId) ?? [];
    current.push(deliverable);
    deliverablesByProcess.set(processId, current);
  }

  const assigneesByProcess = new Map<
    string,
    {
      author?: { email: string; label: string };
      validator?: { email: string; label: string };
      advisor?: { email: string; label: string };
      designer?: { email: string; label: string };
      leader?: { email: string; label: string };
    }
  >();

  for (const assignRole of assignRoles) {
    const processId = assignRole._dev_tablevirtualizationprocess_value ?? "";
    if (!processId) continue;

    const roleName =
      assignRole[
        "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
      ]?.trim() ||
      assignRole.dev_tablerolename?.trim() ||
      "";
    const person = resolvePerson(assignRole);
    if (!person) continue;

    const canonical = canonicalizeUserRole(roleName);
    const current = assigneesByProcess.get(processId) ?? {};

    if (canonical === USER_ROLES.AUTHOR) current.author = person;
    if (canonical === USER_ROLES.VALIDATOR) current.validator = person;
    if (canonical === USER_ROLES.ADVISOR) current.advisor = person;
    if (canonical === USER_ROLES.DIDE_DESIGNER) current.designer = person;
    if (canonical === USER_ROLES.LEADER) current.leader = person;

    assigneesByProcess.set(processId, current);
  }

  const email = userEmail.trim().toLowerCase();
  const globalScope = isLeaderRole(userRole);
  const advisorScope = isAdvisorRole(userRole);
  const assignedLeaderScope = isVirtualizationLeaderRole(userRole);

  const detailPathFor = (processId: string) =>
    globalScope
      ? `/virtualization-processes/${processId}`
      : `/courses/${processId}`;

  return processes
    .filter((process) => isActiveDataverseRecord(process.statecode))
    .map((process) => {
      const processId = process.dev_tablevirtualizationprocessid;
      const assignees = assigneesByProcess.get(processId) ?? {};

      if (advisorScope && !globalScope) {
        if (assignees.advisor?.email !== email) return null;
      }

      if (assignedLeaderScope && assignees.leader?.email !== email) {
        return null;
      }

      const course = coursesMap.get(process._dev_tablecourse_value ?? "");
      const program = programsMap.get(course?._dev_tableprogram_value ?? "");
      const faculty = facultiesMap.get(program?._dev_table_faculty_value ?? "");
      const processPhases = phasesByProcess.get(processId) ?? [];
      const phaseFromActivities = getCurrentPhase(processPhases, templatesMap);
      const processClosed = isProcessCloseReady(
        process.dev_closeready,
        process.dev_closereadyname,
      );
      const classroomPhaseOpen =
        !processClosed &&
        processPhases.some((item) => {
          const phaseName = item.dev_namephase?.trim() ?? "";
          const templateName = item.dev_tablephasetemplatename?.trim() ?? "";
          const expected = getCurrentPhase([item], templatesMap);
          return (
            isClassroomConfirmPhase(phaseName) ||
            isClassroomConfirmPhase(templateName) ||
            isClassroomConfirmPhase(expected)
          );
        });
      const phase = processClosed
        ? PROCESS_PHASES.COMPLETED
        : phaseFromActivities;
      const phaseIds = new Set(
        processPhases.map((item) => item.dev_tablephaseid),
      );

      const processActivities = activities.filter((activity) =>
        phaseIds.has(activity._dev_tablephase_value ?? ""),
      );

      const materialCount = processActivities.length;
      const hasAuthorMaterial = materialCount > 0;
      const hasReturnedMaterial = processActivities.some((activity) =>
        isReturnedLabel(
          formatActivityStatus(resolveActivityStatusRaw(activity)),
        ),
      );

      const statuses = deriveActorStatuses(
        phase,
        hasReturnedMaterial,
      );

      const ownedDeliverables =
        deliverablesByProcess.get(guidKey(processId)) ?? [];
      const syllabusDeliverable = ownedDeliverables.find((item) =>
        isSyllabusDeliverable({
          name: item.dev_namedeliverable?.trim() || "",
        }),
      );
      const syllabusPhaseIds = new Set(
        processPhases
          .filter((item) => {
            const linked = item._dev_tabledeliverable_value ?? "";
            if (
              syllabusDeliverable &&
              linked === syllabusDeliverable.dev_tabledeliverableid
            ) {
              return true;
            }
            return Boolean(syllabusDeliverable) && !linked;
          })
          .map((item) => item.dev_tablephaseid),
      );
      const syllabusCompletedOn =
        [...processActivities]
          .filter((activity) =>
            syllabusPhaseIds.has(activity._dev_tablephase_value ?? ""),
          )
          .map(activityStamp)
          .filter(Boolean)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ??
        "";

      const processDeliverables = ownedDeliverables
        .map((deliverable) =>
          buildDeliverableTracking({
            deliverable,
            processPhases,
            activities,
            templatesMap,
            processCreatedOn: process.createdon ?? "",
            syllabusCompletedOn,
            processFinalized: processClosed,
            classroomPhaseOpen,
          }),
        )
        .sort((a, b) => {
          if (a.creditNumber !== b.creditNumber) {
            return a.creditNumber - b.creditNumber;
          }
          return a.name.localeCompare(b.name, "es");
        });

      const rolled: ActorStatusSet = {
        leaderPre: rollupActorStatus(
          processDeliverables.map((item) => item.leaderPreStatus),
          statuses.leaderPre,
        ),
        author: rollupActorStatus(
          processDeliverables.map((item) => item.authorStatus),
          statuses.author,
        ),
        validator: rollupActorStatus(
          processDeliverables.map((item) => item.validatorStatus),
          statuses.validator,
        ),
        advisor: rollupActorStatus(
          processDeliverables.map((item) => item.advisorStatus),
          statuses.advisor,
        ),
        designer: rollupActorStatus(
          processDeliverables.map((item) => item.designerStatus),
          statuses.designer,
        ),
        advisorAv: rollupActorStatus(
          processDeliverables.map((item) => item.advisorAvStatus),
          statuses.advisorAv,
        ),
        leaderClassroom: rollupActorStatus(
          processDeliverables.map((item) => item.leaderClassroomStatus),
          statuses.leaderClassroom,
        ),
      };
      const labels = formatActorLabels(
        phase,
        processDeliverables.length > 0 ? rolled : statuses,
        hasAuthorMaterial,
        hasReturnedMaterial,
      );

      const modifiedOn =
        getLatestDate(
          process.modifiedon,
          ...processPhases.map((item) => item.modifiedon ?? item.createdon),
          ...processActivities.map(
            (item) => item.modifiedon ?? item.createdon,
          ),
        ) ?? "";

      return {
        processId,
        processName: process.dev_nameprocess?.trim() || "Sin nombre",
        courseName: course?.dev_namecourse?.trim() || "Sin curso",
        facultyName: faculty?.dev_namefaculty?.trim() || "—",
        programName: program?.dev_nameprogram?.trim() || "—",
        semester: resolveProcessSemester(
          process.dev_nameprocess ?? "",
          process.createdon,
        ),
        createdOn: process.createdon ?? "",
        phase,
        phaseShort: PHASE_SHORT_LABELS[phase] ?? phase,
        authorEmail: assignees.author?.email ?? "",
        authorLabel: assignees.author?.label ?? "Sin asignar",
        ...labels,
        validatorEmail: assignees.validator?.email ?? "",
        validatorLabel: assignees.validator?.label ?? "Sin asignar",
        advisorEmail: assignees.advisor?.email ?? "",
        advisorLabel: assignees.advisor?.label ?? "Sin asignar",
        designerEmail: assignees.designer?.email ?? "",
        designerLabel: assignees.designer?.label ?? "Sin asignar",
        needsDesignerAssignment:
          !processClosed && !assignees.designer?.email,
        isFinalized: processClosed,
        materialCount,
        modifiedOn,
        detailPath: detailPathFor(processId),
        deliverables: processDeliverables,
        elapsedLabel: processElapsedLabel(
          process.createdon ?? "",
          processClosed ? modifiedOn : undefined,
        ),
      } satisfies ProcessTrackingRow;
    })
    .filter((row): row is ProcessTrackingRow => row !== null)
    .sort(
      (a, b) =>
        new Date(b.modifiedOn).getTime() - new Date(a.modifiedOn).getTime(),
    );
};

export const buildTrackingSummary = (
  rows: ProcessTrackingRow[],
): ProcessTrackingSummary => ({
  total: rows.length,
  authorPending: rows.filter(
    (row) => row.authorStatus === "pending" || row.authorStatus === "returned",
  ).length,
  authorReturned: rows.filter((row) => row.authorStatus === "returned").length,
  validatorPending: rows.filter((row) => row.validatorStatus === "pending")
    .length,
  advisorPending: rows.filter(
    (row) =>
      row.advisorStatus === "pending" || row.advisorAvStatus === "pending",
  ).length,
  completed: rows.filter((row) =>
    matchPhase(row.phase, PROCESS_PHASES.COMPLETED),
  ).length,
});
