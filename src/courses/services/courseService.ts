/**
 * Servicio de cursos — capa de acceso a datos y acciones de negocio.
 *
 * Responsabilidades:
 * - Lectura: procesos, cursos, entregables (vía fetchBaseData + mappers).
 * - Escritura: crear curso/proceso, cargar material, aprobar/devolver validaciones.
 * - Orquestación de flujos Power Automate (fl-dev-cu-activity, fl-dev-c-temp-folder).
 *
 * Patrón: este archivo habla con `generated/` y delega transformación a mappers.
 */
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import { Fl_dev_c_course_instanceService } from "../../generated/services/Fl_dev_c_course_instanceService";
import { Fl_dev_cu_virtualization_processService } from "../../generated/services/Fl_dev_cu_virtualization_processService";
import { Fl_dev_c_temp_folderService } from "../../generated/services/Fl_dev_c_temp_folderService";
import { Fl_dev_cu_activityService } from "../../generated/services/Fl_dev_cu_activityService";
import type { ManualTriggerInput } from "../../generated/models/Fl_dev_cu_activityModel";
import type { ResponseActionOutput } from "../../generated/models/Fl_dev_c_temp_folderModel";
import { fileToBase64 } from "../../global/utils/fileUtils";
import {
  assertFlowResult,
  runFlowAndConfirm,
} from "../../global/utils/flowResult";
import {
  assertSafeDescription,
  assertSafeFiles,
  assertSafeTitle,
  assertSafeWordGuide,
  escapeODataString,
  sanitizeFileName,
  validateOrganizationEmail,
} from "../../global/utils/inputValidation";
import { buildProcessDisplayName } from "../../global/utils/processNameUtils";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitiesService } from "../../generated/services/Dev_tableactivitiesService";
import { Dev_tablerolesService } from "../../generated/services/Dev_tablerolesService";
import { Dev_tablephasetemplatesService } from "../../generated/services/Dev_tablephasetemplatesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";

import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";

import {
  mapCoursesForUser,
  mapCourseDetail,
  getValidationTargetPhaseName,
  isAdvisorRole,
  isDideDesignerRole,
} from "../mappers/courseMappers";
import { findRoleId } from "../utils/roleUtils";

import type { Course, CourseDetail } from "../types/course.types";
import { getRecordTimestamp } from "../../global/utils/dateUtils";
import type { ProcessEditData } from "../../processVirtualization/types/process.types";
import { PROCESS_PHASES } from "../../global/constants/domainConstants";

/**
 * Carga en paralelo todas las tablas base necesarias para mapear procesos.
 * Se reutiliza en lecturas para evitar múltiples round-trips secuenciales.
 */
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
): Promise<CourseDetail | null> => {
  const [data, deliverablesRes] = await Promise.all([
    fetchBaseData(),
    Dev_tabledeliverablesService.getAll({
      filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(processId.trim())}' and statecode eq 0`,
    }).catch(() => ({ data: [] })),
  ]);

  const process = data.processes.find(
    (p) => p.dev_tablevirtualizationprocessid === processId,
  );
  if (!process) return null;

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

type PhaseWithFormatted = Dev_tablephases & {
  "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
};

const normalizePhaseName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const matchesPhaseName = (value: string | undefined, target: string): boolean =>
  normalizePhaseName(value ?? "") === normalizePhaseName(target);

const getActivityTemplateIdFromPhase = (
  phase: PhaseWithFormatted,
): string | undefined => phase._dev_expectedactivitytemplate_value;

const findActivityTemplateIdInPhases = (
  phases: PhaseWithFormatted[],
  targetName: string,
): string | undefined => {
  for (const phase of phases) {
    const candidates = [
      phase[
        "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
      ],
      phase.dev_expectedactivitytemplatename,
      phase.dev_tablephasetemplatename,
      phase.dev_namephase,
    ];

    if (candidates.some((candidate) => matchesPhaseName(candidate, targetName))) {
      const templateId = getActivityTemplateIdFromPhase(phase);
      if (templateId) return templateId;
    }
  }

  return undefined;
};

const findActivityTemplateByName = async (
  targetName: string,
): Promise<string | undefined> => {
  const filter = `dev_activityname eq '${escapeODataString(targetName)}'`;
  const filteredResult = await Dev_tableactivitytemplatesService.getAll({
    filter,
    top: 1,
  });
  const filteredTemplate = filteredResult.data?.[0];
  if (filteredTemplate?.dev_tableactivitytemplateid) {
    return filteredTemplate.dev_tableactivitytemplateid;
  }

  const allResult = await Dev_tableactivitytemplatesService.getAll();
  const activityTemplates = allResult.data ?? [];

  return activityTemplates.find((template) =>
    matchesPhaseName(template.dev_activityname, targetName),
  )?.dev_tableactivitytemplateid;
};

const resolveActivityTemplateId = async (
  targetName: string,
  processId?: string,
  deliverableId?: string,
): Promise<string> => {
  // 1) Preferir la plantilla esperada de la fase que corresponda a targetName
  //    (evita IDs hardcodeados incorrectos entre validador/asesor).
  if (processId) {
    const phasesResult = await Dev_tablephasesService.getAll();
    const processPhases = ((phasesResult.data ?? []) as PhaseWithFormatted[])
      .filter(
        (phase) => phase._dev_tablevirtualizationprocess_value === processId,
      )
      .sort(
        (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
      );

    // Si se especifica deliverableId, buscar primero la fase vinculada a ese entregable
    if (deliverableId) {
      const deliverablePhase = processPhases.find(
        (p) => p._dev_tabledeliverable_value === deliverableId,
      );
      if (deliverablePhase) {
        const delivLabel =
          deliverablePhase[
            "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
          ] ??
          deliverablePhase.dev_expectedactivitytemplatename ??
          deliverablePhase.dev_namephase;

        const delivTemplateId = getActivityTemplateIdFromPhase(deliverablePhase);
        if (delivTemplateId && matchesPhaseName(delivLabel, targetName)) {
          return delivTemplateId;
        }
      }
    }

    // Buscar una fase del proceso cuyo nombre esperado coincida con targetName
    const matchingPhase = processPhases.find((phase) => {
      const currentLabel =
        phase[
          "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
        ] ??
        phase.dev_expectedactivitytemplatename ??
        phase.dev_namephase;
      return matchesPhaseName(currentLabel, targetName);
    });

    if (matchingPhase) {
      const currentTemplateId = getActivityTemplateIdFromPhase(matchingPhase);
      if (currentTemplateId) {
        return currentTemplateId;
      }
    }

    const processTemplateId = findActivityTemplateIdInPhases(
      processPhases,
      targetName,
    );
    if (processTemplateId) return processTemplateId;
  }

  // 2) Buscar por nombre en plantillas de actividad
  const activityTemplateId = await findActivityTemplateByName(targetName);
  if (activityTemplateId) {
    return activityTemplateId;
  }

  const [phasesResult, phaseTemplatesResult, activityTemplatesResult] =
    await Promise.all([
      Dev_tablephasesService.getAll(),
      Dev_tablephasetemplatesService.getAll(),
      Dev_tableactivitytemplatesService.getAll(),
    ]);

  const allPhases = (phasesResult.data ?? []) as PhaseWithFormatted[];
  const phaseTemplates = phaseTemplatesResult.data ?? [];
  const activityTemplates = activityTemplatesResult.data ?? [];

  const activityByPhaseName = activityTemplates.find((template) =>
    matchesPhaseName(template.dev_tablephasetemplatename, targetName),
  );
  if (activityByPhaseName?.dev_tableactivitytemplateid) {
    return activityByPhaseName.dev_tableactivitytemplateid;
  }

  const globalTemplateId = findActivityTemplateIdInPhases(allPhases, targetName);
  if (globalTemplateId) return globalTemplateId;

  const phaseTemplate = phaseTemplates.find(
    (template) =>
      matchesPhaseName(template.dev_namephase, targetName) ||
      matchesPhaseName(template.dev_conditionactivityname, targetName),
  );

  if (phaseTemplate?._dev_conditionactivity_value) {
    return phaseTemplate._dev_conditionactivity_value;
  }

  if (phaseTemplate) {
    const linkedActivity = activityTemplates.find(
      (template) =>
        template._dev_tablephasetemplate_value ===
        phaseTemplate.dev_tablephasetemplateid,
    );

    if (linkedActivity?.dev_tableactivitytemplateid) {
      return linkedActivity.dev_tableactivitytemplateid;
    }
  }

  throw new Error(
    `No se encontró la plantilla de actividad para "${targetName}".`,
  );
};

const runCuActivityFlow = async (params: {
  processId: string;
  templateActivityId: string;
  approved: boolean;
  filesJson?: string;
  observations?: string;
  /** null = cargue de syllabus del líder (el flujo no asocia entregable). */
  deliverableId?: string | null;
}): Promise<void> => {
  const input: ManualTriggerInput = {
    text_1: params.processId,
    text_2: params.templateActivityId,
  };

  input.boolean = params.approved;
  if (params.filesJson) {
    input.text_3 = params.filesJson;
  }
  if (params.observations) {
    input.text = params.observations;
  }
  // Syllabus o sin entregable: "null" como texto. Resto: ID concreto del entregable.
  if (params.deliverableId && params.deliverableId.trim()) {
    input.text_4 = params.deliverableId.trim();
  } else {
    input.text_4 = "null";
  }

  /**
   * Flujo asíncrono: confirmamos por Dataverse.
   * La actividad suele crearse antes que la nueva fase; el estado visible
   * depende de la fase, así que esperamos ambos para no mostrar datos viejos.
   */
  const before = await getProcessProgressSnapshot(params.processId);

  await runFlowAndConfirm(() => Fl_dev_cu_activityService.Run(input), {
    actionLabel: "registro de actividad",
    confirm: async () => {
      const after = await getProcessProgressSnapshot(params.processId);
      const hasNewActivity = [...after.activityIds].some(
        (id) => !before.activityIds.has(id),
      );
      const hasNewPhase = [...after.phaseIds].some(
        (id) => !before.phaseIds.has(id),
      );
      const phaseAdvanced =
        after.latestPhaseId !== before.latestPhaseId ||
        after.latestPhaseStatus !== before.latestPhaseStatus;

      return hasNewActivity && (hasNewPhase || phaseAdvanced);
    },
    timeoutMs: 120_000,
    intervalMs: 2_000,
    timeoutMessage:
      "La solicitud se envió, pero aún no se confirma el cambio en el sistema. Revisa el curso en unos minutos.",
  });
};

interface ProcessProgressSnapshot {
  activityIds: Set<string>;
  phaseIds: Set<string>;
  latestPhaseId: string;
  latestPhaseStatus: string;
}

const getProcessProgressSnapshot = async (
  processId: string,
): Promise<ProcessProgressSnapshot> => {
  const [phasesResult, activitiesResult] = await Promise.all([
    Dev_tablephasesService.getAll(),
    Dev_tableactivitiesService.getAll(),
  ]);

  const processPhases = (phasesResult.data ?? [])
    .filter(
      (phase) => phase._dev_tablevirtualizationprocess_value === processId,
    )
    .sort(
      (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a),
    );

  const phaseIds = new Set(
    processPhases.map((phase) => phase.dev_tablephaseid).filter(Boolean),
  );

  const latestPhase = processPhases[0] as
    | (Dev_tablephases & {
        "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
      })
    | undefined;

  const activityIds = new Set(
    (activitiesResult.data ?? [])
      .filter((activity) =>
        phaseIds.has(activity._dev_tablephase_value ?? ""),
      )
      .map((activity) => activity.dev_tableactivityid)
      .filter(Boolean),
  );

  return {
    activityIds,
    phaseIds,
    latestPhaseId: latestPhase?.dev_tablephaseid ?? "",
    latestPhaseStatus:
      latestPhase?.[
        "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
      ]?.trim() ||
      latestPhase?.dev_expectedactivitytemplatename?.trim() ||
      latestPhase?.dev_namephase?.trim() ||
      "",
  };
};

const extractTempFilePath = (
  data: ResponseActionOutput | undefined,
): string | undefined => {
  if (!data) return undefined;

  return (
    data.path_base ??
    (data as ResponseActionOutput & { "path-base"?: string })["path-base"]
  );
};

/**
 * Sube un archivo vía fl-dev-c-temp-folder.
 * Carpetas destino (lado flujo): proceso-{processId}/[{activityId}/]
 * - Autor: solo processId (el flujo de actividad crea la subcarpeta al registrar).
 * - Correcciones: processId + activityId del material en revisión.
 */
const uploadTempFile = async (
  file: File,
  options: { processId: string; activityId?: string },
): Promise<string> => {
  const safeName = sanitizeFileName(file.name);
  const contentBytes = await fileToBase64(file);

  const result = await Fl_dev_c_temp_folderService.Run({
    file: {
      name: safeName,
      contentBytes,
    },
    text: options.processId,
    ...(options.activityId ? { text_1: options.activityId } : {}),
  });

  const data = assertFlowResult(result, `carga de "${safeName}"`);
  const path = extractTempFilePath(data);
  if (!path) {
    throw new Error(
      `No se pudo obtener la ruta temporal del archivo "${safeName}".`,
    );
  }

  return path;
};

/** Sube varios archivos en serie para evitar saturar el gateway (502). */
const uploadTempFiles = async (
  files: File[],
  options: { processId: string; activityId?: string },
): Promise<string[]> => {
  const paths: string[] = [];

  for (const file of files) {
    paths.push(await uploadTempFile(file, options));
  }

  return paths;
};

export const approveCourseMaterial = async (params: {
  processId: string;
  userRole: string;
  /** Actividad en revisión: carpeta destino del Word adjunto. */
  activityId?: string;
  /** Entregable (categoría × crédito). Preparado para flujo por material. */
  deliverableId?: string;
  /**
   * Word obligatorio para asesor pedagógico (guía instruccional)
   * y diseñador DIDE (documento de aprobación).
   */
  files?: File[];
  observations?: string;
}): Promise<void> => {
  const targetPhaseName = getValidationTargetPhaseName(params.userRole, true);
  const templateActivityId = await resolveActivityTemplateId(
    targetPhaseName,
    params.processId,
    params.deliverableId,
  );

  const requiresWordGuide =
    isAdvisorRole(params.userRole) || isDideDesignerRole(params.userRole);

  let filePathsJson: string | undefined;
  if (requiresWordGuide) {
    const guideFiles = assertSafeWordGuide(params.files ?? []);
    const paths = await uploadTempFiles(guideFiles, {
      processId: params.processId,
      activityId: params.activityId,
    });
    filePathsJson = JSON.stringify(paths);
  } else if (params.files?.length) {
    const files = assertSafeFiles(params.files);
    const paths = await uploadTempFiles(files, {
      processId: params.processId,
      activityId: params.activityId,
    });
    filePathsJson = JSON.stringify(paths);
  }

  const observations = params.observations
    ? assertSafeDescription(params.observations, {
        label: "Las observaciones",
      })
    : undefined;

  await runCuActivityFlow({
    processId: params.processId,
    templateActivityId,
    approved: true,
    filesJson: filePathsJson,
    observations: observations || undefined,
    deliverableId: params.deliverableId,
  });
};

/**
 * @deprecated Preferir approveCourseMaterial con Word.
 * Compatibilidad: Diseñador DIDE ahora aprueba con archivo vía approve.
 */
export const finalizeCourseMaterial = async (params: {
  processId: string;
  userRole: string;
  activityId?: string;
  files?: File[];
}): Promise<void> => {
  await approveCourseMaterial(params);
};

export const returnCourseMaterial = async (params: {
  processId: string;
  userRole: string;
  /** Actividad del material en revisión: carpeta destino de correcciones. */
  activityId?: string;
  /** Entregable (categoría × crédito). Preparado para flujo por material. */
  deliverableId?: string;
  comments?: string;
  files?: File[];
}): Promise<void> => {
  if (isDideDesignerRole(params.userRole)) {
    throw new Error("El diseñador DIDE no puede devolver material.");
  }

  const targetPhaseName = getValidationTargetPhaseName(params.userRole, false);
  const templateActivityId = await resolveActivityTemplateId(
    targetPhaseName,
    params.processId,
    params.deliverableId,
  );

  const comments = assertSafeDescription(params.comments ?? "", {
    required: true,
    label: "Los comentarios",
  });
  const files = assertSafeFiles(params.files ?? []);

  let filePathsJson: string | undefined;
  if (files.length > 0) {
    const correctionPaths = await uploadTempFiles(files, {
      processId: params.processId,
      activityId: params.activityId,
    });
    filePathsJson = JSON.stringify(correctionPaths);
  }

  await runCuActivityFlow({
    processId: params.processId,
    templateActivityId,
    approved: false,
    filesJson: filePathsJson,
    observations: comments || undefined,
    deliverableId: params.deliverableId,
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
  const result = await Dev_tablecourseinstancesService.getAll();
  return result.data ?? [];
};

/** Nombres de procesos existentes (para preview / consecutivo global). */
export const getProcessNames = async (): Promise<string[]> => {
  const result = await Dev_tablevirtualizationprocessesService.getAll();
  return (result.data ?? [])
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
        "El curso se envió a crear, pero aún no aparece en el sistema. Revisa en unos minutos o intenta de nuevo.",
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
  validatorEmail: string;
  advisorEmail: string;
  leaderRoleId: string;
  authorRoleId: string;
  validatorRoleId: string;
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

  const assignedRoles = [
    { Email: leaderEmail.value, RoleID: params.leaderRoleId },
    { Email: authorEmail.value, RoleID: params.authorRoleId },
    { Email: validatorEmail.value, RoleID: params.validatorRoleId },
    { Email: advisorEmail.value, RoleID: params.advisorRoleId },
  ];

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
      confirm: async () => Boolean(await findCreatedProcessId()),
      timeoutMs: 120_000,
      intervalMs: 2_000,
      timeoutMessage:
        "El proceso se envió a crear, pero aún no aparece en el sistema. Si el flujo falló, no se habrá creado el registro.",
    },
  );

  const processId = await findCreatedProcessId();
  if (!processId) {
    throw new Error(
      "El proceso se creó, pero no se pudo obtener su identificador. Revisa la lista de procesos.",
    );
  }

  return processId;
};

/** Carga nombre, curso y correos de roles para editar un proceso existente. */
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
  if (!process?.dev_tablevirtualizationprocessid) return null;

  const courseId = process._dev_tablecourse_value ?? "";
  const course = (coursesResult.data ?? []).find(
    (item) => item.dev_tablecourseinstanceid === courseId,
  );

  const authorRoleId = findRoleId(roles, [
    "Autor de asignatura",
    "Autor de Asignatura",
  ]);
  const validatorRoleId = findRoleId(roles, [
    "Validador disciplinar",
    "Validador Disciplinar",
  ]);
  const advisorRoleId = findRoleId(roles, ["Asesor pedagógico"]);
  const leaderRoleId = findRoleId(roles, [
    "Líder de virtualización",
    "Lider de virtualizacion",
    "Líder de Virtualización",
  ]);

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
  };
};

/** Actualiza nombre y asignación de roles de un proceso (flujo create/update). */
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

  const expectedEmails = new Set(
    [
      leaderEmail.value,
      authorEmail.value,
      validatorEmail.value,
      advisorEmail.value,
    ].map((email) => email.trim().toLowerCase()),
  );

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

        const assignedEmails = new Set(
          (assignRolesResult.data ?? [])
            .map((item) => item.dev_person?.trim().toLowerCase() ?? "")
            .filter(Boolean),
        );

        const rolesMatch = [...expectedEmails].every((email) =>
          assignedEmails.has(email),
        );

        return nameMatches && rolesMatch;
      },
      timeoutMs: 120_000,
      intervalMs: 2_000,
      timeoutMessage:
        "La actualización se envió, pero aún no se refleja en el sistema. Revisa en unos minutos o intenta de nuevo.",
    },
  );
};

export const uploadCourseMaterial = async (params: {
  activityName: string;
  description: string;
  processId: string;
  files: File[];
  /**
   * ID del entregable que se carga (incluyendo syllabus).
   */
  deliverableId?: string | null;
}): Promise<void> => {
  const activityName = assertSafeTitle(
    params.activityName,
    "El nombre del recurso",
  );
  const description = assertSafeDescription(params.description, {
    label: "La descripción",
  });
  const files = assertSafeFiles(params.files, { required: true });
  const deliverableId = params.deliverableId ? params.deliverableId.trim() : null;

  if (!deliverableId) {
    throw new Error("Debes seleccionar el tipo de material a cargar.");
  }

  let isSyllabus = false;
  try {
    const delivRes = await Dev_tabledeliverablesService.get(deliverableId);
    const deliv = delivRes.data;
    if (deliv) {
      const normName = (deliv.dev_namedeliverable || "").toLowerCase();
      const normCat = (deliv.dev_tablecategorytemplatename || "").toLowerCase();
      isSyllabus =
        normName.includes("syllabus") ||
        normCat.includes("syllabus") ||
        (deliv.dev_creditnumber === 0 && normName.startsWith("syll"));
    }
  } catch {
    isSyllabus = activityName.toLowerCase().includes("syllabus");
  }

  const targetPhaseName = isSyllabus
    ? PROCESS_PHASES.LEADER_SYLLABUS
    : PROCESS_PHASES.AUTHOR_UPLOAD;

  const templateActivityId = await resolveActivityTemplateId(
    targetPhaseName,
    params.processId,
  );

  if (!templateActivityId) {
    throw new Error(
      `No se encontró la plantilla de actividad esperada para "${targetPhaseName}".`,
    );
  }

  const tempUploadResults = await uploadTempFiles(files, {
    processId: params.processId,
  });

  const observations = description
    ? `${activityName}\n\n${description}`
    : activityName;

  await runCuActivityFlow({
    processId: params.processId,
    templateActivityId,
    approved: false,
    filesJson: JSON.stringify(tempUploadResults),
    observations,
    deliverableId,
  });
};
