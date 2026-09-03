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

import {
  PHASE_SHORT_LABELS,
  PROCESS_PHASES,
  USER_ROLES,
  canonicalizeUserRole,
  isLeaderRole,
} from "../../global/constants/domainConstants";
import { getLatestDate } from "../../global/utils/dateUtils";
import {
  formatActivityStatus,
  isAdvisorRole,
  resolveActivityStatusRaw,
} from "../../courses/mappers/courseMappers";
import type {
  ActorProgressCode,
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
  done: "Listo",
  returned: "Devuelto",
  waiting: "Aún no le toca",
  na: "—",
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

const getCurrentPhase = (phases: PhaseWithFormatted[]): string => {
  const lastPhase = [...phases].sort(
    (a, b) =>
      new Date(b.createdon ?? "").getTime() -
      new Date(a.createdon ?? "").getTime(),
  )[0];

  return (
    lastPhase?.[
      "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
    ]?.trim() ||
    lastPhase?.dev_expectedactivitytemplatename?.trim() ||
    PROCESS_PHASES.UNKNOWN
  );
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

export const buildProcessTrackingRows = (params: {
  processes: Dev_tablevirtualizationprocesses[];
  courses: Dev_tablecourseinstances[];
  programs: Dev_table_programs[];
  faculties: Dev_table_faculties[];
  phases: Dev_tablephases[];
  activities: Dev_tableactivities[];
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
    assignRoles,
    userEmail,
    userRole,
  } = params;

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
      const phase = getCurrentPhase(processPhases);
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

      // En fase de autor sin materiales: etiqueta más explícita
      let authorStatus = statuses.author;
      let authorStatusLabel = ACTOR_STATUS_LABELS[authorStatus];
      if (
        matchPhase(phase, PROCESS_PHASES.AUTHOR_UPLOAD) &&
        !hasAuthorMaterial &&
        !hasReturnedMaterial
      ) {
        authorStatus = "pending";
        authorStatusLabel = "Sin cargar";
      } else if (authorStatus === "pending" && matchPhase(phase, PROCESS_PHASES.AUTHOR_UPLOAD)) {
        authorStatusLabel = "Pendiente de cargar";
      } else if (authorStatus === "returned") {
        authorStatusLabel = "Devuelto / debe recargar";
      } else if (
        authorStatus === "pending" &&
        matchPhase(phase, PROCESS_PHASES.VALIDATOR_REVIEW)
      ) {
        authorStatusLabel = ACTOR_STATUS_LABELS.pending;
      }

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
        authorStatus,
        authorStatusLabel,
        validatorEmail: assignees.validator?.email ?? "",
        validatorLabel: assignees.validator?.label ?? "Sin asignar",
        validatorStatus: statuses.validator,
        validatorStatusLabel:
          statuses.validator === "pending"
            ? "Pendiente de revisar"
            : ACTOR_STATUS_LABELS[statuses.validator],
        advisorEmail: assignees.advisor?.email ?? "",
        advisorLabel: assignees.advisor?.label ?? "Sin asignar",
        advisorStatus: statuses.advisor,
        advisorStatusLabel:
          statuses.advisor === "pending"
            ? "Pendiente de asesorar"
            : ACTOR_STATUS_LABELS[statuses.advisor],
        materialCount,
        modifiedOn,
        detailPath: detailPathFor(processId),
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
