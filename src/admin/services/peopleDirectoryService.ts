/**
 * Directorio de personas: roles globales (Leaders Users) + roles por proceso.
 */
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tableleaderusersesService } from "../../generated/services/Dev_tableleaderusersesService";
import { Dev_tablerolesService } from "../../generated/services/Dev_tablerolesService";
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import type { Dev_tableassignroles } from "../../generated/models/Dev_tableassignrolesModel";
import { canonicalizeUserRole } from "../../global/constants/domainConstants";

export interface PersonGlobalRole {
  roleName: string;
  facultyId: string;
  facultyName: string;
  leaderUserId: string;
}

export interface PersonProcessRole {
  roleName: string;
  processId: string;
  processName: string;
  courseName: string;
  facultyId: string;
  facultyName: string;
  assignRoleId: string;
}

export interface PersonDirectoryEntry {
  email: string;
  displayName: string;
  globalRoles: PersonGlobalRole[];
  processRoles: PersonProcessRole[];
}

type AssignRoleRow = Dev_tableassignroles & {
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
};

const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const resolveDisplayName = (
  email: string,
  username?: string,
): string => {
  const name = username?.trim() ?? "";
  if (name && !looksLikeEmail(name) && name.toLowerCase() !== email) {
    return name;
  }
  return "";
};

export const getPeopleDirectory = async (): Promise<PersonDirectoryEntry[]> => {
  const [
    leaderUsersResult,
    assignRolesResult,
    rolesResult,
    processesResult,
    coursesResult,
    programsResult,
    facultiesResult,
  ] = await Promise.all([
    Dev_tableleaderusersesService.getAll(),
    Dev_tableassignrolesService.getAll(),
    Dev_tablerolesService.getAll(),
    Dev_tablevirtualizationprocessesService.getAll(),
    Dev_tablecourseinstancesService.getAll(),
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
  ]);

  const roleNameById = new Map(
    (rolesResult.data ?? []).map((role) => [
      role.dev_tableroleid,
      role.dev_namerole?.trim() || "",
    ]),
  );

  const facultyNameById = new Map(
    (facultiesResult.data ?? []).map((faculty) => [
      faculty.dev_table_facultyid,
      faculty.dev_namefaculty?.trim() || "Sin nombre",
    ]),
  );

  const programsById = new Map(
    (programsResult.data ?? []).map((program) => [
      program.dev_table_programid,
      program,
    ]),
  );

  const coursesById = new Map(
    (coursesResult.data ?? []).map((course) => [
      course.dev_tablecourseinstanceid,
      course,
    ]),
  );

  const processMetaById = new Map(
    (processesResult.data ?? []).map((process) => {
      const processId = process.dev_tablevirtualizationprocessid;
      const course = coursesById.get(process._dev_tablecourse_value ?? "");
      const program = programsById.get(course?._dev_tableprogram_value ?? "");
      const facultyId = program?._dev_table_faculty_value ?? "";
      return [
        processId,
        {
          processName: process.dev_nameprocess?.trim() || "Sin nombre",
          courseName: course?.dev_namecourse?.trim() || "Sin curso",
          facultyId,
          facultyName:
            facultyNameById.get(facultyId) ||
            program?.dev_table_facultyname?.trim() ||
            "—",
        },
      ] as const;
    }),
  );

  const byEmail = new Map<string, PersonDirectoryEntry>();

  const ensurePerson = (emailRaw: string, displayName = "") => {
    const email = normalizeEmail(emailRaw);
    if (!email) return null;

    const existing = byEmail.get(email);
    if (existing) {
      if (!existing.displayName && displayName) {
        existing.displayName = displayName;
      }
      return existing;
    }

    const created: PersonDirectoryEntry = {
      email,
      displayName,
      globalRoles: [],
      processRoles: [],
    };
    byEmail.set(email, created);
    return created;
  };

  for (const item of leaderUsersResult.data ?? []) {
    // Solo roles globales activos en el directorio efectivo.
    if (
      item.statecode !== undefined &&
      item.statecode !== null &&
      Number(item.statecode) !== 0
    ) {
      continue;
    }

    const email = item.dev_useremail?.trim() ?? "";
    const person = ensurePerson(email);
    if (!person) continue;

    const roleId = item._dev_tablerole_value ?? "";
    const rawRole =
      item.dev_tablerolename?.trim() || roleNameById.get(roleId) || "";
    const roleName = canonicalizeUserRole(rawRole) || rawRole || "Sin rol";
    const facultyId = item._dev_tablefaculty_value ?? "";

    person.globalRoles.push({
      roleName,
      facultyId,
      facultyName:
        item.dev_tablefacultyname?.trim() ||
        facultyNameById.get(facultyId) ||
        "—",
      leaderUserId: item.dev_tableleaderusersid,
    });
  }

  for (const item of (assignRolesResult.data ?? []) as AssignRoleRow[]) {
    const email =
      item.dev_person?.trim() ||
      (looksLikeEmail(item.dev_username?.trim() ?? "")
        ? item.dev_username!.trim()
        : "");
    const displayName = resolveDisplayName(
      normalizeEmail(email),
      item.dev_username,
    );
    const person = ensurePerson(email, displayName);
    if (!person) continue;

    const processId = item._dev_tablevirtualizationprocess_value ?? "";
    if (!processId) continue;

    const rawRole =
      item[
        "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
      ]?.trim() ||
      item.dev_tablerolename?.trim() ||
      roleNameById.get(item._dev_tablerole_value ?? "") ||
      "";
    const roleName = canonicalizeUserRole(rawRole) || rawRole || "Sin rol";
    const meta = processMetaById.get(processId);

    person.processRoles.push({
      roleName,
      processId,
      processName:
        meta?.processName ||
        item.dev_tablevirtualizationprocessname?.trim() ||
        "Proceso",
      courseName: meta?.courseName || "—",
      facultyId: meta?.facultyId || "",
      facultyName: meta?.facultyName || "—",
      assignRoleId: item.dev_tableassignroleid,
    });
  }

  return [...byEmail.values()]
    .map((person) => ({
      ...person,
      globalRoles: [...person.globalRoles].sort((a, b) =>
        a.roleName.localeCompare(b.roleName, "es"),
      ),
      processRoles: [...person.processRoles].sort((a, b) =>
        a.processName.localeCompare(b.processName, "es"),
      ),
    }))
    .sort((a, b) => {
      const labelA = a.displayName || a.email;
      const labelB = b.displayName || b.email;
      return labelA.localeCompare(labelB, "es");
    });
};

export const collectPeopleFilterOptions = (
  people: PersonDirectoryEntry[],
): {
  roles: string[];
  faculties: { id: string; name: string }[];
  processes: { id: string; name: string }[];
} => {
  const roles = new Set<string>();
  const faculties = new Map<string, string>();
  const processes = new Map<string, string>();

  for (const person of people) {
    for (const role of person.globalRoles) {
      roles.add(role.roleName);
      if (role.facultyId) {
        faculties.set(role.facultyId, role.facultyName);
      }
    }
    for (const role of person.processRoles) {
      roles.add(role.roleName);
      if (role.facultyId) {
        faculties.set(role.facultyId, role.facultyName);
      }
      processes.set(role.processId, role.processName);
    }
  }

  return {
    roles: [...roles].sort((a, b) => a.localeCompare(b, "es")),
    faculties: [...faculties.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    processes: [...processes.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
};
