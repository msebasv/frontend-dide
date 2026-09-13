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
  canonicalizeUserRole,
  isLeaderRole,
} from "../../global/constants/domainConstants";
import { getLatestDate, getRecordTimestamp } from "../../global/utils/dateUtils";
import {
  formatActivityStatus,
  isAdvisorRole,
  isLeaderSyllabusStatus,
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

const normalizePhase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

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
  creditNumber === 0 ? "General" : `Crédito / Unidad ${creditNumber}`;

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

const deriveActorStatuses = (
  phase: string,
  hasAuthorMaterial: boolean,
  hasReturnedMaterial: boolean,
): {
  author: ActorProgressCode;
  validator: ActorProgressCode;
  advisor: ActorProgressCode;
} => {
  if (isLeaderSyllabusStatus(phase)) {
    return { author: "waiting", validator: "waiting", advisor: "waiting" };
  }

  if (matchPhase(phase, PROCESS_PHASES.COMPLETED)) {
    return { author: "done", validator: "done", advisor: "done" };
  }

  if (matchPhase(phase, PROCESS_PHASES.DIDE_REVIEW)) {
    return { author: "done", validator: "done", advisor: "done" };
  }

  if (matchPhase(phase, PROCESS_PHASES.ADVISOR_REVIEW)) {
    return { author: "done", validator: "done", advisor: "pending" };
  }

  if (matchPhase(phase, PROCESS_PHASES.VALIDATOR_REVIEW)) {
    return { author: "done", validator: "pending", advisor: "waiting" };
  }

  if (matchPhase(phase, PROCESS_PHASES.AUTHOR_UPLOAD)) {
    if (hasReturnedMaterial) {
      return { author: "returned", validator: "waiting", advisor: "waiting" };
    }
    if (hasAuthorMaterial) {
      return { author: "pending", validator: "waiting", advisor: "waiting" };
    }
    return { author: "pending", validator: "waiting", advisor: "waiting" };
  }

  return { author: "na", validator: "na", advisor: "na" };
};

const formatActorLabels = (
  phase: string,
  statuses: ReturnType<typeof deriveActorStatuses>,
  hasAuthorMaterial: boolean,
  hasReturnedMaterial: boolean,
): {
  authorStatus: ActorProgressCode;
  authorStatusLabel: string;
  validatorStatus: ActorProgressCode;
  validatorStatusLabel: string;
  advisorStatus: ActorProgressCode;
  advisorStatusLabel: string;
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
    authorStatus,
    authorStatusLabel,
    validatorStatus: statuses.validator,
    validatorStatusLabel: ACTOR_STATUS_LABELS[statuses.validator],
    advisorStatus: statuses.advisor,
    advisorStatusLabel: ACTOR_STATUS_LABELS[statuses.advisor],
  };
};

const buildDeliverableTracking = (params: {
  deliverable: Dev_tabledeliverables;
  processPhases: PhaseWithFormatted[];
  activities: Dev_tableactivities[];
  templatesMap?: Map<string, Dev_tableactivitytemplates>;
}): DeliverableTrackingItem => {
  const { deliverable, processPhases, activities, templatesMap } = params;
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

  const phase = linkedPhases.length
    ? getCurrentPhase(linkedPhases, templatesMap)
    : PROCESS_PHASES.UNKNOWN;
  const phaseIds = new Set(linkedPhases.map((item) => item.dev_tablephaseid));
  const deliverableActivities = activities.filter((activity) =>
    phaseIds.has(activity._dev_tablephase_value ?? ""),
  );

  const hasAuthorMaterial = deliverableActivities.length > 0;
  const hasReturnedMaterial = deliverableActivities.some((activity) =>
    isReturnedLabel(formatActivityStatus(resolveActivityStatusRaw(activity))),
  );

  const statuses = deriveActorStatuses(
    phase,
    hasAuthorMaterial,
    hasReturnedMaterial,
  );
  const labels = formatActorLabels(
    phase,
    statuses,
    hasAuthorMaterial,
    hasReturnedMaterial,
  );

  return {
    id: deliverableId,
    name,
    creditNumber,
    creditLabel: creditLabelFor(creditNumber),
    phase,
    phaseShort: PHASE_SHORT_LABELS[phase] ?? phase,
    ...labels,
    activityCount: deliverableActivities.length,
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
    if (deliverable.statecode !== 0) continue;
    const processId =
      deliverable._dev_tablevirtualizationprocess_value?.trim() ?? "";
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

    assigneesByProcess.set(processId, current);
  }

  const email = userEmail.trim().toLowerCase();
  const globalScope = isLeaderRole(userRole);
  const advisorScope = isAdvisorRole(userRole);

  const detailPathFor = (processId: string) =>
    globalScope
      ? `/virtualization-processes/${processId}`
      : `/courses/${processId}`;

  return processes
    .map((process) => {
      const processId = process.dev_tablevirtualizationprocessid;
      const assignees = assigneesByProcess.get(processId) ?? {};

      if (advisorScope && !globalScope) {
        if (assignees.advisor?.email !== email) return null;
      }

      const course = coursesMap.get(process._dev_tablecourse_value ?? "");
      const program = programsMap.get(course?._dev_tableprogram_value ?? "");
      const faculty = facultiesMap.get(program?._dev_table_faculty_value ?? "");
      const processPhases = phasesByProcess.get(processId) ?? [];
      const phase = getCurrentPhase(processPhases, templatesMap);
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
        hasAuthorMaterial,
        hasReturnedMaterial,
      );
      const labels = formatActorLabels(
        phase,
        statuses,
        hasAuthorMaterial,
        hasReturnedMaterial,
      );

      const processDeliverables = (
        deliverablesByProcess.get(processId) ?? []
      )
        .map((deliverable) =>
          buildDeliverableTracking({
            deliverable,
            processPhases,
            activities,
            templatesMap,
          }),
        )
        .sort((a, b) => {
          if (a.creditNumber !== b.creditNumber) {
            return a.creditNumber - b.creditNumber;
          }
          return a.name.localeCompare(b.name, "es");
        });

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
        phase,
        phaseShort: PHASE_SHORT_LABELS[phase] ?? phase,
        authorEmail: assignees.author?.email ?? "",
        authorLabel: assignees.author?.label ?? "Sin asignar",
        ...labels,
        validatorEmail: assignees.validator?.email ?? "",
        validatorLabel: assignees.validator?.label ?? "Sin asignar",
        advisorEmail: assignees.advisor?.email ?? "",
        advisorLabel: assignees.advisor?.label ?? "Sin asignar",
        materialCount,
        modifiedOn,
        detailPath: detailPathFor(processId),
        deliverables: processDeliverables,
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
  advisorPending: rows.filter((row) => row.advisorStatus === "pending").length,
  completed: rows.filter((row) =>
    matchPhase(row.phase, PROCESS_PHASES.COMPLETED),
  ).length,
});
