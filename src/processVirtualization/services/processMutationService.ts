/**
 * Mutaciones de procesos de virtualización (create / update / assign).
 * Re-exportado desde courses/services/courseService.ts para compatibilidad.
 */
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Fl_dev_c_course_instanceService } from "../../generated/services/Fl_dev_c_course_instanceService";
import { Fl_dev_cu_virtualization_processService } from "../../generated/services/Fl_dev_cu_virtualization_processService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { runFlowAndConfirm } from "../../global/utils/flowResult";
import {
  assertSafeTitle,
  escapeODataString,
  validateOrganizationEmail,
} from "../../global/utils/inputValidation";
import { buildProcessDisplayName } from "../../global/utils/processNameUtils";
import {
  getCurrentStatus,
  isLeaderSyllabusStatus,
  type PhaseWithFormatted,
} from "../../courses/mappers/courseMappers";
import { resolveProcessRoleIds } from "../../courses/utils/roleUtils";
import {
  getProcessForEdit,
  getRoles,
} from "../../courses/services/courseQueryService";

export const createCourseInstance = async (
  courseName: string,
  programId: string,
): Promise<void> => {
  const trimmedName = assertSafeTitle(courseName, "El nombre del curso");

  const beforeResult = await Dev_tablecourseinstancesService.getAll();
  const idsBefore = new Set(
    (beforeResult.data ?? []).map(
      (course) => course.dev_tablecourseinstanceid,
    ),
  );

  await runFlowAndConfirm(
    () =>
      Fl_dev_c_course_instanceService.Run({
        text: trimmedName,
        text_1: programId,
      }),
    {
      actionLabel: "creación de curso",
      confirm: async () => {
        const coursesResult = await Dev_tablecourseinstancesService.getAll();
        return (coursesResult.data ?? []).some((course) => {
          const id = course.dev_tablecourseinstanceid;
          const nameMatches =
            course.dev_namecourse?.trim().toLowerCase() ===
            trimmedName.toLowerCase();
          return Boolean(id) && nameMatches && !idsBefore.has(id);
        });
      },
      timeoutMs: 90_000,
      intervalMs: 2_000,
      timeoutMessage:
        "El curso se envió a crear, pero aún no aparece en el sistema. Consulte en unos minutos o intente nuevamente.",
    },
  );
};

export const createVirtualizationProcess = async (params: {
  /** Nombre base escrito por el usuario (sin semestre ni código). */
  processName: string;
  courseId: string;
  /** Créditos del proceso (fl-dev-cu-virtualization-process → number). */
  credits: number;
  leaderEmail: string;
  authorEmail: string;
  /** Opcional: lo asigna después el líder de virtualización. */
  validatorEmail?: string;
  advisorEmail: string;
  leaderRoleId: string;
  authorRoleId: string;
  validatorRoleId?: string;
  advisorRoleId: string;
}): Promise<string> => {
  const baseName = assertSafeTitle(
    params.processName,
    "El nombre del proceso",
  );

  const credits = Math.trunc(Number(params.credits));
  if (!Number.isFinite(credits) || credits < 1) {
    throw new Error("Los créditos deben ser un número entero mayor o igual a 1.");
  }

  const leaderEmail = validateOrganizationEmail(params.leaderEmail);
  const authorEmail = validateOrganizationEmail(params.authorEmail);
  const advisorEmail = validateOrganizationEmail(params.advisorEmail);

  if (!leaderEmail.ok || !authorEmail.ok || !advisorEmail.ok) {
    throw new Error(
      leaderEmail.message ||
        authorEmail.message ||
        advisorEmail.message ||
        "Correo institucional inválido.",
    );
  }

  const assignedRoles: { Email: string; RoleID: string }[] = [
    { Email: leaderEmail.value, RoleID: params.leaderRoleId },
    { Email: authorEmail.value, RoleID: params.authorRoleId },
    { Email: advisorEmail.value, RoleID: params.advisorRoleId },
  ];

  const rawValidator = params.validatorEmail?.trim() ?? "";
  if (rawValidator) {
    if (!params.validatorRoleId) {
      throw new Error(
        "No se encontró el rol Validador disciplinar en el sistema.",
      );
    }
    const validatorEmail = validateOrganizationEmail(rawValidator);
    if (!validatorEmail.ok) {
      throw new Error(
        validatorEmail.message || "Correo del validador inválido.",
      );
    }
    assignedRoles.push({
      Email: validatorEmail.value,
      RoleID: params.validatorRoleId,
    });
  }

  const beforeResult = await Dev_tablevirtualizationprocessesService.getAll();
  const existingNames = (beforeResult.data ?? [])
    .map((process) => process.dev_nameprocess?.trim() ?? "")
    .filter(Boolean);
  const processName = buildProcessDisplayName(baseName, existingNames);

  const idsBefore = new Set(
    (beforeResult.data ?? []).map(
      (process) => process.dev_tablevirtualizationprocessid,
    ),
  );

  const findCreatedProcessId = async (): Promise<string | null> => {
    const processesResult =
      await Dev_tablevirtualizationprocessesService.getAll();

    const created = (processesResult.data ?? []).find((process) => {
      const id = process.dev_tablevirtualizationprocessid;
      if (!id || idsBefore.has(id)) return false;

      const nameMatches =
        process.dev_nameprocess?.trim().toLowerCase() ===
        processName.toLowerCase();
      const courseMatches =
        process._dev_tablecourse_value === params.courseId;

      return nameMatches || courseMatches;
    });

    return created?.dev_tablevirtualizationprocessid ?? null;
  };

  /**
   * El flujo responde succeeded cuando crea el registro del proceso, pero las
   * fases (Cargue Syllabus) y assign-roles pueden llegar después. No damos
   * éxito en UI hasta que el detalle ya sea consultable.
   */
  const isCreatedProcessReady = async (processId: string): Promise<boolean> => {
    const expectedRoleIds = assignedRoles.map((item) => item.RoleID);
    const filter = `_dev_tablevirtualizationprocess_value eq '${escapeODataString(processId)}' and statecode eq 0`;

    const [assignRolesResult, phasesResult, templatesResult] =
      await Promise.all([
        Dev_tableassignrolesService.getAll({
          filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(processId)}'`,
        }),
        Dev_tablephasesService.getAll({ filter }),
        Dev_tableactivitytemplatesService.getAll(),
      ]);

    const assignedRoleIds = new Set(
      (assignRolesResult.data ?? [])
        .map((item) => item._dev_tablerole_value ?? "")
        .filter(Boolean),
    );
    const allRolesAssigned = expectedRoleIds.every((roleId) =>
      assignedRoleIds.has(roleId),
    );
    if (!allRolesAssigned) return false;

    const processPhases = (phasesResult.data ?? []) as PhaseWithFormatted[];
    if (processPhases.length === 0) return false;

    const templatesMap = new Map(
      (templatesResult.data ?? []).map((template) => [
        template.dev_tableactivitytemplateid,
        template,
      ]),
    );
    const status = getCurrentStatus(processPhases, templatesMap);
    return isLeaderSyllabusStatus(status);
  };

  await runFlowAndConfirm(
    () =>
      Fl_dev_cu_virtualization_processService.Run({
        text: processName,
        text_1: JSON.stringify(assignedRoles),
        text_2: params.courseId,
        text_3: "0",
        number: credits,
      }),
    {
      actionLabel: "creación de proceso",
      confirm: async () => {
        const processId = await findCreatedProcessId();
        if (!processId) return false;
        return isCreatedProcessReady(processId);
      },
      timeoutMs: 180_000,
      intervalMs: 2_500,
      timeoutMessage:
        "El proceso se envió a crear, pero aún no está listo (fases o roles pendientes). Consulte la lista en unos minutos.",
    },
  );

  const processId = await findCreatedProcessId();
  if (!processId) {
    throw new Error(
      "El proceso se creó, pero no se pudo obtener su identificador. Consulte la lista de procesos.",
    );
  }

  // Doble chequeo por si el último poll fue justo al límite.
  if (!(await isCreatedProcessReady(processId))) {
    throw new Error(
      "El proceso aparece en el sistema, pero aún no terminó de provisionarse (estado o roles). Espere unos segundos y ábralo desde la lista.",
    );
  }

  return processId;
};

/** Carga nombre, curso y correos de roles para editar un proceso existente. */
export const updateVirtualizationProcess = async (params: {
  processId: string;
  /** Nombre completo final del proceso (incluye semestre y código). */
  processName: string;
  courseId: string;
  /** Créditos del proceso (fl-dev-cu-virtualization-process → number). */
  credits: number;
  leaderEmail: string;
  authorEmail: string;
  validatorEmail: string;
  advisorEmail: string;
  leaderRoleId: string;
  authorRoleId: string;
  validatorRoleId: string;
  advisorRoleId: string;
}): Promise<void> => {
  // En actualización el flujo exige id-process (text_3) con el GUID real.
  // En creación se envía "0".
  const processId = params.processId.trim();
  if (!processId || processId === "0") {
    throw new Error(
      "Falta el identificador del proceso (id-process) para actualizar.",
    );
  }

  const processName = assertSafeTitle(
    params.processName,
    "El nombre del proceso",
  );

  const credits = Math.trunc(Number(params.credits));
  if (!Number.isFinite(credits) || credits < 1) {
    throw new Error("Los créditos deben ser un número entero mayor o igual a 1.");
  }

  const leaderEmail = validateOrganizationEmail(params.leaderEmail);
  const authorEmail = validateOrganizationEmail(params.authorEmail);
  const validatorEmail = validateOrganizationEmail(params.validatorEmail);
  const advisorEmail = validateOrganizationEmail(params.advisorEmail);

  if (
    !leaderEmail.ok ||
    !authorEmail.ok ||
    !validatorEmail.ok ||
    !advisorEmail.ok
  ) {
    throw new Error(
      leaderEmail.message ||
        authorEmail.message ||
        validatorEmail.message ||
        advisorEmail.message ||
        "Correo institucional inválido.",
    );
  }

  if (!params.courseId.trim()) {
    throw new Error("El proceso no tiene un curso asociado.");
  }

  const assignedRoles = [
    { Email: leaderEmail.value, RoleID: params.leaderRoleId },
    { Email: authorEmail.value, RoleID: params.authorRoleId },
    { Email: validatorEmail.value, RoleID: params.validatorRoleId },
    { Email: advisorEmail.value, RoleID: params.advisorRoleId },
  ];

  const expectedAssignments = assignedRoles.map((item) => ({
    roleId: item.RoleID,
    email: item.Email.trim().toLowerCase(),
  }));

  await runFlowAndConfirm(
    () =>
      Fl_dev_cu_virtualization_processService.Run({
        text: processName,
        text_1: JSON.stringify(assignedRoles),
        text_2: params.courseId,
        text_3: processId, // id-process
        number: credits,
      }),
    {
      actionLabel: "actualización de proceso",
      confirm: async () => {
        const [processResult, assignRolesResult] = await Promise.all([
          Dev_tablevirtualizationprocessesService.get(processId),
          Dev_tableassignrolesService.getAll({
            filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(processId)}'`,
          }),
        ]);

        const nameMatches =
          processResult.data?.dev_nameprocess?.trim().toLowerCase() ===
          processName.toLowerCase();
        if (!nameMatches) return false;

        const rows = assignRolesResult.data ?? [];
        return expectedAssignments.every((expected) =>
          rows.some(
            (item) =>
              item._dev_tablerole_value === expected.roleId &&
              item.dev_person?.trim().toLowerCase() === expected.email,
          ),
        );
      },
      timeoutMs: 180_000,
      intervalMs: 2_500,
      timeoutMessage:
        "La actualización se envió correctamente, pero los roles aún no se reflejan. Consulte en unos minutos o intente nuevamente.",
    },
  );
};

/**
 * Asigna (o reemplaza) el validador disciplinar.
 * El flujo de virtualización exige reenviar todos los roles; solo cambia
 * el correo del validador y conserva el resto del proceso.
 */
export const assignProcessValidator = async (params: {
  processId: string;
  validatorEmail: string;
}): Promise<void> => {
  const editData = await getProcessForEdit(params.processId);
  if (!editData) {
    throw new Error("No se encontró el proceso para asignar el validador.");
  }

  if (
    !editData.leaderEmail.trim() ||
    !editData.authorEmail.trim() ||
    !editData.advisorEmail.trim()
  ) {
    throw new Error(
      "El proceso no tiene todos los responsables previos. Usa Editar proceso para completarlos.",
    );
  }

  if (!editData.courseId.trim()) {
    throw new Error("El proceso no tiene un curso asociado.");
  }

  if (editData.credits < 1) {
    throw new Error(
      "El proceso no tiene créditos válidos. Usa Editar proceso para corregirlos.",
    );
  }

  const roles = await getRoles();
  const {
    leader: leaderRoleId,
    author: authorRoleId,
    validator: validatorRoleId,
    advisor: advisorRoleId,
  } = resolveProcessRoleIds(roles);

  if (!leaderRoleId || !authorRoleId || !validatorRoleId || !advisorRoleId) {
    throw new Error(
      "No se encontraron todos los roles en el sistema. Verifica que existan Líder de virtualización, Autor de asignatura, Validador disciplinar y Asesor pedagógico.",
    );
  }

  await updateVirtualizationProcess({
    processId: editData.processId,
    processName: editData.processName,
    courseId: editData.courseId,
    credits: editData.credits,
    leaderEmail: editData.leaderEmail,
    authorEmail: editData.authorEmail,
    validatorEmail: params.validatorEmail,
    advisorEmail: editData.advisorEmail,
    leaderRoleId,
    authorRoleId,
    validatorRoleId,
    advisorRoleId,
  });
};

/**
 * Asigna el Diseñador DIDE a un proceso (en cualquier momento desde la creación).
 * Reenvía los roles ya existentes y agrega (o reemplaza) el diseñador.
 * El validador es opcional: puede no estar asignado aún.
 */
export const assignProcessDideDesigner = async (params: {
  processId: string;
  designerEmail: string;
}): Promise<void> => {
  const editData = await getProcessForEdit(params.processId);
  if (!editData) {
    throw new Error("No se encontró el proceso para asignar el diseñador.");
  }

  if (
    !editData.leaderEmail.trim() ||
    !editData.authorEmail.trim() ||
    !editData.advisorEmail.trim()
  ) {
    throw new Error(
      "El proceso no tiene los responsables base (líder, autor y asesor).",
    );
  }

  if (!editData.courseId.trim()) {
    throw new Error("El proceso no tiene un curso asociado.");
  }

  if (editData.credits < 1) {
    throw new Error(
      "El proceso no tiene créditos válidos. Usa Editar proceso para corregirlos.",
    );
  }

  const designerEmail = validateOrganizationEmail(params.designerEmail);
  if (!designerEmail.ok) {
    throw new Error(
      designerEmail.message || "Correo del diseñador DIDE inválido.",
    );
  }

  const roles = await getRoles();
  const {
    leader: leaderRoleId,
    author: authorRoleId,
    validator: validatorRoleId,
    advisor: advisorRoleId,
    designer: designerRoleId,
  } = resolveProcessRoleIds(roles);

  if (!leaderRoleId || !authorRoleId || !advisorRoleId || !designerRoleId) {
    throw new Error(
      "No se encontraron todos los roles en el sistema. Verifica que exista el rol Diseñador DIDE.",
    );
  }

  const processId = editData.processId.trim();
  const processName = assertSafeTitle(
    editData.processName,
    "El nombre del proceso",
  );
  const credits = Math.trunc(Number(editData.credits));

  const leaderEmail = validateOrganizationEmail(editData.leaderEmail);
  const authorEmail = validateOrganizationEmail(editData.authorEmail);
  const advisorEmail = validateOrganizationEmail(editData.advisorEmail);

  if (!leaderEmail.ok || !authorEmail.ok || !advisorEmail.ok) {
    throw new Error(
      "Hay un correo de responsable inválido en el proceso. Corrige la asignación antes de continuar.",
    );
  }

  const assignedRoles: { Email: string; RoleID: string }[] = [
    { Email: leaderEmail.value, RoleID: leaderRoleId },
    { Email: authorEmail.value, RoleID: authorRoleId },
    { Email: advisorEmail.value, RoleID: advisorRoleId },
    { Email: designerEmail.value, RoleID: designerRoleId },
  ];

  const rawValidator = editData.validatorEmail.trim();
  if (rawValidator) {
    if (!validatorRoleId) {
      throw new Error(
        "No se encontró el rol Validador disciplinar en el sistema.",
      );
    }
    const validatorEmail = validateOrganizationEmail(rawValidator);
    if (!validatorEmail.ok) {
      throw new Error(
        validatorEmail.message || "Correo del validador inválido.",
      );
    }
    assignedRoles.splice(2, 0, {
      Email: validatorEmail.value,
      RoleID: validatorRoleId,
    });
  }

  const expectedAssignments = assignedRoles.map((item) => ({
    roleId: item.RoleID,
    email: item.Email.trim().toLowerCase(),
  }));

  await runFlowAndConfirm(
    () =>
      Fl_dev_cu_virtualization_processService.Run({
        text: processName,
        text_1: JSON.stringify(assignedRoles),
        text_2: editData.courseId,
        text_3: processId,
        number: credits,
      }),
    {
      actionLabel: "asignación de diseñador DIDE",
      confirm: async () => {
        const assignRolesResult = await Dev_tableassignrolesService.getAll({
          filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(processId)}'`,
        });

        const rows = assignRolesResult.data ?? [];
        // Debe existir el diseñador en su rol y el resto de responsables enviados.
        return expectedAssignments.every((expected) =>
          rows.some(
            (item) =>
              item._dev_tablerole_value === expected.roleId &&
              item.dev_person?.trim().toLowerCase() === expected.email,
          ),
        );
      },
      timeoutMs: 180_000,
      intervalMs: 2_500,
      timeoutMessage:
        "La asignación se envió correctamente, pero el diseñador DIDE aún no figura en el proceso. Consulte en unos minutos o intente nuevamente.",
    },
  );
};

