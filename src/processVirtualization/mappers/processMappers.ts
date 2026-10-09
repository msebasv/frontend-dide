/**
 * Mappers del módulo de procesos de virtualización (vista global del líder).
 *
 * Transforma todos los procesos del entorno en VirtualizationProcess[],
 * enriquecidos con curso, programa, facultad, fase actual, roles y modifiedOn.
 */
import type { Dev_tablevirtualizationprocesses } from "../../generated/models/Dev_tablevirtualizationprocessesModel";
import type { Dev_tablecourseinstances } from "../../generated/models/Dev_tablecourseinstancesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import type { Dev_tableactivities } from "../../generated/models/Dev_tableactivitiesModel";
import type { Dev_tableassignroles } from "../../generated/models/Dev_tableassignrolesModel";
import type { Dev_tabledeliverables } from "../../generated/models/Dev_tabledeliverablesModel";
import type { Dev_tableactivitytemplates } from "../../generated/models/Dev_tableactivitytemplatesModel";
import type { Dev_tablecategorytemplates } from "../../generated/models/Dev_tablecategorytemplatesModel";

import type { VirtualizationProcess } from "../types/process.types";
import { buildProcessPhaseBreakdown } from "../../courses/utils/phaseBreakdown";
import { getLatestDate, getRecordTimestamp } from "../../global/utils/dateUtils";
import { resolveProcessSemester } from "../../global/utils/semesterUtils";
import {
  canonicalizeUserRole,
  isProcessCloseReady,
  PROCESS_PHASES,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import {
  isLeaderClassroomConfirmStatus,
  isLeaderSyllabusStatus,
} from "../../courses/mappers/courseMappers";
import { isActiveDataverseRecord } from "../../global/utils/dataverseState";

type AssignRoleWithFormatted = Dev_tableassignroles & {
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
};

const guidKey = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/[{}]/g, "")
    .trim()
    .toLowerCase();

/** El host a veces devuelve el lookup como GUID y a veces como objeto. */
const lookupGuid = (
  record: object,
  valueKey: string,
  objectKey: string,
): string => {
  const row = record as Record<string, unknown>;
  const direct = row[valueKey];
  if (typeof direct === "string" && direct.trim()) return guidKey(direct);
  const lookup = row[objectKey];
  if (typeof lookup === "string" && lookup.trim()) return guidKey(lookup);
  if (lookup && typeof lookup === "object") {
    const nested = lookup as { id?: unknown; value?: unknown };
    const id = nested.id ?? nested.value;
    if (typeof id === "string" && id.trim()) return guidKey(id);
  }
  return "";
};

interface MapperParams {
  processes: Dev_tablevirtualizationprocesses[];
  courses: Dev_tablecourseinstances[];
  programs: Dev_table_programs[];
  faculties: Dev_table_faculties[];
  phases: Dev_tablephases[];
  activities: Dev_tableactivities[];
  assignRoles?: AssignRoleWithFormatted[];
  /** Entregables activos: permiten mostrar el avance por estado, no solo la fase. */
  deliverables?: Dev_tabledeliverables[];
  activityTemplates?: Dev_tableactivitytemplates[];
  categoryTemplates?: Dev_tablecategorytemplates[];
}

interface AssignedPerson {
  email: string;
  label: string;
}

interface ProcessAssignees {
  author?: AssignedPerson;
  validator?: AssignedPerson;
  advisor?: AssignedPerson;
  leader?: AssignedPerson;
  designer?: AssignedPerson;
}

const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const toAssignedPerson = (
  assignRole: AssignRoleWithFormatted,
): AssignedPerson | null => {
  const email =
    assignRole.dev_person?.trim() ||
    (looksLikeEmail(assignRole.dev_username?.trim() ?? "")
      ? assignRole.dev_username!.trim()
      : "");
  if (!email) return null;

  const name = assignRole.dev_username?.trim() || "";
  const label =
    name && !looksLikeEmail(name) && name !== email
      ? `${name} (${email})`
      : email;

  return { email: email.toLowerCase(), label };
};

const buildAssigneesByProcess = (
  assignRoles: AssignRoleWithFormatted[],
): Map<string, ProcessAssignees> => {
  const byProcess = new Map<string, ProcessAssignees>();

  for (const assignRole of assignRoles) {
    const processId = assignRole._dev_tablevirtualizationprocess_value ?? "";
    if (!processId) continue;

    const roleName =
      assignRole[
        "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
      ]?.trim() ||
      assignRole.dev_tablerolename?.trim() ||
      "";
    if (!roleName) continue;

    const person = toAssignedPerson(assignRole);
    if (!person) continue;

    const canonical = canonicalizeUserRole(roleName);
    const current = byProcess.get(processId) ?? {};

    if (canonical === USER_ROLES.AUTHOR) {
      current.author = person;
    } else if (canonical === USER_ROLES.VALIDATOR) {
      current.validator = person;
    } else if (canonical === USER_ROLES.ADVISOR) {
      current.advisor = person;
    } else if (canonical === USER_ROLES.LEADER) {
      current.leader = person;
    } else if (canonical === USER_ROLES.DIDE_DESIGNER) {
      current.designer = person;
    }

    byProcess.set(processId, current);
  }

  return byProcess;
};

export const mapVirtualizationProcesses = ({
  processes,
  courses,
  programs,
  faculties,
  phases,
  activities,
  assignRoles = [],
  deliverables = [],
  activityTemplates = [],
  categoryTemplates = [],
  recordState = "active",
}: MapperParams & {
  recordState?: "active" | "inactive";
}): VirtualizationProcess[] => {
  const coursesMap = new Map(
    courses.flatMap((course) => {
      const id = guidKey(course.dev_tablecourseinstanceid);
      return id ? [[id, course] as const] : [];
    }),
  );

  const programsMap = new Map(
    programs.flatMap((program) => {
      const id = guidKey(program.dev_table_programid);
      return id ? [[id, program] as const] : [];
    }),
  );

  const facultiesMap = new Map(
    faculties.flatMap((faculty) => {
      const id = guidKey(faculty.dev_table_facultyid);
      return id ? [[id, faculty] as const] : [];
    }),
  );

  const assigneesByProcess = buildAssigneesByProcess(assignRoles);

  const requiredByCategoryId = new Map(
    categoryTemplates.map((category) => [
      guidKey(category.dev_tablecategorytemplateid),
      Boolean(category.dev_isrequired),
    ]),
  );

  const templatesMap = new Map(
    activityTemplates.map((template) => [
      template.dev_tableactivitytemplateid,
      template,
    ]),
  );

  const deliverablesByProcess = new Map<string, Dev_tabledeliverables[]>();
  for (const deliverable of deliverables) {
    const processId = lookupGuid(
      deliverable,
      "_dev_tablevirtualizationprocess_value",
      "dev_tablevirtualizationprocess",
    );
    if (!processId) continue;
    const list = deliverablesByProcess.get(processId) ?? [];
    list.push(deliverable);
    deliverablesByProcess.set(processId, list);
  }

  const phasesByProcess = new Map<string, Dev_tablephases[]>();

  for (const phase of phases) {
    const processId = phase._dev_tablevirtualizationprocess_value;

    if (!processId) continue;

    const current = phasesByProcess.get(processId) ?? [];

    current.push(phase);

    phasesByProcess.set(processId, current);
  }

  const wantInactive = recordState === "inactive";

  return processes
    .filter((process) => {
      const active = isActiveDataverseRecord(process.statecode);
      return wantInactive ? !active : active;
    })
    .map((process) => {
      const course = coursesMap.get(
        lookupGuid(process, "_dev_tablecourse_value", "dev_tablecourse"),
      );

      const program = course
        ? programsMap.get(
            lookupGuid(course, "_dev_tableprogram_value", "dev_tableprogram"),
          )
        : undefined;

      const faculty = program
        ? facultiesMap.get(
            lookupGuid(
              program,
              "_dev_table_faculty_value",
              "dev_table_faculty",
            ),
          )
        : undefined;

      type PhaseWithFormattedValue = Dev_tablephases & {
        "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
      };

      const processPhases =
        (phasesByProcess.get(
          process.dev_tablevirtualizationprocessid,
        ) as PhaseWithFormattedValue[]) ?? [];

      const lastPhase = [...processPhases].sort(
        (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
      )[0];

      const activityName =
        lastPhase?.[
          "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
        ]?.trim() ||
        lastPhase?.dev_expectedactivitytemplatename?.trim() ||
        lastPhase?.dev_namephase?.trim() ||
        "";

      const processClosed = isProcessCloseReady(
        process.dev_closeready,
        process.dev_closereadyname,
      );
      const resolvedStatus = processClosed
        ? PROCESS_PHASES.COMPLETED
        : activityName;

      const processId = process.dev_tablevirtualizationprocessid;
      const processDeliverables =
        deliverablesByProcess.get(guidKey(processId)) ?? [];
      const phaseIds = new Set(
        processPhases.map((phase) => phase.dev_tablephaseid),
      );
      const processActivities = activities.filter((activity) =>
        phaseIds.has(activity._dev_tablephase_value ?? ""),
      );

      const modifiedOn = getLatestDate(
        process.modifiedon,
        ...processPhases.flatMap((phase) => [
          phase.modifiedon,
          phase.createdon,
        ]),
        ...processActivities.flatMap((activity) => [
          activity.modifiedon,
          activity.createdon,
        ]),
      );

      const assignees = assigneesByProcess.get(processId);

      const phaseBreakdown = processDeliverables.length
        ? buildProcessPhaseBreakdown({
            processStatus: resolvedStatus,
            deliverables: processDeliverables,
            phases: processPhases,
            templatesMap,
            requiredByCategoryId,
          })
        : undefined;

      return {
        processId,
        processName: process.dev_nameprocess ?? "",
        courseName: course?.dev_namecourse ?? "",
        programName:
          program?.dev_nameprogram?.trim() ||
          course?.dev_tableprogramname?.trim() ||
          "",
        facultyName:
          faculty?.dev_namefaculty?.trim() ||
          program?.dev_table_facultyname?.trim() ||
          "",
        status: resolvedStatus,
        modifiedOn,
        createdOn: process.createdon ?? "",
        semester: resolveProcessSemester(
          process.dev_nameprocess ?? "",
          process.createdon,
        ),
        authorEmail: assignees?.author?.email ?? "",
        authorLabel: assignees?.author?.label ?? "",
        validatorEmail: assignees?.validator?.email ?? "",
        validatorLabel: assignees?.validator?.label ?? "",
        advisorEmail: assignees?.advisor?.email ?? "",
        advisorLabel: assignees?.advisor?.label ?? "",
        leaderEmail: assignees?.leader?.email ?? "",
        leaderLabel: assignees?.leader?.label ?? "",
        designerEmail: assignees?.designer?.email ?? "",
        designerLabel: assignees?.designer?.label ?? "",
        canUploadSyllabus:
          !wantInactive &&
          !processClosed &&
          isLeaderSyllabusStatus(activityName) &&
          Boolean(assignees?.validator?.email),
        needsValidatorAssignment:
          !wantInactive &&
          !processClosed &&
          isLeaderSyllabusStatus(activityName) &&
          !assignees?.validator?.email,
        /**
         * true si aún no hay Diseñador DIDE: el coordinador puede asignarlo
         * en cualquier momento (no está atado a una fase).
         */
        needsDesignerAssignment:
          !wantInactive && !processClosed && !assignees?.designer?.email,
        canConfirmClassroom:
          !wantInactive &&
          !processClosed &&
          isLeaderClassroomConfirmStatus(activityName),
        isDeleted: wantInactive,
        phaseBreakdown,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.modifiedOn).getTime() - new Date(a.modifiedOn).getTime(),
    );
};
