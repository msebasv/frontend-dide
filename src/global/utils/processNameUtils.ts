/**
 * Generación del nombre oficial de un proceso de virtualización.
 * Formato: "{nombre base} - {YYYY-S} - {NNN}"
 * El consecutivo NNN es global (no se reinicia por semestre).
 */
import { semesterFromDate } from "./semesterUtils";

import { PROCESS_NAME_MAX_LENGTH } from "./inputValidation";

/** Sufijo final: " - 001", " - 98", etc. */
const PROCESS_CODE_PATTERN = /\s-\s(\d+)\s*$/;

/** Semestre académico actual según la fecha del sistema. */
export const getCurrentSemester = (): string =>
  semesterFromDate(new Date().toISOString()) ?? "Sin semestre";

/** Extrae el código numérico final de un nombre de proceso, si existe. */
export const extractProcessCode = (processName: string): number | null => {
  const match = processName.trim().match(PROCESS_CODE_PATTERN);
  if (!match) return null;

  const code = Number(match[1]);
  return Number.isFinite(code) ? code : null;
};

/** Formatea el consecutivo a 3 dígitos (001, 098, 100...). */
export const formatProcessCode = (code: number): string =>
  String(Math.max(1, Math.floor(code))).padStart(3, "0");

/**
 * Calcula el siguiente código global a partir de los nombres existentes.
 * Si ninguno tiene código parseable, comienza en 001.
 */
export const getNextProcessCode = (existingNames: string[]): string => {
  let maxCode = 0;

  for (const name of existingNames) {
    const code = extractProcessCode(name);
    if (code != null && code > maxCode) maxCode = code;
  }

  return formatProcessCode(maxCode + 1);
};

/**
 * Arma el nombre completo del proceso:
 * "Desarrollo Web I - 2026-1 - 001"
 */
export const buildProcessDisplayName = (
  baseName: string,
  existingNames: string[],
  semester = getCurrentSemester(),
): string => {
  const base = baseName.trim().replace(/\s+/g, " ");
  const code = getNextProcessCode(existingNames);
  return `${base} - ${semester} - ${code}`;
};

/** Partes de un nombre con formato "{base} - {semestre} - {código}". */
export interface ParsedProcessName {
  baseName: string;
  semester: string | null;
  code: string | null;
}

/**
 * Separa un nombre oficial en título, semestre y código.
 * Si no coincide el formato, devuelve el nombre completo como base.
 */
export const parseProcessDisplayName = (
  processName: string,
): ParsedProcessName => {
  const trimmed = processName.trim().replace(/\s+/g, " ");
  const match = trimmed.match(/^(.*?)\s-\s(.+?)\s-\s(\d+)\s*$/);

  if (!match) {
    return { baseName: trimmed, semester: null, code: null };
  }

  return {
    baseName: match[1].trim(),
    semester: match[2].trim(),
    code: formatProcessCode(Number(match[3])),
  };
};

/** Caracteres que ocupan semestre y código: " - 2026-1 - 001". */
export const processNameSuffixLength = (semester: string, code: string): number =>
  ` - ${semester} - ${code}`.length;

/** Cupo del título para que el nombre completo no pase de 200 caracteres. */
export const processBaseNameMaxLength = (
  semester?: string | null,
  code?: string | null,
): number => {
  if (!semester || !code) return PROCESS_NAME_MAX_LENGTH;
  return Math.max(
    1,
    PROCESS_NAME_MAX_LENGTH - processNameSuffixLength(semester, code),
  );
};

/** Reconstruye el nombre conservando semestre y código (edición). */
export const rebuildProcessDisplayName = (
  baseName: string,
  semester: string,
  code: string,
): string => {
  const base = baseName.trim().replace(/\s+/g, " ");
  return `${base} - ${semester} - ${code}`;
};
