/**
 * Utilidades de periodo académico (semestre / año).
 *
 * Convención El Bosque: YYYY-1 (ene–jun) y YYYY-2 (jul–dic).
 * Prioridad: patrón en el nombre del proceso → fecha de creación.
 */

const SEMESTER_PATTERN = /\b(20\d{2})\s*[-_/]\s*([12])\b/;

export type PeriodFilterType = "all" | "year" | "semester";

export interface PeriodFilter {
  type: PeriodFilterType;
  /** Año ("2026") o semestre ("2026-1"). Vacío si type === "all". */
  value: string;
}

export const ALL_PERIOD_FILTER: PeriodFilter = { type: "all", value: "" };

/** Extrae "2026-1" / "2026-2" desde un texto (p. ej. nombre del proceso). */
export const parseSemesterFromText = (text: string): string | null => {
  const match = text.match(SEMESTER_PATTERN);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
};

/** Deriva semestre académico a partir de una fecha ISO. */
export const semesterFromDate = (dateStr: string): string | null => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const term = date.getMonth() < 6 ? 1 : 2;
  return `${year}-${term}`;
};

/** Resuelve el semestre de un proceso (nombre primero, luego createdon). */
export const resolveProcessSemester = (
  processName: string,
  createdOn?: string,
): string =>
  parseSemesterFromText(processName) ??
  semesterFromDate(createdOn ?? "") ??
  "Sin semestre";

export const getYearFromSemester = (semester: string): string | null => {
  const match = semester.match(/^(20\d{2})-[12]$/);
  return match?.[1] ?? null;
};

export const matchesPeriodFilter = (
  semester: string,
  filter: PeriodFilter,
): boolean => {
  if (filter.type === "all" || !filter.value) return true;
  if (filter.type === "semester") return semester === filter.value;
  if (filter.type === "year") {
    return getYearFromSemester(semester) === filter.value;
  }
  return true;
};

/** Opciones de filtro derivadas del conjunto de semestres presentes. */
export const buildPeriodOptions = (
  semesters: string[],
): { years: string[]; semesters: string[] } => {
  const semesterSet = new Set<string>();
  const yearSet = new Set<string>();

  for (const semester of semesters) {
    if (!semester || semester === "Sin semestre") continue;
    const year = getYearFromSemester(semester);
    if (!year) continue;
    semesterSet.add(semester);
    yearSet.add(year);
  }

  const sortDesc = (a: string, b: string) => b.localeCompare(a);

  return {
    years: [...yearSet].sort(sortDesc),
    semesters: [...semesterSet].sort(sortDesc),
  };
};
