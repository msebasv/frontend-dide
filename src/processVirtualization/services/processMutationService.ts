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
import { Dev_tableactivitiesService } from "../../generated/services/Dev_tableactivitiesService";
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";
import { isActiveDataverseRecord } from "../../global/utils/dataverseState";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { runFlowAndConfirm, FlowConfirmationTimeoutError, SOFT_CONFIRM_TIMEOUT_MS } from "../../global/utils/flowResult";
import { confirmTableOperation } from "../../global/services/tableOperationService";
import { assertDirectoryEmails } from "../../courses/services/userService";
import {
  assertProcessCredits,
  assertProcessName,
  assertSafeTitle,
  escapeODataString,
  PROCESS_CREDITS_MIN,
  PROCESS_NAME_MAX_LENGTH,
  validateOrganizationEmail,
} from "../../global/utils/inputValidation";
import {
  buildProcessDisplayName,
  parseProcessDisplayName,
  processBaseNameMaxLength,
  rebuildProcessDisplayName,
} from "../../global/utils/processNameUtils";
import { normalizeComparableText } from "../../global/utils/textUtils";
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
import {
  acquireOperationLock,
  buildOperationLockKey,
  refreshOperationLock,
  releaseOperationLock,
} from "../../global/utils/operationLock";
import {
  clearPendingOperation,
  PENDING_OPERATION_TTL_MS,
  savePendingOperation,
  type PendingCreateWatch,
} from "../../global/utils/pendingOperation";

const courseNameKey = (course: {
  dev_namecourse?: string;
  dev_namecoursenormalized?: string;
}): string => {
  const fromNormalized = course.dev_namecoursenormalized?.trim();
  if (fromNormalized) {
    return normalizeComparableText(fromNormalized);
  }
  return normalizeComparableText(course.dev_namecourse ?? "");
};

export const createCourseInstance = async (
  courseName: string,
  programId: string,
): Promise<void> => {
  const trimmedName = assertSafeTitle(courseName, "El nombre del curso");
  const normalizedName = normalizeComparableText(trimmedName);

  const beforeResult = await Dev_tablecourseinstancesService.getAll();
  const existingCourses = beforeResult.data ?? [];

  const duplicate = existingCourses.some((course) => {
    if (course.statecode === 1) return false;
    if (
      programId &&
      course._dev_tableprogram_value &&
      course._dev_tableprogram_value !== programId
    ) {
      return false;
    }
    return courseNameKey(course) === normalizedName;
  });

  if (duplicate) {
    throw new Error(
      `Ya existe un curso llamado "${trimmedName}". Use otro nombre o selecciónelo al crear el proceso.`,
    );
  }

  const idsBefore = new Set(
    existingCourses.map((course) => course.dev_tablecourseinstanceid),
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
          const nameMatches = courseNameKey(course) === normalizedName;
          return Boolean(id) && nameMatches && !idsBefore.has(id);
        });
      },
      timeoutMs: SOFT_CONFIRM_TIMEOUT_MS,
      intervalMs: 1_000,
      softTimeout: true,
      timeoutMessage:
        "La creación del curso fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
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
  /** Se llama cuando el registro del proceso ya es visible (útil en soft-timeout). */
  onProcessIdKnown?: (processId: string) => void;
}): Promise<string> => {
  const baseName = assertProcessName(params.processName);

  const credits = assertProcessCredits(params.credits);

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

  await assertDirectoryEmails(assignedRoles.map((item) => item.Email));

  const beforeResult = await Dev_tablevirtualizationprocessesService.getAll();
  const existingNames = (beforeResult.data ?? [])
    .map((process) => process.dev_nameprocess?.trim() ?? "")
    .filter(Boolean);
  const processName = buildProcessDisplayName(baseName, existingNames);
  if (processName.length > PROCESS_NAME_MAX_LENGTH) {
    throw new Error(
      `El nombre del proceso no puede superar ${PROCESS_NAME_MAX_LENGTH} caracteres.`,
    );
  }

  const idsBefore = new Set(
    (beforeResult.data ?? []).map(
      (process) => process.dev_tablevirtualizationprocessid,
    ),
  );

  const createWatch: PendingCreateWatch = {
    kind: "create-process",
    processName,
    courseId: params.courseId,
    idsBefore: [...idsBefore],
    expectedRoleIds: assignedRoles.map((item) => item.RoleID),
    actionLabel: "creación de proceso",
  };

  // Si el proceso ya quedó creado, no se vuelve a llamar al flujo.
  const alreadyId = await findCreatedProcessFromWatch(createWatch);
  if (
    alreadyId &&
    (await isCreatedProcessReady(alreadyId, createWatch.expectedRoleIds))
  ) {
    return alreadyId;
  }

  const lockKey = buildOperationLockKey("create-process", [
    params.courseId,
    processName,
  ]);
  acquireOperationLock(lockKey, PENDING_OPERATION_TTL_MS);
  const requestId = crypto.randomUUID();
  savePendingOperation(createWatch, requestId);
  let knownProcessId = "";

  try {
    await runFlowAndConfirm(
      () =>
        Fl_dev_cu_virtualization_processService.Run({
          text: processName,
          text_1: JSON.stringify(assignedRoles),
          text_2: params.courseId,
          number: credits,
          text_4: requestId,
        }),
      {
        actionLabel: "creación de proceso",
        confirm: () =>
          confirmTableOperation(requestId, (processId) => {
            knownProcessId = processId;
            params.onProcessIdKnown?.(processId);
          }),
        timeoutMs: SOFT_CONFIRM_TIMEOUT_MS,
        intervalMs: 1_000,
        softTimeout: true,
      },
    );
  } catch (error) {
    if (error instanceof FlowConfirmationTimeoutError) {
      refreshOperationLock(lockKey, PENDING_OPERATION_TTL_MS);
      error.releaseLock = () => releaseOperationLock(lockKey);
      throw error;
    }
    clearPendingOperation();
    releaseOperationLock(lockKey);
    throw error;
  }

  const processId =
    knownProcessId || (await findCreatedProcessFromWatch(createWatch));
  if (processId) {
    params.onProcessIdKnown?.(processId);
  } else {
    clearPendingOperation();
    releaseOperationLock(lockKey);
    throw new Error(
      "El proceso se creó, pero no se pudo obtener su identificador. Consulte la lista de procesos.",
    );
  }

  clearPendingOperation();
  releaseOperationLock(lockKey);
  return processId;
};

const findCreatedProcessFromWatch = async (
  watch: PendingCreateWatch,
): Promise<string | null> => {
  const idsBefore = new Set(watch.idsBefore);
  const processesResult = await Dev_tablevirtualizationprocessesService.getAll();
  const created = (processesResult.data ?? []).find((process) => {
    const id = process.dev_tablevirtualizationprocessid;
    if (!id || idsBefore.has(id)) return false;

    const nameMatches =
      process.dev_nameprocess?.trim().toLowerCase() ===
      watch.processName.toLowerCase();
    const courseMatches = process._dev_tablecourse_value === watch.courseId;
    return nameMatches || courseMatches;
  });

  return created?.dev_tablevirtualizationprocessid ?? null;
};

const isCreatedProcessReady = async (
  processId: string,
  expectedRoleIds: string[],
): Promise<boolean> => {
  const filter = `_dev_tablevirtualizationprocess_value eq '${escapeODataString(processId)}' and statecode eq 0`;
  const [assignRolesResult, phasesResult, templatesResult] = await Promise.all([
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
  if (!expectedRoleIds.every((roleId) => assignedRoleIds.has(roleId))) {
    return false;
  }

  const processPhases = (phasesResult.data ?? []) as PhaseWithFormatted[];
  if (processPhases.length === 0) return false;

  const templatesMap = new Map(
    (templatesResult.data ?? []).map((template) => [
      template.dev_tableactivitytemplateid,
      template,
    ]),
  );
  return isLeaderSyllabusStatus(getCurrentStatus(processPhases, templatesMap));
};

/** Confirma la creación guardada, también después de recargar. */
export const createProcessWatcher = (
  watch: PendingCreateWatch,
  onProcessIdKnown?: (processId: string) => void,
): (() => Promise<boolean>) => {
  return async () => {
    const processId = await findCreatedProcessFromWatch(watch);
    if (!processId) return false;
    onProcessIdKnown?.(processId);
    return isCreatedProcessReady(processId, watch.expectedRoleIds);
  };
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
  /** Vacío si el proceso aún no tiene validador disciplinar. */
  validatorEmail: string;
  advisorEmail: string;
  leaderRoleId: string;
  authorRoleId: string;
  validatorRoleId: string;
  advisorRoleId: string;
  /** Se reenvía para no perder la asignación al actualizar el proceso. */
  designerEmail?: string;
  designerRoleId?: string;
}): Promise<void> => {
  // En actualización el flujo exige id-process (text_3) con el GUID real.
  // En creación no se envía id-process.
  const processId = params.processId.trim();
  if (!processId || processId === "0") {
    throw new Error(
      "Falta el identificador del proceso (id-process) para actualizar.",
    );
  }

  const parsedName = parseProcessDisplayName(params.processName);
  const baseName = assertProcessName(
    parsedName.baseName,
    processBaseNameMaxLength(parsedName.semester, parsedName.code),
  );
  const processName =
    parsedName.semester && parsedName.code
      ? rebuildProcessDisplayName(baseName, parsedName.semester, parsedName.code)
      : baseName;
  if (processName.length > PROCESS_NAME_MAX_LENGTH) {
    throw new Error(
      `El nombre del proceso no puede superar ${PROCESS_NAME_MAX_LENGTH} caracteres.`,
    );
  }

  const credits = assertProcessCredits(params.credits);

  const leaderEmail = validateOrganizationEmail(params.leaderEmail);
  const authorEmail = validateOrganizationEmail(params.authorEmail);
  const advisorEmail = validateOrganizationEmail(params.advisorEmail);
  const rawValidator = params.validatorEmail.trim();
  const validatorEmail = rawValidator
    ? validateOrganizationEmail(rawValidator)
    : null;

  if (!leaderEmail.ok || !authorEmail.ok || !advisorEmail.ok) {
    throw new Error(
      leaderEmail.message ||
        authorEmail.message ||
        advisorEmail.message ||
        "Correo institucional inválido.",
    );
  }

  if (validatorEmail && !validatorEmail.ok) {
    throw new Error(
      validatorEmail.message || "Correo del validador inválido.",
    );
  }

  if (rawValidator && !params.validatorRoleId.trim()) {
    throw new Error("No se encontró el rol Validador disciplinar en el sistema.");
  }

  if (!params.courseId.trim()) {
    throw new Error("El proceso no tiene un curso asociado.");
  }

  const assignedRoles = [
    { Email: leaderEmail.value, RoleID: params.leaderRoleId },
    { Email: authorEmail.value, RoleID: params.authorRoleId },
  ];

  if (validatorEmail?.ok) {
    assignedRoles.push({
      Email: validatorEmail.value,
      RoleID: params.validatorRoleId,
    });
  }

  assignedRoles.push({
    Email: advisorEmail.value,
    RoleID: params.advisorRoleId,
  });

  const rawDesigner = params.designerEmail?.trim() ?? "";
  if (rawDesigner) {
    if (!params.designerRoleId?.trim()) {
      throw new Error("No se encontró el rol Diseñador DIDE en el sistema.");
    }
    const designerEmail = validateOrganizationEmail(rawDesigner);
    if (!designerEmail.ok) {
      throw new Error(
        designerEmail.message || "Correo del diseñador DIDE inválido.",
      );
    }
    assignedRoles.push({
      Email: designerEmail.value,
      RoleID: params.designerRoleId,
    });
  }

  await assertDirectoryEmails(assignedRoles.map((item) => item.Email));

  const requestId = crypto.randomUUID();

  await runFlowAndConfirm(
    () =>
      Fl_dev_cu_virtualization_processService.Run({
        text: processName,
        text_1: JSON.stringify(assignedRoles),
        text_2: params.courseId,
        text_3: processId,
        number: credits,
        text_4: requestId,
      }),
    {
      actionLabel: "actualización de proceso",
      confirm: () => confirmTableOperation(requestId),
      timeoutMs: SOFT_CONFIRM_TIMEOUT_MS,
      intervalMs: 1_000,
      softTimeout: true,
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

  if (
    !Number.isInteger(editData.credits) ||
    editData.credits < PROCESS_CREDITS_MIN
  ) {
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
    designer: designerRoleId,
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
    designerEmail: editData.designerEmail,
    designerRoleId,
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

  if (
    !Number.isInteger(editData.credits) ||
    editData.credits < PROCESS_CREDITS_MIN
  ) {
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

  await assertDirectoryEmails(assignedRoles.map((item) => item.Email));

  const requestId = crypto.randomUUID();

  await runFlowAndConfirm(
    () =>
      Fl_dev_cu_virtualization_processService.Run({
        text: processName,
        text_1: JSON.stringify(assignedRoles),
        text_2: editData.courseId,
        text_3: processId,
        number: credits,
        text_4: requestId,
      }),
    {
      actionLabel: "asignación de diseñador DIDE",
      confirm: () => confirmTableOperation(requestId),
      timeoutMs: SOFT_CONFIRM_TIMEOUT_MS,
      intervalMs: 1_000,
      softTimeout: true,
    },
  );
};

const inactiveRecord = { statecode: 1 as const, statuscode: 2 as const };

const deactivateById = async (
  ids: string[],
  update: (id: string) => Promise<unknown>,
): Promise<void> => {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  await Promise.all(unique.map((id) => update(id)));
};

/**
 * Inactiva el proceso y lo que cuelga de él.
 * Los listados solo muestran registros activos.
 */
export const deleteVirtualizationProcess = async (
  processId: string,
): Promise<void> => {
  const id = processId.trim();
  if (!id) throw new Error("Proceso no válido.");

  const escapedId = escapeODataString(id);
  const [phasesResult, deliverablesResult, assignRolesResult] =
    await Promise.all([
      Dev_tablephasesService.getAll({
        filter: `_dev_tablevirtualizationprocess_value eq '${escapedId}'`,
      }),
      Dev_tabledeliverablesService.getAll({
        filter: `_dev_tablevirtualizationprocess_value eq '${escapedId}'`,
      }),
      Dev_tableassignrolesService.getAll({
        filter: `_dev_tablevirtualizationprocess_value eq '${escapedId}'`,
      }),
    ]);

  const phases = (phasesResult.data ?? []).filter((row) =>
    isActiveDataverseRecord(row.statecode),
  );
  const phaseIds = new Set(phases.map((phase) => phase.dev_tablephaseid));
  const activitiesResult = phaseIds.size
    ? await Dev_tableactivitiesService.getAll()
    : { data: [] };
  const activities = (activitiesResult.data ?? []).filter(
    (row) =>
      phaseIds.has(row._dev_tablephase_value ?? "") &&
      isActiveDataverseRecord(row.statecode),
  );

  await deactivateById(
    activities.map((row) => row.dev_tableactivityid),
    (activityId) =>
      Dev_tableactivitiesService.update(activityId, inactiveRecord),
  );
  await deactivateById(
    (deliverablesResult.data ?? [])
      .filter((row) => isActiveDataverseRecord(row.statecode))
      .map((row) => row.dev_tabledeliverableid),
    (deliverableId) =>
      Dev_tabledeliverablesService.update(deliverableId, inactiveRecord),
  );
  await deactivateById(
    (assignRolesResult.data ?? [])
      .filter((row) => isActiveDataverseRecord(row.statecode))
      .map((row) => row.dev_tableassignroleid),
    (assignRoleId) =>
      Dev_tableassignrolesService.update(assignRoleId, inactiveRecord),
  );
  await deactivateById(
    phases.map((row) => row.dev_tablephaseid),
    (phaseId) => Dev_tablephasesService.update(phaseId, inactiveRecord),
  );
  await Dev_tablevirtualizationprocessesService.update(id, inactiveRecord);
};

