/**
 * Servicio de administración: programas y usuarios de Leaders Users.
 */
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import { Dev_tableleaderusersesService } from "../../generated/services/Dev_tableleaderusersesService";
import { Dev_tablerolesService } from "../../generated/services/Dev_tablerolesService";
import type { Dev_table_programsBase } from "../../generated/models/Dev_table_programsModel";
import type { Dev_table_facultiesBase } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_tableleaderusersesBase } from "../../generated/models/Dev_tableleaderusersesModel";
import {
  assertSafeTitle,
  escapeODataString,
  validateOrganizationEmail,
} from "../../global/utils/inputValidation";
import { canonicalizeUserRole, USER_ROLES } from "../../global/constants/domainConstants";
import { findRoleId } from "../../courses/utils/roleUtils";

export const PROGRAM_LEVEL_OPTIONS = [
  { value: 775730000, label: "Carrera universitaria" },
  { value: 775730001, label: "Especialización" },
  { value: 775730002, label: "Maestría" },
  { value: 775730003, label: "Entrenamientos médicos avanzados" },
  { value: 775730004, label: "Doctorados" },
  { value: 775730005, label: "Cursos preuniversitarios" },
  { value: 775730006, label: "Posdoctorados" },
  { value: 775730007, label: "Educación continua" },
] as const;

export type ProgramLevelValue =
  (typeof PROGRAM_LEVEL_OPTIONS)[number]["value"];

/** Roles que el administrador puede registrar en Leaders Users. */
export const LEADER_USERS_MANAGEABLE_ROLES = [
  USER_ROLES.DIDE_DESIGNER,
  USER_ROLES.DIDE_COORDINATOR,
  USER_ROLES.LEADER,
  USER_ROLES.ADMIN,
] as const;

export interface AdminProgramRow {
  id: string;
  name: string;
  facultyId: string;
  facultyName: string;
  level: ProgramLevelValue | null;
  levelLabel: string;
}

export interface AdminFacultyRow {
  id: string;
  name: string;
  isActive: boolean;
}

const isRecordActive = (statecode: unknown): boolean => {
  if (statecode === undefined || statecode === null || statecode === "") {
    return true;
  }
  return Number(statecode) === 0;
};

export interface LeaderUserRow {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  facultyId: string;
  facultyName: string;
  /** false = inactivo en Dataverse (statecode Inactive). */
  isActive: boolean;
}

const isLeaderUserActive = (statecode: unknown): boolean => {
  // Dataverse: 0 = Active. Ausente → se trata como activo (legacy).
  if (statecode === undefined || statecode === null || statecode === "") {
    return true;
  }
  return Number(statecode) === 0;
};

const levelValue = (
  level?: number | string,
): ProgramLevelValue | null => {
  const numeric = typeof level === "string" ? Number(level) : level;
  if (numeric === undefined || Number.isNaN(numeric)) return null;
  const match = PROGRAM_LEVEL_OPTIONS.find((option) => option.value === numeric);
  return match ? match.value : null;
};

const levelLabel = (level?: number | string): string => {
  const value = levelValue(level);
  return (
    PROGRAM_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? "—"
  );
};

const assertCreateSuccess = (
  result: { success?: boolean; error?: unknown },
  fallback: string,
) => {
  if (result.success === false || result.error) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : typeof result.error === "object" &&
            result.error &&
            "message" in result.error
          ? String((result.error as { message?: string }).message)
          : fallback;
    throw new Error(message || fallback);
  }
};

export const listAdminPrograms = async (): Promise<AdminProgramRow[]> => {
  const [programsResult, facultiesResult] = await Promise.all([
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
  ]);

  const facultyNameById = new Map(
    (facultiesResult.data ?? []).map((faculty) => [
      faculty.dev_table_facultyid,
      faculty.dev_namefaculty?.trim() || "Sin nombre",
    ]),
  );

  return (programsResult.data ?? [])
    .map((program) => {
      const facultyId = program._dev_table_faculty_value ?? "";
      const level = levelValue(program.dev_level);
      return {
        id: program.dev_table_programid,
        name: program.dev_nameprogram?.trim() || "Sin nombre",
        facultyId,
        facultyName:
          program.dev_table_facultyname?.trim() ||
          facultyNameById.get(facultyId) ||
          "—",
        level,
        levelLabel: levelLabel(program.dev_level),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
};

export const createProgram = async (params: {
  name: string;
  facultyId: string;
  level: ProgramLevelValue;
}): Promise<void> => {
  const name = assertSafeTitle(params.name, "El nombre del programa");
  const facultyId = params.facultyId.trim();
  if (!facultyId) {
    throw new Error("Selecciona una facultad.");
  }

  const result = await Dev_table_programsService.create({
    dev_nameprogram: name,
    "dev_table_faculty@odata.bind": `/dev_table_faculties(${facultyId})`,
    dev_level: params.level,
  } as Omit<Dev_table_programsBase, "dev_table_programid">);

  assertCreateSuccess(result, "No se pudo crear el programa.");
};

export const updateProgram = async (params: {
  id: string;
  name: string;
  facultyId: string;
  level: ProgramLevelValue;
}): Promise<void> => {
  const id = params.id.trim();
  if (!id) throw new Error("Identificador de programa inválido.");

  const name = assertSafeTitle(params.name, "El nombre del programa");
  const facultyId = params.facultyId.trim();
  if (!facultyId) {
    throw new Error("Selecciona una facultad.");
  }

  const result = await Dev_table_programsService.update(id, {
    dev_nameprogram: name,
    "dev_table_faculty@odata.bind": `/dev_table_faculties(${facultyId})`,
    dev_level: params.level,
  } as Partial<Omit<Dev_table_programsBase, "dev_table_programid">>);

  assertCreateSuccess(result, "No se pudo actualizar el programa.");
};

export const listAdminFaculties = async (): Promise<AdminFacultyRow[]> => {
  const result = await Dev_table_facultiesService.getAll();

  return (result.data ?? [])
    .map((faculty) => ({
      id: faculty.dev_table_facultyid,
      name: faculty.dev_namefaculty?.trim() || "Sin nombre",
      isActive: isRecordActive(faculty.statecode),
    }))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });
};

export const createFaculty = async (name: string): Promise<void> => {
  const trimmed = assertSafeTitle(name, "El nombre de la facultad");

  const existing = await Dev_table_facultiesService.getAll();
  const duplicate = (existing.data ?? []).some(
    (faculty) =>
      faculty.dev_namefaculty?.trim().toLowerCase() === trimmed.toLowerCase() &&
      isRecordActive(faculty.statecode),
  );
  if (duplicate) {
    throw new Error("Ya existe una facultad activa con ese nombre.");
  }

  const result = await Dev_table_facultiesService.create({
    dev_namefaculty: trimmed,
    statecode: 0,
    statuscode: 1,
  } as Omit<Dev_table_facultiesBase, "dev_table_facultyid">);

  assertCreateSuccess(result, "No se pudo crear la facultad.");
};

export const updateFaculty = async (params: {
  id: string;
  name: string;
}): Promise<void> => {
  const id = params.id.trim();
  if (!id) throw new Error("Identificador de facultad inválido.");

  const name = assertSafeTitle(params.name, "El nombre de la facultad");

  const existing = await Dev_table_facultiesService.getAll();
  const duplicate = (existing.data ?? []).some(
    (faculty) =>
      faculty.dev_table_facultyid !== id &&
      faculty.dev_namefaculty?.trim().toLowerCase() === name.toLowerCase() &&
      isRecordActive(faculty.statecode),
  );
  if (duplicate) {
    throw new Error("Ya existe una facultad activa con ese nombre.");
  }

  const result = await Dev_table_facultiesService.update(id, {
    dev_namefaculty: name,
  });

  assertCreateSuccess(result, "No se pudo actualizar la facultad.");
};

export const listLeaderUsers = async (): Promise<LeaderUserRow[]> => {
  const [usersResult, rolesResult, facultiesResult] = await Promise.all([
    Dev_tableleaderusersesService.getAll(),
    Dev_tablerolesService.getAll(),
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

  return (usersResult.data ?? [])
    .map((item) => {
      const roleId = item._dev_tablerole_value ?? "";
      const facultyId = item._dev_tablefaculty_value ?? "";
      const rawRole =
        item.dev_tablerolename?.trim() || roleNameById.get(roleId) || "";
      return {
        id: item.dev_tableleaderusersid,
        email: item.dev_useremail?.trim() || "",
        roleId,
        roleName: canonicalizeUserRole(rawRole) || rawRole || "Sin rol",
        facultyId,
        facultyName:
          item.dev_tablefacultyname?.trim() ||
          facultyNameById.get(facultyId) ||
          "—",
        isActive: isLeaderUserActive(item.statecode),
      };
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.email.localeCompare(b.email, "es");
    });
};

export const createLeaderUser = async (params: {
  email: string;
  roleName: string;
  facultyId?: string;
}): Promise<void> => {
  const emailCheck = validateOrganizationEmail(params.email);
  if (!emailCheck.ok) {
    throw new Error(emailCheck.message || "Correo institucional inválido.");
  }

  const roleName = canonicalizeUserRole(params.roleName);
  if (
    !LEADER_USERS_MANAGEABLE_ROLES.includes(
      roleName as (typeof LEADER_USERS_MANAGEABLE_ROLES)[number],
    )
  ) {
    throw new Error("El rol seleccionado no se puede asignar aquí.");
  }

  const roles = (await Dev_tablerolesService.getAll()).data ?? [];
  const roleId = findRoleId(roles, [roleName]);
  if (!roleId) {
    throw new Error(
      `No se encontró el rol "${roleName}" en Dataverse. Créalo en la tabla de roles.`,
    );
  }

  const existing = await Dev_tableleaderusersesService.getAll({
    filter: `dev_useremail eq '${escapeODataString(emailCheck.value)}'`,
  });
  const sameRole = (existing.data ?? []).find(
    (item) => item._dev_tablerole_value === roleId,
  );

  if (sameRole && isLeaderUserActive(sameRole.statecode)) {
    throw new Error("Ese usuario ya tiene este rol activo en Usuarios líderes.");
  }

  if (sameRole && !isLeaderUserActive(sameRole.statecode)) {
    const reactivateFields: Record<string, string | number> = {
      statecode: 0,
      statuscode: 1,
    };
    const facultyId = params.facultyId?.trim();
    if (facultyId) {
      reactivateFields["dev_tablefaculty@odata.bind"] =
        `/dev_table_faculties(${facultyId})`;
    }

    const result = await Dev_tableleaderusersesService.update(
      sameRole.dev_tableleaderusersid,
      reactivateFields as Partial<
        Omit<Dev_tableleaderusersesBase, "dev_tableleaderusersid">
      >,
    );
    assertCreateSuccess(result, "No se pudo reactivar el usuario líder.");
    return;
  }

  const payload: Record<string, string | number> = {
    dev_useremail: emailCheck.value,
    "dev_tablerole@odata.bind": `/dev_tableroles(${roleId})`,
    statecode: 0,
    statuscode: 1,
  };

  const facultyId = params.facultyId?.trim();
  if (facultyId) {
    payload["dev_tablefaculty@odata.bind"] =
      `/dev_table_faculties(${facultyId})`;
  }

  const result = await Dev_tableleaderusersesService.create(
    payload as unknown as Omit<
      Dev_tableleaderusersesBase,
      "dev_tableleaderusersid"
    >,
  );

  assertCreateSuccess(result, "No se pudo registrar el usuario líder.");
};

/** Inactiva el registro (soft-delete). El usuario pierde el rol global. */
export const deactivateLeaderUser = async (id: string): Promise<void> => {
  if (!id.trim()) {
    throw new Error("Identificador de usuario inválido.");
  }

  const result = await Dev_tableleaderusersesService.update(id, {
    statecode: 1,
    statuscode: 2,
  } as Partial<Omit<Dev_tableleaderusersesBase, "dev_tableleaderusersid">>);

  assertCreateSuccess(result, "No se pudo inactivar el usuario líder.");
};

/** Reactiva un registro previamente inactivado. */
export const activateLeaderUser = async (id: string): Promise<void> => {
  if (!id.trim()) {
    throw new Error("Identificador de usuario inválido.");
  }

  const result = await Dev_tableleaderusersesService.update(id, {
    statecode: 0,
    statuscode: 1,
  } as Partial<Omit<Dev_tableleaderusersesBase, "dev_tableleaderusersid">>);

  assertCreateSuccess(result, "No se pudo reactivar el usuario líder.");
};
