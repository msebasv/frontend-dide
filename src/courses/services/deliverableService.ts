/**
 * Entregables del proceso: carpetas por crédito (unidad) / general.
 * creditnumber 0 = General; 1..N = por crédito.
 * Nombre visible = name-deliverable; estado = deliverable-state.
 */
import {
  Dev_tabledeliverablesdev_deliverablestate,
  type Dev_tabledeliverables,
} from "../../generated/models/Dev_tabledeliverablesModel";
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { escapeODataString } from "../../global/utils/inputValidation";
import { getRecordTimestamp } from "../../global/utils/dateUtils";
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
  pendiente: "Pendiente",
  enetapa2: "En etapa 2",
  "enetapa 2": "En etapa 2",
  etapa2aprobada: "Etapa 2 aprobada",
  "etapa 2 aprobada": "Etapa 2 aprobada",
  enetapa3: "En etapa 3",
  "enetapa 3": "En etapa 3",
  aprobado: "Aprobado",
  noiniciado: "No iniciado",
  "no iniciado": "No iniciado",
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
  if (!value) return "Sin estado";

  const compact = value.replace(/\s+/g, "").toLowerCase();
  const spaced = value.toLowerCase();

  return (
    DELIVERABLE_STATE_LABELS[compact] ??
    DELIVERABLE_STATE_LABELS[spaced] ??
    value
  );
};

export interface ProcessDeliverableGroup {
  /** 0 = General; >0 = crédito / unidad. */
  creditNumber: number;
  label: string;
  items: ProcessDeliverableItem[];
}

const normalizeLabel = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

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
 * Evalúa el estado de carga de un entregable con base en las actividades registradas.
 * Garantiza que no se dupliquen entregas cuando ya están en revisión o aprobadas.
 */
export const getDeliverableUploadStatus = (
  deliverable: ProcessDeliverableItem,
  materials: CourseMaterial[] = [],
): DeliverableUploadStatusInfo => {
  const linkedMaterials = materials
    .filter((material) => materialBelongsToDeliverable(material, deliverable))
    .sort(
      (a, b) =>
        new Date(b.createdOn || 0).getTime() -
        new Date(a.createdOn || 0).getTime(),
    );

  const latest = linkedMaterials[0];

  if (latest) {
    if (isReturnedStatus(latest.status)) {
      return {
        kind: "returned",
        canUpload: true,
        label: "Devuelto para corrección",
        badgeText: "Devuelto",
        badgeVariant: "warning",
        detailMessage:
          "Este material fue devuelto con observaciones y está listo para que cargues la nueva versión.",
        latestMaterial: latest,
      };
    }

    if (isApprovedStatus(latest.status)) {
      return {
        kind: "approved",
        canUpload: false,
        label: "Aprobado",
        badgeText: "Aprobado",
        badgeVariant: "success",
        detailMessage:
          "Este material ya ha sido revisado y aprobado satisfactoriamente.",
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
        "Este material ya fue cargado y se encuentra actualmente en revisión. No se permite duplicar la entrega.",
      latestMaterial: latest,
    };
  }

  // Sin actividades previas registradas
  if (isApprovedStatus(deliverable.stateLabel)) {
    return {
      kind: "approved",
      canUpload: false,
      label: "Aprobado",
      badgeText: "Aprobado",
      badgeVariant: "success",
      detailMessage: "Este entregable ya figura como aprobado en el proceso.",
    };
  }

  const normState = normalizeFolderSegment(deliverable.stateLabel);
  if (
    normState.includes("revision") ||
    normState.includes("evaluador") ||
    normState.includes("asesor") ||
    normState.includes("dide")
  ) {
    return {
      kind: "in_review",
      canUpload: false,
      label: "Cargado · En revisión",
      badgeText: "Cargado",
      badgeVariant: "success",
      detailMessage:
        "Este material ya fue cargado y se encuentra actualmente en revisión. No se permite duplicar la entrega.",
    };
  }

  return {
    kind: "pending",
    canUpload: true,
    label: "Pendiente",
    badgeText: "Pendiente",
    badgeVariant: "neutral",
    detailMessage:
      "Este material aún no ha sido cargado. Está disponible para su primera entrega.",
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
 * `v01- Revision y aprobación evaluador disciplinar (devuelto) - 17e9507d`
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
      : `Crédito / Unidad ${item.creditNumber}`;
  return `${item.name} · ${scope}`;
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

const resolveDeliverableStateLabel = (row: Dev_tabledeliverables): string => {
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

export const listProcessDeliverableGroups = async (
  processId: string,
): Promise<ProcessDeliverableGroup[]> => {
  const trimmed = processId.trim();
  if (!trimmed) return [];

  const [deliverablesResult, phasesResult, templatesResult] = await Promise.all([
    Dev_tabledeliverablesService.getAll({
      filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(trimmed)}' and statecode eq 0`,
    }),
    Dev_tablephasesService.getAll({
      filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(trimmed)}' and statecode eq 0`,
    }),
    Dev_tableactivitytemplatesService.getAll(),
  ]);

  const phases = phasesResult.data ?? [];
  const templatesMap = new Map(
    (templatesResult.data ?? []).map((t) => [t.dev_tableactivitytemplateid, t]),
  );

  const items: ProcessDeliverableItem[] = (deliverablesResult.data ?? []).map((row) => {
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
      ? (
          (latestPhase as unknown as Record<string, unknown>)[
            "_dev_expectedactivitytemplate_value@OData.Community.Display.V1.FormattedValue"
          ]?.toString().trim() ||
          latestPhase.dev_expectedactivitytemplatename?.trim() ||
          templatesMap.get(latestPhase._dev_expectedactivitytemplate_value ?? "")?.dev_activityname?.trim() ||
          ""
        )
      : "";

    // Si dev_deliverablestate es genérico/pendiente pero la fase ya avanzó a una actividad esperada
    // (ej. "Revisión y aprobación evaluador disciplinar"), reflejar la actividad pendiente de la fase.
    const rawStateLabel = resolveDeliverableStateLabel(row);
    const stateLabel =
      phaseExpectedActivity &&
      (!rawStateLabel ||
        rawStateLabel === "Pendiente" ||
        rawStateLabel === "Sin estado" ||
        rawStateLabel.toLowerCase().includes("etapa"))
        ? phaseExpectedActivity
        : rawStateLabel || phaseExpectedActivity || "Sin estado";

    return {
      id: row.dev_tabledeliverableid,
      name,
      categoryName,
      creditNumber,
      folderPath: row.dev_folderpath?.trim() || "",
      stateLabel,
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
          : `Crédito / Unidad ${creditNumber}`,
      items: groupItems.sort((a, b) => a.name.localeCompare(b.name, "es")),
    }));
};
