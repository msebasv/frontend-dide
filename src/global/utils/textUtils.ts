/**
 * Formatea etiquetas de dominio (fases, roles, estados) para mostrarlas
 * con la primera letra de cada palabra en mayúscula.
 */

/**
 * Normaliza texto de dominio para comparaciones de igualdad
 * (fases, estados, nombres de actividad).
 * trim → minúsculas → quita diacríticos (NFD + \p{Diacritic}).
 * No colapsa espacios/guiones ni decodifica URI (ver normalizeFolderSegment).
 */
export const normalizeComparableText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Correcciones de acento / mayúsculas para términos frecuentes del dominio. */
const WORD_FIXES: Record<string, string> = {
  pedagogico: "Pedagógico",
  pedagógica: "Pedagógica",
  pedagogica: "Pedagógica",
  dide: "DIDE",
  syllabus: "Syllabus",
  evaluador: "Validador",
  evaluadores: "Validador",
  validador: "Validador",
};

const capitalizeWord = (word: string): string => {
  if (!word) return word;

  const lower = word.toLowerCase();

  if (WORD_FIXES[lower]) return WORD_FIXES[lower];

  // Conservar acrónimos ya en mayúsculas (DIDE, AP, etc.)
  if (word.length <= 4 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
    return word;
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/**
 * Compatibilidad: si Dataverse aún trae "evaluador", se muestra como "Validador".
 */
const replaceEvaluadorWithValidador = (value: string): string =>
  value
    .replace(/evaluadores?\s+disciplinares?/gi, "validador disciplinar")
    .replace(/evaluadores?/gi, "validador");

/** Convierte un estado/rol crudo de Dataverse a etiqueta presentable. */
export const formatDomainLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return value;

  // Dataverse a veces antepone "Estado" al nombre de la fase/actividad.
  const withoutEstadoPrefix = trimmed.replace(/^estado\s*[:.\-]?\s*/i, "");
  const normalized = withoutEstadoPrefix || trimmed;

  return replaceEvaluadorWithValidador(normalized)
    .split(/\s+/)
    .map((word) => capitalizeWord(word))
    .join(" ");
};
