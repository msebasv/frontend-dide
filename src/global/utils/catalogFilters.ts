/**
 * Filtros de listados académicos: facultad, programa, año, semestre
 * y rango de fecha de creación.
 */
import { getYearFromSemester } from "./semesterUtils";

export interface CatalogRecord {
  facultyName: string;
  programName: string;
  /** Semestre académico, p. ej. "2026-1". */
  semester: string;
  /** ISO de creación del proceso. */
  createdOn: string;
}

export interface CatalogFilter {
  facultyName: string;
  programName: string;
  year: string;
  semester: string;
  /** yyyy-mm-dd inclusive. Vacío = sin límite. */
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_CATALOG_FILTER: CatalogFilter = {
  facultyName: "",
  programName: "",
  year: "",
  semester: "",
  createdFrom: "",
  createdTo: "",
};

export const isCatalogFilterActive = (filter: CatalogFilter): boolean =>
  Object.values(filter).some((value) => value.trim() !== "");

const toLocalDateKey = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const matchesCatalogFilter = (
  record: CatalogRecord,
  filter: CatalogFilter,
): boolean => {
  if (filter.facultyName && record.facultyName !== filter.facultyName) {
    return false;
  }
  if (filter.programName && record.programName !== filter.programName) {
    return false;
  }
  if (filter.year && getYearFromSemester(record.semester) !== filter.year) {
    return false;
  }
  if (filter.semester && record.semester !== filter.semester) return false;

  const createdKey = toLocalDateKey(record.createdOn);
  if (filter.createdFrom && (!createdKey || createdKey < filter.createdFrom)) {
    return false;
  }
  if (filter.createdTo && (!createdKey || createdKey > filter.createdTo)) {
    return false;
  }
  return true;
};

const uniqueSorted = (values: string[], emptyLabel: string): string[] => {
  const unique = [...new Set(values)];
  return unique.sort((a, b) => {
    const aEmpty = !a.trim();
    const bEmpty = !b.trim();
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    return (a.trim() || emptyLabel).localeCompare(b.trim() || emptyLabel, "es");
  });
};

/** Programas visibles según la facultad elegida. */
export const catalogProgramOptions = (
  records: CatalogRecord[],
  facultyName: string,
): string[] => {
  const scoped = facultyName
    ? records.filter((record) => record.facultyName === facultyName)
    : records;
  return uniqueSorted(
    scoped.map((record) => record.programName),
    "Sin programa",
  );
};

export const catalogFacultyOptions = (records: CatalogRecord[]): string[] =>
  uniqueSorted(
    records.map((record) => record.facultyName),
    "Sin facultad",
  );

/** Años y semestres presentes, acotados por facultad y programa. */
export const catalogPeriodOptions = (
  records: CatalogRecord[],
  filter: Pick<CatalogFilter, "facultyName" | "programName" | "year">,
): { years: string[]; semesters: string[] } => {
  const scoped = records.filter((record) => {
    if (filter.facultyName && record.facultyName !== filter.facultyName) {
      return false;
    }
    if (filter.programName && record.programName !== filter.programName) {
      return false;
    }
    return true;
  });

  const years = new Set<string>();
  const semesters = new Set<string>();
  for (const record of scoped) {
    const year = getYearFromSemester(record.semester);
    if (!year) continue;
    years.add(year);
    if (!filter.year || year === filter.year) semesters.add(record.semester);
  }

  const sortDesc = (a: string, b: string) => b.localeCompare(a);
  return {
    years: [...years].sort(sortDesc),
    semesters: [...semesters].sort(sortDesc),
  };
};
