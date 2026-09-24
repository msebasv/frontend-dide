/**
 * Dominio de entregables: tipos, estados, paths y reglas puras (sin I/O).
 * La lectura Dataverse vive en services/deliverableService.ts.
 */
import {
  Dev_tabledeliverablesdev_deliverablestate,
  type Dev_tabledeliverables,
} from "../../generated/models/Dev_tabledeliverablesModel";
import type { Dev_tablephases } from "../../generated/models/Dev_tablephasesModel";
import { getRecordTimestamp } from "../../global/utils/dateUtils";
import { formatDomainLabel, normalizeComparableText } from "../../global/utils/textUtils";
import {
  DELIVERABLE_STATES,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
import type { CourseMaterial, ProcessFile } from "../types/course.types";
export interface ProcessDeliverableItem {
  id: string;
  /** name-deliverable (dev_namedeliverable). */
  name: string;
  /** Nombre limpio de la plantilla de categoría (dev_tablecategorytemplatename). */
  categoryName?: string;
  creditNumber: number;
  folderPath: string;
  /** deliverable-state legible. */
  stateLabel: string;
  /**
   * true si la plantilla de categoría marca el entregable como obligatorio.
   * false = opcional (p. ej. "No iniciado" / categoría no requerida).
   */
  isRequired: boolean;
  modifiedOn: string;
}

export type DeliverableUploadStatusKind =
  | "pending" // Sin cargar aún: disponible para entrega inicial
  | "returned" // Devuelto con correcciones: disponible para re-entrega
  | "in_review" // Cargado y en revisión: bloqueado para evitar duplicados
  | "approved"; // Aprobado: bloqueado

export interface DeliverableUploadStatusInfo {
  kind: DeliverableUploadStatusKind;
  /** Indica si se puede subir un archivo para este entregable. */
  canUpload: boolean;
  /** Etiqueta descriptiva del estado. */
  label: string;
  /** Texto corto para badges / select pills. */
  badgeText: string;
  /** Variante visual del badge. */
  badgeVariant: "neutral" | "warning" | "success" | "info";
  /** Mensaje explicativo para el usuario. */
  detailMessage: string;
  /** Actividad más reciente si existe. */
  latestMaterial?: CourseMaterial;
}

const DELIVERABLE_STATE_LABELS: Record<string, string> = {
  pendiente: DELIVERABLE_STATES.PENDING,
  enetapa2: DELIVERABLE_STATES.STAGE_2,
  "enetapa 2": DELIVERABLE_STATES.STAGE_2,
  etapa2aprobada: DELIVERABLE_STATES.STAGE_2_APPROVED,
  "etapa 2 aprobada": DELIVERABLE_STATES.STAGE_2_APPROVED,
  enetapa3: DELIVERABLE_STATES.STAGE_3,
  "enetapa 3": DELIVERABLE_STATES.STAGE_3,
  aprobado: DELIVERABLE_STATES.APPROVED,
  noiniciado: DELIVERABLE_STATES.NOT_STARTED,
  "no iniciado": DELIVERABLE_STATES.NOT_STARTED,
};

/** Etiqueta legible del estado del entregable (código o nombre Dataverse). */
export const formatDeliverableState = (raw: unknown): string => {
  if (typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw))) {
    const code = Number(raw) as keyof typeof Dev_tabledeliverablesdev_deliverablestate;
    const fromCode = Dev_tabledeliverablesdev_deliverablestate[code];
    if (fromCode) {
      return formatDeliverableState(fromCode);
    }
  }

  const value = String(raw ?? "").trim();
  if (!value) return PROCESS_PHASES.UNKNOWN;

  const compact = value.replace(/\s+/g, "").toLowerCase();
  const spaced = value.toLowerCase();

  const mapped =
    DELIVERABLE_STATE_LABELS[compact] ?? DELIVERABLE_STATE_LABELS[spaced];
  if (mapped) return formatDomainLabel(mapped);

  // Estado completo de Dataverse (p. ej. "Revisión y aprobación validador disciplinar").
  return formatDomainLabel(value);
};

export interface ProcessDeliverableGroup {
  /** 0 = General; >0 = unidad. */
  creditNumber: number;
  label: string;
  items: ProcessDeliverableItem[];
}

const normalizeLabel = normalizeComparableText;

/** Syllabus (entregable que solo el líder puede cargar al inicio). */
export const isSyllabusDeliverable = (
  item: Pick<ProcessDeliverableItem, "name">,
): boolean => normalizeLabel(item.name).includes("syllabus");

/**
 * ¿Esta actividad pertenece al entregable?
 * Syllabus: el flujo recibe deliverableId null, así que la fase suele venir
 * sin lookup; también se incluyen actividades sin deliverable o con nombre syllabus.
 */
export const materialBelongsToDeliverable = (
  material: { deliverableId: string; name: string },
  deliverable: Pick<ProcessDeliverableItem, "id" | "name">,
): boolean => {
  if (material.deliverableId === deliverable.id) return true;

  if (!isSyllabusDeliverable(deliverable)) return false;

  if (!material.deliverableId.trim()) return true;

  return normalizeLabel(material.name).includes("syllabus");
};

/** Busca el entregable Syllabus (puede haber varios credit 0; no usar el primero). */
export const findSyllabusDeliverable = (
  items: ProcessDeliverableItem[],
): ProcessDeliverableItem | null =>
  items.find(isSyllabusDeliverable) ?? null;

const isReturnedStatus = (status: string): boolean => {
  const norm = normalizeFolderSegment(status);
  return (
    norm.includes("devuelto") ||
    norm.includes("corregir") ||
    norm.includes("no aprobado") ||
    norm.includes("noaprobado") ||
    norm.includes("porcorregir")
  );
};

/**
 * "No iniciado": entregable opcional del cargue de documentos por el autor.
 * Se habilita igual que los obligatorios, una vez cargado el syllabus.
 */
export const isOptionalDeliverableState = (status: string): boolean => {
  const norm = normalizeFolderSegment(status);
  return norm === "no iniciado" || norm === "noiniciado";
};

const isApprovedStatus = (status: string): boolean => {
  const norm = normalizeFolderSegment(status);
  return (
    (norm.includes("aprobado") || norm.includes("terminado")) &&
    !norm.includes("no aprobado") &&
    !norm.includes("por aprobar") &&
    !norm.includes("poraprobar")
  );
};

/**
 * Entregable listo para considerar la unidad cerrada (aprobado / aula / finalizado).
 * No incluye opcionales ("No iniciado").
 */
export const isDeliverableReadyForUnitClose = (
  deliverable: ProcessDeliverableItem,
): boolean => {
  if (isOptionalDeliverableState(deliverable.stateLabel)) return false;

  const norm = normalizeFolderSegment(deliverable.stateLabel);
  if (
    (norm.includes("validacion cargue") && norm.includes("aula")) ||
    norm.includes("cargue en el aula") ||
    norm.includes("carga en el aula") ||
    (norm.includes("confirmar cargue") && norm.includes("aula"))
  ) {
    return true;
  }

  if (
    norm.includes("finalizado") ||
    norm.includes("completado") ||
    norm.includes("proceso finalizado")
  ) {
    return true;
  }

  return isApprovedStatus(deliverable.stateLabel);
};

/**
 * Unidad / General aprobada: todos los entregables obligatorios listos.
 * Los opcionales ("No iniciado") no se toman en cuenta.
 */
export const isCreditGroupApproved = (
  group: ProcessDeliverableGroup,
): boolean => {
  const mandatory = group.items.filter(
    (item) => !isOptionalDeliverableState(item.stateLabel),
  );
  if (mandatory.length === 0) return false;
  return mandatory.every(isDeliverableReadyForUnitClose);
};

/**
 * Evalúa el estado de carga de un entregable con base en las actividades registradas.
 * Garantiza que no se dupliquen entregas cuando ya están en revisión o aprobadas.
 */
export const getDeliverableUploadStatus = (
  deliverable: ProcessDeliverableItem,
  materials: CourseMaterial[] = [],
  /** Estado del proceso: los materiales se habilitan tras el syllabus. */
  options?: { processStatus?: string },
): DeliverableUploadStatusInfo => {
  const processStatus = options?.processStatus ?? "";
  const processCompleted =
    normalizeFolderSegment(processStatus) ===
      normalizeFolderSegment(PROCESS_PHASES.COMPLETED) ||
    normalizeFolderSegment(processStatus).includes("proceso finalizado");

  if (processCompleted) {
    return {
      kind: "approved",
      canUpload: false,
      label: PROCESS_PHASES.COMPLETED,
      badgeText: "Finalizado",
      badgeVariant: "success",
      detailMessage: "El proceso ya está finalizado. Solo consulta.",
    };
  }

  const linkedMaterials = materials
    .filter((material) => materialBelongsToDeliverable(material, deliverable))
    .sort(
      (a, b) =>
        new Date(b.createdOn || 0).getTime() -
        new Date(a.createdOn || 0).getTime(),
    );

  const latest = linkedMaterials[0];
  // Solo el estado del entregable (no el del proceso): cada material es independiente.
  const isGuideUploadPhase = isAdvisorGuideUploadActivity(deliverable.stateLabel);

  // Fase de guión: el asesor carga Word aunque ya existan versiones del autor.
  if (isGuideUploadPhase) {
    // Solo cuenta como guión un cargue explícito por nombre de actividad.
    // No usar "asesor + documents": la aprobación previa también crea
    // actividad del asesor (a veces con documents="null") y bloqueaba el botón.
    const hasAdvisorGuide = linkedMaterials.some((material) =>
      isAdvisorGuideMaterialLabel(
        `${material.name} ${material.description ?? ""}`,
      ),
    );

    if (hasAdvisorGuide) {
      return {
        kind: "in_review",
        canUpload: false,
        label: "Guión cargado",
        badgeText: "Cargado",
        badgeVariant: "success",
        detailMessage:
          "El guión instruccional de este entregable ya se encuentra cargado.",
        latestMaterial: latest,
      };
    }

    return {
      kind: "pending",
      canUpload: true,
      label: PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD,
      badgeText: "Guión pendiente",
      badgeVariant: "neutral",
      detailMessage:
        "Corresponde al asesor pedagógico cargar el guión instruccional en formato Word.",
      latestMaterial: latest,
    };
  }

  if (latest) {
    if (isReturnedStatus(latest.status)) {
      return {
        kind: "returned",
        canUpload: true,
        label: "Devuelto para corrección",
        badgeText: "Devuelto",
        badgeVariant: "warning",
        detailMessage:
          "El material fue devuelto con observaciones. Puede cargar una nueva versión para continuar el proceso.",
        latestMaterial: latest,
      };
    }

    if (isApprovedStatus(latest.status)) {
      return {
        kind: "approved",
        canUpload: false,
        label: DELIVERABLE_STATES.APPROVED,
        badgeText: DELIVERABLE_STATES.APPROVED,
        badgeVariant: "success",
        detailMessage:
          "Este material fue revisado y aprobado correctamente.",
        latestMaterial: latest,
      };
    }

    // Material cargado que se encuentra en revisión (por validador, asesor o diseñador)
    return {
      kind: "in_review",
      canUpload: false,
      label: "Cargado · En revisión",
      badgeText: "Cargado",
      badgeVariant: "success",
      detailMessage:
        "El material ya fue cargado y se encuentra en revisión. No es posible duplicar la entrega.",
      latestMaterial: latest,
    };
  }

  // Sin actividades previas registradas
  if (isApprovedStatus(deliverable.stateLabel)) {
    return {
      kind: "approved",
      canUpload: false,
      label: DELIVERABLE_STATES.APPROVED,
      badgeText: DELIVERABLE_STATES.APPROVED,
      badgeVariant: "success",
      detailMessage: "Este entregable ya figura como aprobado en el proceso.",
    };
  }

  const normState = normalizeFolderSegment(deliverable.stateLabel);
  if (
    normState.includes("revision") ||
    normState.includes("validador") ||
    normState.includes("evaluador") || // compat. datos antiguos
    (normState.includes("asesor") && !isAdvisorGuideUploadActivity(normState)) ||
    normState.includes("aprobar material audiovisual") ||
    (normState.includes("dide") && !normState.includes("coordinador")) ||
    normState.includes("enlaces audiovisuales") ||
    (normState.includes("registrar") && normState.includes("enlace"))
  ) {
    return {
      kind: "in_review",
      canUpload: false,
      label: "Cargado · En revisión",
      badgeText: "Cargado",
      badgeVariant: "success",
      detailMessage:
        "El material ya fue cargado y se encuentra en revisión. No es posible duplicar la entrega.",
    };
  }

  if (isSyllabusProcessActivity(deliverable.stateLabel)) {
    return {
      kind: "pending",
      canUpload: true,
      label: PROCESS_PHASES.LEADER_SYLLABUS,
      badgeText: PROCESS_PHASES.LEADER_SYLLABUS,
      badgeVariant: "neutral",
      detailMessage:
        "Corresponde al líder de virtualización cargar el syllabus para iniciar el flujo del proceso.",
    };
  }

  // Los materiales del autor solo se habilitan cuando el syllabus ya fue cargado.
  if (
    isSyllabusProcessActivity(options?.processStatus ?? "") &&
    !isSyllabusDeliverable(deliverable)
  ) {
    return {
      kind: "pending",
      canUpload: false,
      label: "En espera del syllabus",
      badgeText: "En espera",
      badgeVariant: "neutral",
      detailMessage:
        "Este material permanecerá deshabilitado hasta que el líder de virtualización cargue el syllabus del proceso.",
    };
  }

  if (isOptionalDeliverableState(deliverable.stateLabel)) {
    return {
      kind: "pending",
      canUpload: true,
      label: "Pendiente · Opcional",
      badgeText: "Opcional",
      badgeVariant: "neutral",
      detailMessage:
        "Este material es opcional en el cargue de documentos del autor. Puede cargarlo si el curso lo requiere.",
    };
  }

  return {
    kind: "pending",
    canUpload: true,
    label: "Pendiente",
    badgeText: "Pendiente",
    badgeVariant: "neutral",
    detailMessage:
      "Este material no ha sido cargado. Se encuentra disponible para su primera entrega.",
  };
};

/** Segmento de carpeta SharePoint según crédito (general | credito-N o credito N). */
export const formatCreditFolderSegment = (creditNumber: number): string =>
  creditNumber === 0 ? "general" : `credito ${creditNumber}`;

/**
 * Normaliza un segmento o ruta para comparaciones uniformes:
 * - Decodifica URI (%20 -> espacio)
 * - Minúsculas
 * - Remueve diacríticos y tildes
 * - Colapsa guiones, guiones bajos y espacios múltiples
 */
export const normalizeFolderSegment = (value: string): string => {
  if (!value) return "";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // fallback
  }
  return decoded
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
};

/**
 * Metadatos de la carpeta de versión en SharePoint:
 * `v01- Cargue de documentos por el autor - 9e4da645`
 * `v01- Revision y aprobación validador disciplinar (devuelto) - 17e9507d`
 */
export interface ActivityVersionFolderMeta {
  /** Número de versión (1, 2, …). */
  version: number;
  /** Etiqueta de estado/fase de la carpeta. */
  statusLabel: string;
  /** Prefijo del GUID de actividad (normalmente 8 caracteres hex). */
  activityIdPrefix: string;
  /** Nombre crudo de la carpeta. */
  folderName: string;
}

/** Detecta carpetas de versión: v01- estado - idActivity */
export const parseActivityVersionFolder = (
  folderName: string,
): ActivityVersionFolderMeta | null => {
  if (!folderName?.trim()) return null;

  let decoded = folderName.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // fallback
  }

  const match = decoded.match(
    /^v0*(\d+)\s*[-–]\s*(.+?)\s*[-–]\s*([0-9a-fA-F]{6,12})\s*$/i,
  );
  if (!match) return null;

  const version = Number(match[1]);
  const statusLabel = match[2].trim();
  const activityIdPrefix = match[3].toLowerCase();
  if (!Number.isFinite(version) || version < 1 || !statusLabel || !activityIdPrefix) {
    return null;
  }

  return {
    version,
    statusLabel,
    activityIdPrefix,
    folderName: decoded,
  };
};

export const isActivityVersionFolderSegment = (segment: string): boolean =>
  parseActivityVersionFolder(segment) != null;

/** Prefijo de actividad usado en nombres de carpeta SharePoint (primer bloque del GUID). */
export const getActivityIdFolderPrefix = (activityId: string): string => {
  const trimmed = activityId.trim().toLowerCase();
  if (!trimmed) return "";
  const firstBlock = trimmed.split("-")[0] ?? trimmed;
  return firstBlock.slice(0, 12);
};

/**
 * Indica si la ruta del archivo pertenece a la actividad (GUID completo o
 * carpeta `vNN- estado - prefijo`).
 * Funciona igual para autor, validador, asesor, diseñador DIDE, etc.
 */
export const fileBelongsToActivity = (
  filePath: string,
  activityId: string,
): boolean => {
  let path = filePath.replace(/\\/g, "/");
  try {
    path = decodeURIComponent(path);
  } catch {
    // fallback
  }
  path = path.toLowerCase();
  const id = activityId.trim().toLowerCase();
  if (!path || !id) return false;

  if (
    path.includes(`/${id}/`) ||
    path.includes(`/${id}`) ||
    path.endsWith(`/${id}`) ||
    path.endsWith(id)
  ) {
    return true;
  }

  const prefix = getActivityIdFolderPrefix(id);
  if (!prefix || prefix.length < 6) return false;

  // Match robusto del sufijo de carpeta: "... - 9e4da645"
  if (
    path.includes(`- ${prefix}/`) ||
    path.includes(`-${prefix}/`) ||
    path.includes(`- ${prefix}`) ||
    path.endsWith(`-${prefix}`)
  ) {
    return true;
  }

  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => {
    let decodedSeg = segment;
    try {
      decodedSeg = decodeURIComponent(segment);
    } catch {
      // fallback
    }

    const meta = parseActivityVersionFolder(decodedSeg);
    if (meta) {
      return (
        meta.activityIdPrefix === prefix ||
        prefix.startsWith(meta.activityIdPrefix) ||
        meta.activityIdPrefix.startsWith(prefix)
      );
    }
    // Compatibilidad: carpeta nombrada solo con el prefijo o el GUID
    return (
      decodedSeg === id ||
      decodedSeg === prefix ||
      decodedSeg.startsWith(`${prefix}-`) ||
      decodedSeg.endsWith(`- ${prefix}`) ||
      decodedSeg.endsWith(`-${prefix}`)
    );
  });
};

/** Extrae metadatos de versión desde la ruta del archivo. */
export const extractActivityVersionMetaFromPath = (
  filePath: string,
): ActivityVersionFolderMeta | null => {
  if (!filePath) return null;
  let path = filePath.replace(/\\/g, "/");
  try {
    path = decodeURIComponent(path);
  } catch {
    // fallback
  }

  const segments = path.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const meta = parseActivityVersionFolder(segments[i]);
    if (meta) return meta;
  }
  return null;
};

/** Ruta visible: Categoría / general | credito N */
export const formatDeliverableSharePointLocation = (
  item: Pick<ProcessDeliverableItem, "name" | "creditNumber"> & {
    categoryName?: string;
  },
): string => {
  const category =
    item.categoryName?.trim() ||
    item.name.replace(/\s+\d+$/, "").trim() ||
    item.name;
  return `${category} / ${formatCreditFolderSegment(item.creditNumber)}`;
};

const normalizePath = (value: string): string =>
  value.trim().replace(/\\/g, "/").replace(/\/+$/, "");

const endsWithCreditSegment = (path: string, creditNumber: number): boolean => {
  const norm = normalizeFolderSegment(path);
  const target =
    creditNumber === 0 ? "general" : `credito ${creditNumber}`;
  return (
    norm === target ||
    norm.endsWith(`/${target}`) ||
    norm.endsWith(` ${target}`)
  );
};

/**
 * Extrae los segmentos de carpetas relativos a la raíz del proceso.
 * Ejemplo:
 * ".../Shared Documents/proceso-123/guia de actividades/credito 1/tarea.docx"
 * -> ["guia de actividades", "credito 1"]
 */
export const extractProcessRelativeSegments = (
  filePath: string,
  processId?: string,
  processFolderBase = "",
): string[] => {
  if (!filePath) return [];
  let path = filePath.replace(/\\/g, "/");
  try {
    path = decodeURIComponent(path);
  } catch {
    // fallback
  }

  const cleanBase = processFolderBase
    ? processFolderBase.split("/").filter(Boolean).pop()?.trim() || ""
    : "";

  const rootCandidates = [
    cleanBase,
    processId ? `proceso-${processId}` : "",
    processId ? processId.trim() : "",
  ].filter(Boolean);

  let afterProcessPath = "";

  for (const token of rootCandidates) {
    const idx = path.toLowerCase().indexOf(token.toLowerCase());
    if (idx >= 0) {
      afterProcessPath = path.slice(idx + token.length).replace(/^\/+/, "");
      break;
    }
  }

  if (!afterProcessPath) {
    const match = path.match(/(?:^|\/)(proceso-[^/]+)\/(.*)$/i);
    if (match && match[2]) {
      afterProcessPath = match[2];
    }
  }

  const fullSegments = (afterProcessPath || path).split("/").filter(Boolean);
  // El último segmento corresponde al nombre del archivo; devolvemos solo las carpetas.
  return fullSegments.length > 1 ? fullSegments.slice(0, -1) : [];
};

/**
 * Determina con precisión si un archivo de SharePoint pertenece al entregable seleccionado
 * según la estructura: proceso-id / categoría / (general | credito-N o credito N) / archivo.
 */
export const fileBelongsToDeliverable = (
  file: ProcessFile,
  deliverable: ProcessDeliverableItem,
  processId?: string,
  processFolderBase = "",
): boolean => {
  const filePath = file.connectorPath || file.path || file.previewUrl || "";
  if (!filePath) return false;

  // 1. Coincidencia directa con folderPath si Dataverse lo tiene almacenado
  if (deliverable.folderPath?.trim()) {
    const normStored = normalizeFolderSegment(deliverable.folderPath);
    const normPath = normalizeFolderSegment(filePath);
    if (normStored && normPath.includes(normStored)) {
      return true;
    }
  }

  const dirSegments = extractProcessRelativeSegments(
    filePath,
    processId,
    processFolderBase,
  );

  // Si no está dentro de una subcarpeta del proceso, no pertenece a este entregable
  if (dirSegments.length === 0) return false;

  const normalizedDirSegments = dirSegments.map(normalizeFolderSegment);

  // 2. Validación de ámbito (crédito vs general)
  const targetCredit = deliverable.creditNumber;
  const isGeneral = targetCredit === 0;

  if (isGeneral) {
    // Si el entregable es general, el archivo NO debe estar dentro de una carpeta de crédito (> 0)
    const hasCreditFolder = normalizedDirSegments.some((seg) => {
      const match = seg.match(/^(?:credito|unidad)\s*(\d+)$/);
      return match != null && Number(match[1]) > 0;
    });
    if (hasCreditFolder) return false;

    // Para general, debe estar en subcarpeta "general", o si es syllabus puede estar directamente en syllabus/
    const hasGeneralFolder = normalizedDirSegments.some(
      (seg) => seg === "general",
    );
    const isSyllabus = isSyllabusDeliverable(deliverable);
    if (!hasGeneralFolder && !isSyllabus && normalizedDirSegments.length > 1) {
      return false;
    }
  } else {
    // Es un crédito específico (N > 0, ej: crédito 1)
    // El archivo NO debe estar en carpeta "general"
    const hasGeneralFolder = normalizedDirSegments.some(
      (seg) => seg === "general",
    );
    if (hasGeneralFolder) return false;

    // El archivo NO debe estar en la carpeta de OTRO crédito diferente
    const conflictsWithOtherCredit = normalizedDirSegments.some((seg) => {
      const match = seg.match(/(?:credito|unidad)\s*(\d+)/);
      return match != null && Number(match[1]) !== targetCredit;
    });
    if (conflictsWithOtherCredit) return false;

    // El archivo DEBE estar en la carpeta de este crédito (ej. "credito 1", "credito-1", "unidad 1")
    const creditMatches = normalizedDirSegments.some((seg) => {
      const match = seg.match(/(?:credito|unidad)\s*(\d+)/);
      return match != null && Number(match[1]) === targetCredit;
    });
    if (!creditMatches) return false;
  }

  // 3. Validación de categoría
  const categoryCandidates: string[] = [];
  if (deliverable.categoryName?.trim()) {
    categoryCandidates.push(normalizeFolderSegment(deliverable.categoryName));
  }
  if (deliverable.name?.trim()) {
    const normName = normalizeFolderSegment(deliverable.name);
    categoryCandidates.push(normName);
    // Quitar el número al final si viene (ej. "guia de actividades 1" -> "guia de actividades")
    const stripped = normName.replace(/\s+\d+$/, "").trim();
    if (stripped && stripped !== normName) {
      categoryCandidates.push(stripped);
    }
  }
  if (isSyllabusDeliverable(deliverable)) {
    categoryCandidates.push("syllabus");
  }

  // Verificar si alguno de los segmentos de directorio corresponde a la categoría
  const categoryMatches = normalizedDirSegments.some((seg, index) => {
    // Omitir crédito, general y carpetas de versión (v01- estado - idActivity)
    if (/^(?:credito|unidad)\s*\d+$/.test(seg) || seg === "general") {
      return false;
    }
    if (isActivityVersionFolderSegment(dirSegments[index] ?? "")) {
      return false;
    }

    return categoryCandidates.some((candidate) => {
      if (!candidate) return false;
      return (
        seg === candidate ||
        seg.includes(candidate) ||
        candidate.includes(seg)
      );
    });
  });

  return categoryMatches;
};

/**
 * Resuelve la carpeta hoja en SharePoint:
 * proceso → nombre-categoría → general | credito 1
 *
 * Si Dataverse ya trae folderPath hasta el segmento de crédito, se respeta;
 * si llega a la categoría (o al proceso), se completa.
 */
export const resolveDeliverableFilesFolder = (
  item: Pick<ProcessDeliverableItem, "name" | "creditNumber" | "folderPath"> & {
    categoryName?: string;
  },
  processFolderBase = "",
): string => {
  const creditSegment = formatCreditFolderSegment(item.creditNumber);
  const stored = normalizePath(item.folderPath || "");

  if (stored && endsWithCreditSegment(stored, item.creditNumber)) {
    return stored;
  }

  if (stored) {
    return `${stored}/${creditSegment}`;
  }

  const processBase = normalizePath(processFolderBase);
  const category =
    item.categoryName?.trim() ||
    item.name.replace(/\s+\d+$/, "").trim() ||
    item.name.trim() ||
    "categoria";
  if (processBase) {
    return `${processBase}/${category}/${creditSegment}`;
  }

  return `${category}/${creditSegment}`;
};

/** Etiqueta de opción para el selector de carga. */
export const formatDeliverableUploadLabel = (
  item: ProcessDeliverableItem,
): string => {
  const scope =
    item.creditNumber === 0
      ? "General"
      : `Unidad ${item.creditNumber}`;
  const requirement = item.isRequired ? "Obligatorio" : "Opcional";
  return `${item.name} · ${scope} · ${requirement}`;
};

/**
 * Entregables disponibles para carga según el rol.
 * El líder de virtualización solo puede cargar el syllabus (por nombre, no por credit 0).
 */
export const filterDeliverablesForUpload = (
  groups: ProcessDeliverableGroup[],
  options?: { syllabusOnly?: boolean },
): ProcessDeliverableItem[] => {
  const items = groups.flatMap((group) => group.items);
  if (options?.syllabusOnly) {
    return items.filter(isSyllabusDeliverable);
  }
  // El autor carga materiales distintos al syllabus inicial del líder.
  return items.filter((item) => !isSyllabusDeliverable(item));
};

const normalizeCreditNumber = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.trunc(numeric);
};

/** Estado crudo del entregable en Dataverse, ya normalizado a etiqueta de UI. */
export const resolveDeliverableStateLabel = (
  row: Dev_tabledeliverables,
): string => {
  const formatted = (
    row as Dev_tabledeliverables & {
      "dev_deliverablestate@OData.Community.Display.V1.FormattedValue"?: string;
    }
  )["dev_deliverablestate@OData.Community.Display.V1.FormattedValue"]?.trim();

  if (formatted) return formatDeliverableState(formatted);

  if (row.dev_deliverablestatename?.trim()) {
    return formatDeliverableState(row.dev_deliverablestatename);
  }

  return formatDeliverableState(row.dev_deliverablestate);
};

/** Actividad esperada de una fase (formatted value → nombre → lookup). */
export const resolvePhaseExpectedActivity = <
  T extends { dev_activityname?: string },
>(
  phase: Dev_tablephases,
  templatesMap?: Map<string, T>,
): string =>
  (
    phase as Dev_tablephases & {
      "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"?: string;
    }
  )[
    "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
  ]?.trim() ||
  phase.dev_expectedactivitytemplatename?.trim() ||
  templatesMap?.get(phase._dev_expectedactivitytemplate_value ?? "")
    ?.dev_activityname?.trim() ||
  "";

/** Fase ligada al entregable (lookup directo o fase actual del registro). */
export const findDeliverablePhase = <
  T extends Dev_tablephases,
>(
  deliverable: Pick<
    Dev_tabledeliverables,
    "dev_tabledeliverableid" | "_dev_tablephasecurrent_value"
  >,
  phases: T[],
): T | undefined =>
  phases
    // Solo fases activas: el detalle las consulta ya filtradas por statecode.
    .filter((phase) => Number(phase.statecode ?? 0) === 0)
    .filter(
      (phase) =>
        phase._dev_tabledeliverable_value ===
          deliverable.dev_tabledeliverableid ||
        (Boolean(deliverable._dev_tablephasecurrent_value) &&
          deliverable._dev_tablephasecurrent_value === phase.dev_tablephaseid),
    )
    .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a))[0];

const isGenericPendingState = (label: string): boolean => {
  const norm = label.trim().toLowerCase();
  return (
    !norm ||
    norm === "pendiente" ||
    norm === "sin estado" ||
    norm === "no iniciado" ||
    norm.includes("etapa")
  );
};

/**
 * Estado efectivo del entregable: fuente única para la tabla "Mis cursos" y el
 * detalle del proceso. Cuando Dataverse deja un estado genérico (Pendiente,
 * No iniciado o "En etapa N"), se usa la actividad esperada de la fase ligada
 * al entregable, que es lo que ve el usuario en el detalle.
 */
export const resolveEffectiveDeliverableState = (input: {
  rawStateLabel: string;
  deliverableName: string;
  /** Actividad esperada de la fase ligada al entregable. */
  phaseExpectedActivity: string;
  /** Actividad esperada de la fase más reciente del proceso. */
  processCurrentActivity: string;
}): string => {
  const isSyllabus = isSyllabusDeliverable({ name: input.deliverableName });

  if (isSyllabusProcessActivity(input.processCurrentActivity) && isSyllabus) {
    return PROCESS_PHASES.LEADER_SYLLABUS;
  }

  const effectivePhaseActivity =
    input.phaseExpectedActivity ||
    (isSyllabus ? input.processCurrentActivity : "");

  return effectivePhaseActivity && isGenericPendingState(input.rawStateLabel)
    ? effectivePhaseActivity
    : input.rawStateLabel || effectivePhaseActivity || PROCESS_PHASES.UNKNOWN;
};

const isSyllabusProcessActivity = (activityName: string): boolean => {
  const norm = normalizeComparableText(activityName);
  if (!norm) return false;
  if (norm === PROCESS_PHASES.LEADER_SYLLABUS.toLowerCase()) return true;
  return (
    norm.includes("syllabus") &&
    (norm.includes("cargue") ||
      norm.includes("carga") ||
      norm === "syllabus" ||
      norm.startsWith("syllabus ("))
  );
};

/**
 * ¿Nombre/descripción/estado corresponde al guión instruccional del asesor?
 * Exportado para la tarjeta "Versión final" y el panel de archivos.
 */
export const isAdvisorGuideMaterialLabel = (value: string): boolean => {
  const norm = normalizeFolderSegment(value);
  if (!norm) return false;
  return (
    norm.includes("guion instruccional") ||
    norm.includes("guia instruccional") ||
    norm.includes("guion instruct") ||
    norm.includes("guia instruct") ||
    norm.includes("cargar guion") ||
    norm.includes("cargar guia")
  );
};

/** ¿La ruta SharePoint parece carpeta/archivo del guión instruccional? */
export const pathLooksLikeAdvisorGuide = (filePath: string): boolean => {
  if (!filePath) return false;
  let path = filePath.replace(/\\/g, "/");
  try {
    path = decodeURIComponent(path);
  } catch {
    // fallback
  }

  return path.split("/").filter(Boolean).some((segment) => {
    const meta = parseActivityVersionFolder(segment);
    if (meta && isAdvisorGuideMaterialLabel(meta.statusLabel)) {
      return true;
    }
    return isAdvisorGuideMaterialLabel(segment);
  });
};

/** ¿Estado = Cargar Guión instruccional? (local para evitar ciclo con courseMappers). */
const isAdvisorGuideUploadActivity = (activityName: string): boolean =>
  isAdvisorGuideMaterialLabel(activityName);

/**
 * Construye grupos de entregables a partir de filas ya cargadas (sin I/O).
 * Usado por listProcessDeliverableGroups tras consultar Dataverse.
 */
export const buildProcessDeliverableGroups = (
  deliverables: Dev_tabledeliverables[],
  phases: Dev_tablephases[],
  templatesMap: Map<string, { dev_activityname?: string }>,
  requiredByCategoryId: Map<string, boolean>,
): ProcessDeliverableGroup[] => {
  // Estado actual del proceso (fase más reciente): alinea detalle con la tabla.
  const processCurrentActivity =
    [...phases]
      .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a))
      .map((phase) => resolvePhaseExpectedActivity(phase, templatesMap))
      .find((name) => Boolean(name)) ?? "";

  const items: ProcessDeliverableItem[] = deliverables.map((row) => {
    const creditNumber = normalizeCreditNumber(row.dev_creditnumber);
    const name = row.dev_namedeliverable?.trim() || "Entregable";
    const categoryName =
      row.dev_tablecategorytemplatename?.trim() ||
      (row as unknown as Record<string, unknown>)[
        "_dev_tablecategorytemplate_value@OData.Community.Display.V1.FormattedValue"
      ]?.toString().trim() ||
      "";

    // Fases asociadas al entregable
    const linkedPhases = phases
      .filter((phase) => {
        if (phase._dev_tabledeliverable_value === row.dev_tabledeliverableid) {
          return true;
        }
        if (
          row._dev_tablephasecurrent_value &&
          row._dev_tablephasecurrent_value === phase.dev_tablephaseid
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));

    const latestPhase = linkedPhases[0];
    const phaseExpectedActivity = latestPhase
      ? resolvePhaseExpectedActivity(latestPhase, templatesMap)
      : "";

    // Syllabus en fase de proceso "Cargue Syllabus": la fase a menudo no trae
    // lookup al entregable, y Dataverse deja deliverable-state en "Pendiente".
    const stateLabel = resolveEffectiveDeliverableState({
      rawStateLabel: resolveDeliverableStateLabel(row),
      deliverableName: name,
      phaseExpectedActivity,
      processCurrentActivity,
    });

    const categoryId = row._dev_tablecategorytemplate_value ?? "";
    const requiredFromTemplate =
      categoryId && requiredByCategoryId.has(categoryId)
        ? requiredByCategoryId.get(categoryId)
        : undefined;
    // Syllabus siempre obligatorio; sin plantilla, "No iniciado" = opcional.
    const isRequired =
      requiredFromTemplate ??
      (isSyllabusDeliverable({ name }) ||
        !isOptionalDeliverableState(stateLabel));

    return {
      id: row.dev_tabledeliverableid,
      name,
      categoryName,
      creditNumber,
      folderPath: row.dev_folderpath?.trim() || "",
      stateLabel,
      isRequired,
      modifiedOn: row.modifiedon ?? row.createdon ?? "",
    };
  });

  const byCredit = new Map<number, ProcessDeliverableItem[]>();
  for (const item of items) {
    const bucket = byCredit.get(item.creditNumber) ?? [];
    bucket.push(item);
    byCredit.set(item.creditNumber, bucket);
  }

  return [...byCredit.entries()]
    .sort(([a], [b]) => a - b)
    .map(([creditNumber, groupItems]) => ({
      creditNumber,
      label:
        creditNumber === 0
          ? "General"
          : `Unidad ${creditNumber}`,
      items: groupItems.sort((a, b) => a.name.localeCompare(b.name, "es")),
    }));
};