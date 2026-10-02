/**
 * Candado de operación en sesión para evitar doble envío mientras un flujo
 * lento sigue (o sigue confirmándose en background).
 */

const STORAGE_PREFIX = "ap:op-lock:";
const DEFAULT_TTL_MS = 15 * 60_000;

type LockRecord = {
  key: string;
  startedAt: number;
  expiresAt: number;
};

const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;

const readLock = (key: string): LockRecord | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockRecord;
    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(storageKey(key));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeLock = (record: LockRecord): void => {
  try {
    sessionStorage.setItem(storageKey(record.key), JSON.stringify(record));
  } catch {
    // sessionStorage puede fallar (modo privado / cuota); no bloquear la app.
  }
};

export const buildOperationLockKey = (
  action: string,
  parts: Array<string | null | undefined>,
): string =>
  [action, ...parts.map((part) => (part ?? "").trim()).filter(Boolean)].join(
    ":",
  );

/** true si hay un lock vigente para la clave. */
export const hasOperationLock = (key: string): boolean =>
  Boolean(readLock(key));

/**
 * Intenta adquirir el lock. Si ya existe uno vigente, lanza Error.
 * Extiende el TTL si ya lo teníamos nosotros (mismo tab tras soft-timeout).
 */
export const acquireOperationLock = (
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void => {
  const existing = readLock(key);
  if (existing) {
    throw new Error(
      "Ya hay una operación en curso para esta acción. Espere la confirmación; no vuelva a enviar.",
    );
  }

  const now = Date.now();
  writeLock({
    key,
    startedAt: now,
    expiresAt: now + ttlMs,
  });
};

/** Renueva el TTL (p. ej. al pasar a confirmación en background). */
export const refreshOperationLock = (
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void => {
  const existing = readLock(key);
  const now = Date.now();
  writeLock({
    key,
    startedAt: existing?.startedAt ?? now,
    expiresAt: now + ttlMs,
  });
};

export const releaseOperationLock = (key: string): void => {
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
};
