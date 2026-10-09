/**
 * Consultas de cursos/procesos (sin mutaciones).
 * Re-exportado desde courseService.ts para compatibilidad.
 */
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitiesService } from "../../generated/services/Dev_tableactivitiesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";
import { Dev_tablerolesService } from "../../generated/services/Dev_tablerolesService";
import { escapeODataString } from "../../global/utils/inputValidation";
import {
  mapCoursesForUser,
  mapCourseDetail,
} from "../mappers/courseMappers";
import { resolveProcessRoleIds } from "../utils/roleUtils";
import type { Course, CourseDetail } from "../types/course.types";
import type { ProcessEditData } from "../../processVirtualization/types/process.types";
import { isProcessCloseReady } from "../../global/constants/domainConstants";
import { isActiveDataverseRecord } from "../../global/utils/dataverseState";

const fetchBaseData = async () => {
  const [
    assignRolesResult,
    processesResult,
    coursesResult,
    programsResult,
    facultiesResult,
    phasesResult,
    activitiesResult,
    activityTemplatesResult,
  ] = await Promise.all([
    Dev_tableassignrolesService.getAll(),
    Dev_tablevirtualizationprocessesService.getAll(),
    Dev_tablecourseinstancesService.getAll(),
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
    Dev_tablephasesService.getAll(),
    Dev_tableactivitiesService.getAll(),
    Dev_tableactivitytemplatesService.getAll(),
  ]);

  return {
    assignRoles: assignRolesResult.data ?? [],
    processes: processesResult.data ?? [],
    courses: coursesResult.data ?? [],
    programs: programsResult.data ?? [],
    faculties: facultiesResult.data ?? [],
    phases: phasesResult.data ?? [],
    activities: activitiesResult.data ?? [],
    activityTemplates: activityTemplatesResult.data ?? [],
  };
};

/** Procesos asignados al usuario según su rol activo. */
export const getCoursesForUser = async (
  userEmail: string,
  userRole: string,
): Promise<Course[]> => {
  const [data, deliverablesResult] = await Promise.all([
    fetchBaseData(),
    Dev_tabledeliverablesService.getAll({
      filter: "statecode eq 0",
    }).catch(() => ({ data: [] })),
  ]);

  return mapCoursesForUser({
    ...data,
    deliverables: deliverablesResult.data ?? [],
    userEmail,
    userRole,
  });
};

/** Detalle completo de un proceso: metadatos + materiales cargados. */
export const getCourseDetail = async (
  processId: string,
  options?: { includeInactive?: boolean },
): Promise<CourseDetail | null> => {
  const processKey = escapeODataString(processId.trim());
  const deliverableFilter = options?.includeInactive
    ? `_dev_tablevirtualizationprocess_value eq '${processKey}'`
    : `_dev_tablevirtualizationprocess_value eq '${processKey}' and statecode eq 0`;
  const [data, deliverablesRes] = await Promise.all([
    fetchBaseData(),
    Dev_tabledeliverablesService.getAll({
      filter: deliverableFilter,
    }).catch(() => ({ data: [] })),
  ]);

  const process = data.processes.find(
    (p) => p.dev_tablevirtualizationprocessid === processId,
  );
  if (!process) return null;
  if (
    !options?.includeInactive &&
    !isActiveDataverseRecord(process.statecode)
  ) {
    return null;
  }

  const course = data.courses.find(
    (c) => c.dev_tablecourseinstanceid === process._dev_tablecourse_value,
  );
  const program = data.programs.find(
    (p) => p.dev_table_programid === course?._dev_tableprogram_value,
  );
  const faculty = data.faculties.find(
    (f) => f.dev_table_facultyid === program?._dev_table_faculty_value,
  );
  const phases = data.phases.filter(
    (p) => p._dev_tablevirtualizationprocess_value === processId,
  );

  return mapCourseDetail({
    process,
    course,
    program,
    faculty,
    phases,
    activities: data.activities,
    activityTemplates: data.activityTemplates,
    assignRoles: data.assignRoles,
    deliverables: deliverablesRes.data ?? [],
  });
};

export const getFaculties = async () => {
  const result = await Dev_table_facultiesService.getAll();
  return result.data ?? [];
};

export const getPrograms = async () => {
  const result = await Dev_table_programsService.getAll();
  return result.data ?? [];
};

export const getAvailableCourses = async () => {
  const [coursesResult, processesResult] = await Promise.all([
    Dev_tablecourseinstancesService.getAll(),
    Dev_tablevirtualizationprocessesService.getAll(),
  ]);

  const coursesInUse = new Set(
    (processesResult.data ?? [])
      .filter((process) => isActiveDataverseRecord(process.statecode))
      .map((process) => process._dev_tablecourse_value?.trim() ?? "")
      .filter(Boolean),
  );

  return (coursesResult.data ?? []).filter(
    (course) =>
      !coursesInUse.has(course.dev_tablecourseinstanceid?.trim() ?? ""),
  );
};

/** Nombres de procesos existentes (para preview / consecutivo global). */
export const getProcessNames = async (): Promise<string[]> => {
  const result = await Dev_tablevirtualizationprocessesService.getAll();
  return (result.data ?? [])
    .filter((process) => isActiveDataverseRecord(process.statecode))
    .map((process) => process.dev_nameprocess?.trim() ?? "")
    .filter(Boolean);
};

export const getRoles = async () => {
  const result = await Dev_tablerolesService.getAll();
  return result.data ?? [];
};

export const getAssignRolesUsers = async () => {
  const result = await Dev_tableassignrolesService.getAll();
  return result.data ?? [];
};

export const getProcessForEdit = async (
  processId: string,
): Promise<ProcessEditData | null> => {
  const [processesResult, coursesResult, assignRolesResult, roles] =
    await Promise.all([
      Dev_tablevirtualizationprocessesService.getAll({
        filter: `dev_tablevirtualizationprocessid eq '${escapeODataString(processId)}'`,
      }),
      Dev_tablecourseinstancesService.getAll(),
      Dev_tableassignrolesService.getAll({
        filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(processId)}'`,
      }),
      getRoles(),
    ]);

  const process = (processesResult.data ?? [])[0];
  if (
    !process?.dev_tablevirtualizationprocessid ||
    !isActiveDataverseRecord(process.statecode)
  ) {
    return null;
  }

  const courseId = process._dev_tablecourse_value ?? "";
  const course = (coursesResult.data ?? []).find(
    (item) => item.dev_tablecourseinstanceid === courseId,
  );

  const {
    author: authorRoleId,
    validator: validatorRoleId,
    advisor: advisorRoleId,
    leader: leaderRoleId,
    designer: designerRoleId,
  } = resolveProcessRoleIds(roles);

  const assignments = assignRolesResult.data ?? [];
  const emailForRole = (roleId: string) =>
    assignments.find((item) => item._dev_tablerole_value === roleId)?.dev_person
      ?.trim() ?? "";

  return {
    processId: process.dev_tablevirtualizationprocessid,
    processName: process.dev_nameprocess?.trim() ?? "",
    courseId,
    courseName: course?.dev_namecourse?.trim() ?? "Sin nombre",
    credits:
      typeof process.dev_credits === "number" &&
      Number.isFinite(process.dev_credits)
        ? process.dev_credits
        : 0,
    leaderEmail: emailForRole(leaderRoleId),
    authorEmail: emailForRole(authorRoleId),
    validatorEmail: emailForRole(validatorRoleId),
    advisorEmail: emailForRole(advisorRoleId),
    designerEmail: emailForRole(designerRoleId),
    isFinalized: isProcessCloseReady(
      process.dev_closeready,
      process.dev_closereadyname,
    ),
  };
};

/** Actualiza nombre y asignación de roles de un proceso (flujo create/update). */
