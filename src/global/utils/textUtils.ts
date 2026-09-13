/**
 * Formatea etiquetas de dominio (fases, roles, estados) para mostrarlas
 * con capitalización legible en español.
 */
const SMALL_WORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "e",
  "el",
  "en",
  "la",
  "las",
  "los",
  "o",
  "para",
  "por",
  "u",
  "un",
  "una",
  "y",
]);

/** Correcciones de acento / mayúsculas para términos frecuentes del dominio. */
const WORD_FIXES: Record<string, string> = {
  pedagogico: "Pedagógico",
  pedagógica: "Pedagógica",
  pedagogica: "Pedagógica",
  dide: "DIDE",
  syllabus: "Syllabus",
  evaluador: "Validador",
  evaluadores: "Validador Disciplinar",
};

const capitalizeWord = (word: string, index: number): string => {
  if (!word) return word;

  const lower = word.toLowerCase();

  if (WORD_FIXES[lower]) return WORD_FIXES[lower];

  // Conservar acrónimos ya en mayúsculas (DIDE, AP, etc.)
  if (word.length <= 4 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
    return word;
  }

  if (index > 0 && SMALL_WORDS.has(lower)) return lower;

  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/** Convierte un estado/rol crudo de Dataverse a etiqueta presentable. */
export const formatDomainLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return value;

  return trimmed
    .split(/\s+/)
    .map((word, index) => capitalizeWord(word, index))
    .join(" ");
};
