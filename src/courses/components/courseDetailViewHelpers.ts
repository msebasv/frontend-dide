/**
 * Helpers puros para la vista de detalle: tipos de material, enlaces,
 * etiquetas de UI (estado, comentarios, actor) y selección por defecto.
 */
import {
  parseAudiovisualLinkEntries,
  type AudiovisualLinkEntry,
} from "../../global/utils/inputValidation";
import { formatActivityStatus } from "../mappers/courseMappers";
import {
  isAdvisorGuideMaterialLabel,
  normalizeFolderSegment,
} from "../services/deliverableService";
import type { CourseMaterial } from "../types/course.types";

export type { AudiovisualLinkEntry };

/** Contexto pasado a modales de aprobar/devolver material. */
export interface MaterialValidationContext {
  material: CourseMaterial;
  /** Nombre del entregable (categoría × crédito) cuando aplica. */
  deliverableName?: string;
  /** Estado actual del entregable (para plantilla de aprobación correcta). */
  deliverableStateLabel?: string;
}

/** Pestañas del panel derecho del detalle por entregable. */
export type DeliverableDetailTab =
  | "actual"
  | "corrections"
  | "history"
  | "documents";

/** Actividad del diseñador DIDE con enlaces audiovisuales. */
export const isDideLinksMaterial = (material: CourseMaterial): boolean => {
  if (material.isAuthorUpload) return false;
  const role = normalizeFolderSegment(material.performedByRole);
  const name = normalizeFolderSegment(material.name);
  if (role.includes("disenador") && role.includes("dide")) return true;
  if (name.includes("enlaces audiovisuales")) return true;
  if (name.includes("registrar") && name.includes("enlace")) return true;
  return false;
};

/** Guión instruccional del asesor (Word), no una aprobación de revisión. */
export const isAdvisorGuideMaterial = (material: CourseMaterial): boolean => {
  if (material.isAuthorUpload) return false;
  if (isDideLinksMaterial(material)) return false;
  return isAdvisorGuideMaterialLabel(
    `${material.name} ${material.description ?? ""}`,
  );
};

/** Enlaces DIDE con etiqueta descriptiva cuando el diseñador la escribió. */
export const collectMaterialLinkEntries = (
  material: CourseMaterial,
): AudiovisualLinkEntry[] => {
  const fromDescription = parseAudiovisualLinkEntries(material.description);
  if (fromDescription.length > 0) return fromDescription;
  return parseAudiovisualLinkEntries(material.documents);
};

/** URLs planas a partir de `collectMaterialLinkEntries`. */
export const collectMaterialLinks = (material: CourseMaterial): string[] =>
  collectMaterialLinkEntries(material).map((entry) => entry.url);

/** Clases Tailwind del badge según palabras clave del estado. */
export const materialStatusStyle = (statusLabel: string): string => {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "bg-[#86c127]/10 text-[#3f8f2a] border border-[#86c127]/25";
  }
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/25";
  }
  if (normalized.includes("por aprobar") || normalized.includes("proceso")) {
    return "bg-[#d97706]/10 text-[#d97706] border border-[#d97706]/25";
  }

  return "bg-[#004040]/10 text-[#004040] border border-[#004040]/25";
};

/** Título de la sección de texto según estado y si es cargue del autor. */
export const commentsLabel = (
  statusLabel: string,
  isAuthorUpload: boolean,
): string => {
  const normalized = statusLabel.toLowerCase();
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "Comentarios de devolución";
  }
  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "Observaciones";
  }
  if (isAuthorUpload) return "Descripción del material";
  return "Descripción / comentarios";
};

/** Actividad marcada como devuelta / por corregir. */
export const isCorrectionMaterial = (material: CourseMaterial): boolean => {
  const normalized = formatActivityStatus(material.status).toLowerCase();
  return (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  );
};

/** Etiqueta del bloque de actor (cargado por, aprobado por, etc.). */
export const actorLabel = (
  statusLabel: string,
  isAuthorUpload: boolean,
): string => {
  const normalized = statusLabel.toLowerCase();
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "Devuelto por";
  }
  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "Aprobado por";
  }
  if (isAuthorUpload) return "Cargado por";
  return "Realizado por";
};

/** Primera actividad de autor; si no hay, la más reciente del listado. */
export const pickDefaultActivityId = (materials: CourseMaterial[]): string =>
  materials.find((item) => item.isAuthorUpload)?.activityId ??
  materials[0]?.activityId ??
  "";
