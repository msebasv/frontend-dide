/**
 * Días hábiles en Colombia: excluye sábados, domingos y festivos nacionales.
 * Los festivos de la Ley 51 de 1983 (Emiliani) se observan el lunes siguiente
 * cuando no caen en lunes. Semana Santa y los tres festivos móviles
 * posteriores a Pascua se calculan cada año.
 */

const BOGOTA = "America/Bogota";

const holidayCache = new Map<number, Set<string>>();

const pad = (value: number): string => String(value).padStart(2, "0");

const toKey = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`;

const parseKey = (
  key: string,
): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const weekday = (key: string): number => {
  const parts = parseKey(key);
  if (!parts) return 0;
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();
};

const addDays = (key: string, amount: number): string => {
  const parts = parseKey(key);
  if (!parts) return key;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + amount);
  return toKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
const easterSunday = (year: number): string => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toKey(year, month, day);
};

/** Si la fecha no es lunes, pasa al lunes siguiente. */
const observedMonday = (key: string): string => {
  const day = weekday(key);
  if (day === 1) return key;
  const shift = day === 0 ? 1 : 8 - day;
  return addDays(key, shift);
};

/** Festivos nacionales de un año, como YYYY-MM-DD. */
export const colombianHolidayKeys = (year: number): string[] => {
  const cached = holidayCache.get(year);
  if (cached) return [...cached];

  const easter = easterSunday(year);
  const fixed = [
    toKey(year, 1, 1),
    toKey(year, 5, 1),
    toKey(year, 7, 20),
    toKey(year, 8, 7),
    toKey(year, 12, 8),
    toKey(year, 12, 25),
    addDays(easter, -3),
    addDays(easter, -2),
  ];
  const emiliani = [
    toKey(year, 1, 6),
    toKey(year, 3, 19),
    toKey(year, 6, 29),
    toKey(year, 8, 15),
    toKey(year, 10, 12),
    toKey(year, 11, 1),
    toKey(year, 11, 11),
    addDays(easter, 39),
    addDays(easter, 60),
    addDays(easter, 68),
  ].map(observedMonday);

  const keys = new Set([...fixed, ...emiliani]);
  holidayCache.set(year, keys);
  return [...keys];
};

const isHoliday = (key: string): boolean => {
  const parts = parseKey(key);
  if (!parts) return false;
  return colombianHolidayKeys(parts.year).includes(key);
};

const isBusinessDay = (key: string): boolean => {
  const day = weekday(key);
  return day !== 0 && day !== 6 && !isHoliday(key);
};

/** Fecha calendario en America/Bogota (YYYY-MM-DD). */
export const bogotaDateKey = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

/**
 * Días hábiles transcurridos después de `startIso` y hasta `endIso`, inclusive.
 * El día del cambio cuenta como 0. Un cambio de hoy devuelve 0.
 */
export const businessDaysBetween = (startIso: string, endIso: string): number => {
  const start = bogotaDateKey(startIso);
  const end = bogotaDateKey(endIso);
  if (!start || !end || end <= start) return 0;

  let count = 0;
  let cursor = addDays(start, 1);
  let guard = 0;
  while (cursor <= end && guard < 4000) {
    if (isBusinessDay(cursor)) count += 1;
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return count;
};

/** «1 día transcurrido» o «N días transcurridos». */
export const formatElapsedDays = (days: number): string =>
  days === 1 ? "1 día transcurrido" : `${days} días transcurridos`;

/** Etiqueta corta para un paso del historial. El vigente sigue contando. */
export const formatHistoryStepElapsed = (
  days: number,
  open: boolean,
): string => {
  const count = days === 1 ? "1 día hábil" : `${days} días hábiles`;
  return open ? `En curso · ${count}` : count;
};

/** «Autor: 2 días transcurridos». */
export const formatActorElapsed = (actor: string, days: number): string =>
  `${actor}: ${formatElapsedDays(days)}`;

/** Actor corto a partir del nombre de fase o estado visible. */
export const actorLabelForState = (
  stateLabel: string,
  returned = false,
): string => {
  if (returned) return "Devuelto";
  const normalized = stateLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (normalized.includes("devuelto") || normalized.includes("corregir")) {
    return "Devuelto";
  }
  if (normalized.includes("syllabus") && normalized.includes("listo")) {
    return "Syllabus listo";
  }
  if (normalized.includes("syllabus") || normalized.includes("pre valid")) {
    return "Líder";
  }
  if (normalized.includes("autor")) return "Autor";
  if (normalized.includes("validador")) return "Validador";
  if (normalized.includes("disenador")) return "Diseñador";
  if (normalized.includes("asesor")) return "Asesor";
  if (normalized.includes("aula")) return "Líder";
  if (normalized.includes("aprobado") || normalized.includes("finaliz")) {
    return "Completado";
  }
  return "En este estado";
};

/**
 * Días del entregable.
 * Si ya se cargó, el tramo queda cerrado en esa fecha: no sigue corriendo
 * aunque la fase interna del proceso todavía no avance.
 * Si aún no se carga, cuenta desde que le tocó el turno hasta hoy.
 */
export const deliverableElapsedDayCount = (params: {
  isSyllabus: boolean;
  returned: boolean;
  /** Fechas de cargue o devolución, de la más antigua a la más reciente. */
  eventDates: string[];
  processCreatedOn: string;
  /** Fecha en que se cargó el syllabus, si ya ocurrió. */
  syllabusCompletedOn?: string;
}): number => {
  const uploadedAt = params.eventDates.find((date) => date.trim()) ?? "";
  const latestAt =
    [...params.eventDates].reverse().find((date) => date.trim()) ?? "";
  const now = new Date().toISOString();

  if (params.returned && latestAt) {
    return businessDaysBetween(latestAt, now);
  }

  if (uploadedAt && !params.returned) {
    const start = params.isSyllabus
      ? params.processCreatedOn || uploadedAt
      : params.syllabusCompletedOn || params.processCreatedOn || uploadedAt;
    return businessDaysBetween(start, uploadedAt);
  }

  if (params.isSyllabus) {
    if (!params.processCreatedOn) return 0;
    return businessDaysBetween(params.processCreatedOn, now);
  }

  if (!params.syllabusCompletedOn) return 0;
  return businessDaysBetween(params.syllabusCompletedOn, now);
};

/** Días hábiles desde que el entregable entró en su estado actual. */
export const stateElapsedLabel = (
  stateLabel: string,
  startedOn: string,
  returned = false,
): string => {
  if (!startedOn) return "";
  return formatActorElapsed(
    actorLabelForState(stateLabel, returned),
    businessDaysBetween(startedOn, new Date().toISOString()),
  );
};

/** Proceso abierto cuenta hasta hoy. Cerrado, hasta su fecha de cierre. */
export const processElapsedDayCount = (
  createdOn: string,
  closedOn?: string,
): number => {
  if (!createdOn) return 0;
  const end = closedOn?.trim() || new Date().toISOString();
  return businessDaysBetween(createdOn, end);
};

export const processElapsedLabel = (
  createdOn: string,
  closedOn?: string,
): string => {
  if (!createdOn) return "";
  return formatElapsedDays(processElapsedDayCount(createdOn, closedOn));
};

export interface ElapsedMovement {
  id: string;
  at: string;
}

/**
 * Días hábiles de cada movimiento hasta el siguiente.
 * El más reciente sigue abierto y cuenta hasta hoy.
 */
export const movementElapsedDays = (
  movements: ElapsedMovement[],
  nowIso: string = new Date().toISOString(),
): Map<string, number> => {
  const sorted = [...movements]
    .filter((item) => item.id && item.at)
    .sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  const result = new Map<string, number>();
  sorted.forEach((item, index) => {
    const end = index < sorted.length - 1 ? sorted[index + 1].at : nowIso;
    result.set(item.id, businessDaysBetween(item.at, end));
  });
  return result;
};
