/**
 * Servicio de cursos — acciones sobre material (cargue / validación / aula).
 *
 * Consultas → courseQueryService.ts (re-exportadas abajo).
 * Mutaciones de proceso → processVirtualization/services/processMutationService.ts
 *   (re-exportadas abajo).
 */
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitiesService } from "../../generated/services/Dev_tableactivitiesService";
import { Dev_tablephasetemplatesService } from "../../generated/services/Dev_tablephasetemplatesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Fl_dev_c_temp_folderService } from "../../generated/services/Fl_dev_c_temp_folderService";
import { Fl_dev_cu_activityService } from "../../generated/services/Fl_dev_cu_activityService";
import type { ManualTriggerInput } from "../../generated/models/Fl_dev_cu_activityModel";
import type { ResponseActionOutput } from "../../generated/models/Fl_dev_c_temp_folderModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import { fileToBase64 } from "../../global/utils/fileUtils";
import {
  assertFlowResult,
  runFlowAndConfirm,
} from "../../global/utils/flowResult";
import { normalizeComparableText } from "../../global/utils/textUtils";
import {
  assertSafeDescription,
  assertSafeFiles,
  assertSafeTitle,
  assertSafeWordGuide,
  escapeODataString,
  sanitizeFileName,
} from "../../global/utils/inputValidation";
import {
  getValidationTargetPhaseName,
  isAdvisorRole,
  isDideDesignerRole,
  type PhaseWithFormatted,
} from "../mappers/courseMappers";
import { getRecordTimestamp } from "../../global/utils/dateUtils";
import {
  isProcessCloseReady,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
import { getProcessForEdit } from "./courseQueryService";

/* ── Re-exports de compatibilidad ── */
export {
  getCoursesForUser,
  getCourseDetail,
  getFaculties,
  getPrograms,
  getAvailableCourses,
  getProcessNames,
  getRoles,
  getAssignRolesUsers,
  getProcessForEdit,
} from "./courseQueryService";

export {
  createCourseInstance,
  createVirtualizationProcess,
  updateVirtualizationProcess,
  assignProcessValidator,
  assignProcessDideDesigner,
} from "../../processVirtualization/services/processMutationService";

const normalizePhaseName = normalizeComparableText;

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
  if (params.filesJson !== undefined) {
    // text_3 → documents. Diseñador DIDE envía "null" (sin rutas SharePoint).
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
      "La solicitud se envió correctamente; el cambio aún no se refleja en el sistema. Consulte el curso en unos minutos.",
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
  /** Actividad en revisión: carpeta destino si se adjuntan archivos. */
  activityId?: string;
  /** Entregable (categoría × crédito). Preparado para flujo por material. */
  deliverableId?: string;
  /** Archivos opcionales (el asesor ya no adjunta el guión al aprobar). */
  files?: File[];
  /**
   * Observaciones de aprobación (diseñador DIDE: texto plano en observations;
   * documents / text_3 = null).
   */
  observations?: string;
  /**
   * Estado actual del entregable/proceso: permite al asesor usar la plantilla
   * correcta (revisión pedagógica vs aprobar material audiovisual DIDE).
   */
  currentStatus?: string;
}): Promise<void> => {
  const targetPhaseName = getValidationTargetPhaseName(
    params.userRole,
    true,
    params.currentStatus,
  );
  const templateActivityId = await resolveActivityTemplateId(
    targetPhaseName,
    params.processId,
    params.deliverableId,
  );

  const isDideDesigner = isDideDesignerRole(params.userRole);

  /**
   * Diseñador DIDE: sin temp-folder.
   * text (observations) = texto plano; text_3 (documents) = null.
   */
  if (isDideDesigner) {
    const text = assertSafeDescription(params.observations ?? "", {
      required: true,
      label: "Las observaciones",
      allowUrls: true,
    });

    await runCuActivityFlow({
      processId: params.processId,
      templateActivityId,
      approved: false,
      filesJson: "null",
      observations: text,
      deliverableId: params.deliverableId,
    });
    return;
  }

  // Asesor y validador: aprobación sin archivo (salvo archivos opcionales legacy).
  let filePathsJson: string | undefined;
  if (!isAdvisorRole(params.userRole) && params.files?.length) {
    const files = assertSafeFiles(params.files);
    const paths = await uploadTempFiles(files, {
      processId: params.processId,
      activityId: params.activityId,
    });
    filePathsJson = JSON.stringify(paths);
  }

  const text = assertSafeDescription(params.observations ?? "", {
    required: false,
    label: "Las observaciones",
  });

  await runCuActivityFlow({
    processId: params.processId,
    templateActivityId,
    approved: true,
    filesJson: filePathsJson,
    observations: text || undefined,
    deliverableId: params.deliverableId,
  });
};

/**
 * @deprecated Preferir approveCourseMaterial.
 * Compatibilidad: Diseñador DIDE ahora aprueba con observaciones vía approve.
 */
export const finalizeCourseMaterial = async (params: {
  processId: string;
  userRole: string;
  activityId?: string;
  files?: File[];
}): Promise<void> => {
  await approveCourseMaterial(params);
};

/**
 * Líder de virtualización: confirma el cargue en el aula.
 * Requiere que el estado ya sea "Validación Cargue en el Aula".
 * text_3 (documents) = "[]"; text_4 (deliverable-id) = "null".
 *
 * Al completar, el flujo marca close-ready (dev_closeready) en true
 * sobre el virtualization-process (ya no usa Status Reason Closed).
 */
export const confirmClassroomUpload = async (params: {
  processId: string;
}): Promise<void> => {
  const processId = params.processId.trim();
  if (!processId) {
    throw new Error("Falta el identificador del proceso.");
  }

  const templateActivityId = await resolveActivityTemplateId(
    PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM,
    processId,
  );

  const input: ManualTriggerInput = {
    text_1: processId,
    text_2: templateActivityId,
    boolean: true,
    text_3: "[]",
    text_4: "null",
  };

  await runFlowAndConfirm(() => Fl_dev_cu_activityService.Run(input), {
    actionLabel: "confirmación de cargue en el aula",
    confirm: async () => {
      const processResult =
        await Dev_tablevirtualizationprocessesService.get(processId);
      const process = processResult.data;
      return isProcessCloseReady(
        process?.dev_closeready,
        process?.dev_closereadyname,
      );
    },
    timeoutMs: 120_000,
    intervalMs: 2_000,
    timeoutMessage:
      "La confirmación se envió correctamente; el proceso aún no figura como finalizado. Consulte el estado en unos minutos.",
  });
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
  /** Estado actual del entregable (asesor: revisión vs audiovisual DIDE). */
  currentStatus?: string;
}): Promise<void> => {
  if (isDideDesignerRole(params.userRole)) {
    throw new Error("El diseñador DIDE no puede devolver material.");
  }

  const targetPhaseName = getValidationTargetPhaseName(
    params.userRole,
    false,
    params.currentStatus,
  );
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

export const uploadCourseMaterial = async (params: {
  activityName: string;
  description: string;
  processId: string;
  files: File[];
  /**
   * ID del entregable que se carga (incluyendo syllabus).
   */
  deliverableId?: string | null;
  /** Rol activo: el asesor carga el guión en su fase propia. */
  userRole?: string;
}): Promise<void> => {
  const activityName = assertSafeTitle(
    params.activityName,
    "El nombre del recurso",
  );
  const description = assertSafeDescription(params.description, {
    label: "La descripción",
  });
  const isAdvisorGuide = isAdvisorRole(params.userRole ?? "");
  const files = isAdvisorGuide
    ? assertSafeWordGuide(params.files)
    : assertSafeFiles(params.files, { required: true });
  const deliverableId = params.deliverableId ? params.deliverableId.trim() : null;

  if (!deliverableId) {
    throw new Error("Debe seleccionar el tipo de material a cargar.");
  }

  if (isAdvisorGuide) {
    const editData = await getProcessForEdit(params.processId);
    if (!editData?.designerEmail?.trim()) {
      throw new Error(
        "No es posible cargar el guión instruccional hasta que el Coordinador de Diseñadores asigne el Diseñador DIDE a este proceso.",
      );
    }
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
    : isAdvisorGuide
      ? PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD
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

  const observations = isAdvisorGuide
    ? description
      ? `Guión instruccional\n\n${description}`
      : "Guión instruccional"
    : description
      ? `${activityName}\n\n${description}`
      : activityName;

  await runCuActivityFlow({
    processId: params.processId,
    templateActivityId,
    // El guión del asesor es una entrega (no una aprobación de revisión).
    approved: false,
    filesJson: JSON.stringify(tempUploadResults),
    observations,
    deliverableId,
  });
};

