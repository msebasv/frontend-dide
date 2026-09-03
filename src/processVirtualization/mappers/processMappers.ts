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

import type { VirtualizationProcess } from "../types/process.types";
import { getLatestDate } from "../../global/utils/dateUtils";
import { resolveProcessSemester } from "../../global/utils/semesterUtils";
import {
  canonicalizeUserRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";

type AssignRoleWithFormatted = Dev_tableassignroles & {
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
};

interface MapperParams {
  processes: Dev_tablevirtualizationprocesses[];
  courses: Dev_tablecourseinstances[];
  programs: Dev_table_programs[];
  faculties: Dev_table_faculties[];
  phases: Dev_tablephases[];
  activities: Dev_tableactivities[];
  assignRoles?: AssignRoleWithFormatted[];
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
}: MapperParams): VirtualizationProcess[] => {
  const coursesMap = new Map(
    courses.map((course) => [course.dev_tablecourseinstanceid, course]),
  );

  const programsMap = new Map(
    programs.map((program) => [program.dev_table_programid, program]),
  );

  const facultiesMap = new Map(
    faculties.map((faculty) => [faculty.dev_table_facultyid, faculty]),
  );

  const assigneesByProcess = buildAssigneesByProcess(assignRoles);

  const phasesByProcess = new Map<string, Dev_tablephases[]>();

  for (const phase of phases) {
    const processId = phase._dev_tablevirtualizationprocess_value;

    if (!processId) continue;

    const current = phasesByProcess.get(processId) ?? [];

    current.push(phase);

    phasesByProcess.set(processId, current);
  }

  return processes
    .map((process) => {
      const course = coursesMap.get(process._dev_tablecourse_value ?? "");

      const program = programsMap.get(course?._dev_tableprogram_value ?? "");

      const faculty = facultiesMap.get(program?._dev_table_faculty_value ?? "");

      type PhaseWithFormattedValue = Dev_tablephases & {
        "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
      };

      const processPhases =
        (phasesByProcess.get(
          process.dev_tablevirtualizationprocessid,
        ) as PhaseWithFormattedValue[]) ?? [];

      const lastPhase = [...processPhases].sort(
        (a, b) =>
          new Date(b.createdon ?? "").getTime() -
          new Date(a.createdon ?? "").getTime(),
      )[0];

      const activityName =
        lastPhase?.[
          "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
        ] ?? "";

      const processId = process.dev_tablevirtualizationprocessid;
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

      return {
        processId,
        processName: process.dev_nameprocess ?? "",
        courseName: course?.dev_namecourse ?? "",
        programName: program?.dev_nameprogram ?? "",
        facultyName: faculty?.dev_namefaculty ?? "",
        status: activityName,
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
      };
    })
    .sort(
      (a, b) =>
        new Date(b.modifiedOn).getTime() - new Date(a.modifiedOn).getTime(),
    );
};
