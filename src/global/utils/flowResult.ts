/**
 * Utilidades para invocar flujos Power Automate desde la code app.
 *
 * Varios flujos responden HTTP 202 (Accepted): la llamada termina cuando el
 * flujo se acepta, no cuando termina. Por eso hay que:
 * 1. Validar success/error del IOperationResult.
 * 2. Si el flujo es asíncrono, esperar un efecto observable en Dataverse.
 * 3. Si el efecto tarda más que el timeout de UI, seguir en background y
 *    cerrar con éxito o fallo (no tratar el soft-timeout como error definitivo).
 */

import { OPERATION_COPY } from "../constants/operationCopy";

type FlowOperationResult<T = unknown> = {
  success?: boolean;
  error?: unknown;
  data?: T;
};

const FAILED_STATUSES = new Set([
  "failed",
  "failure",
  "cancelled",
  "canceled",
  "aborted",
  "error",
  "timedout",
  "timed out",
]);

const RUNNING_STATUSES = new Set([
  "running",
  "pending",
  "accepted",
  "waiting",
  "inprogress",
  "in progress",
]);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** El flujo respondió o terminó en Failed. No hay que seguir esperando. */
export class FlowRunFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowRunFailedError";
  }
}

export const isFlowRunFailedError = (
  error: unknown,
): error is FlowRunFailedError =>
  error instanceof FlowRunFailedError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "FlowRunFailedError");

/** Soft-timeout de confirmación: el flujo pudo seguir; no es fallo de negocio. */
export class FlowConfirmationTimeoutError extends Error {
  readonly soft = true as const;
  /** Poll para seguir confirmando en background (efecto en Dataverse). */
  continueConfirm?: () => Promise<boolean>;
  /** Liberar candado de operación al cerrar (éxito o fallo diferido). */
  releaseLock?: () => void;

  constructor(
    message: string = OPERATION_COPY.softTimeoutGeneric,
    continueConfirm?: () => Promise<boolean>,
    releaseLock?: () => void,
  ) {
    super(message);
    this.name = "FlowConfirmationTimeoutError";
    this.continueConfirm = continueConfirm;
    this.releaseLock = releaseLock;
  }
}

export const isFlowConfirmationTimeoutError = (
  error: unknown,
): error is FlowConfirmationTimeoutError =>
  error instanceof FlowConfirmationTimeoutError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { soft?: unknown }).soft === true &&
    (error as { name?: string }).name === "FlowConfirmationTimeoutError");

const getRawErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error ?? "");
  }
};

const extractStatus = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const candidates = [record.status, record.state, record.Status, record.State];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (record.data && typeof record.data === "object") {
    return extractStatus(record.data);
  }

  return undefined;
};

const normalizeStatus = (status: string): string =>
  status.trim().toLowerCase().replace(/[_-]+/g, " ");

/** Mensaje amigable a partir del error crudo del conector/flujo. */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

/**
 * El flujo de actividad responde success:false y luego hace Terminate Failed.
 * Esa respuesta es la señal para dejar de esperar.
 */
export const flowPayloadFailureMessage = (
  result: FlowOperationResult,
): string | null => {
  const data = asRecord(result.data);
  if (!data) return null;

  const status = extractStatus(data);
  const successFlag = data.success;
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const normalized = status ? normalizeStatus(status) : "";

  if (successFlag === false || FAILED_STATUSES.has(normalized)) {
    return (
      message ||
      "El flujo terminó con error. La espera se detuvo. Revise la ejecución e intente de nuevo."
    );
  }

  return null;
};

export const toFriendlyFlowError = (
  error: unknown,
  fallback = "No se pudo completar la operación. Intente nuevamente.",
): string => {
  if (isFlowConfirmationTimeoutError(error) || isFlowRunFailedError(error)) {
    return error.message;
  }

  const raw = getRawErrorMessage(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("bad gateway") ||
    lower.includes("gateway") ||
    lower.includes("noresponse")
  ) {
    return "La operación tardó demasiado en responder. El proceso pudo completarse en segundo plano. Consulte el estado en unos segundos.";
  }

  if (
    lower.includes("failed") ||
    lower.includes("failure") ||
    lower.includes("error")
  ) {
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return "La operación tardó demasiado y no se pudo confirmar. Consulte el estado en unos minutos.";
    }
  }

  if (raw.includes("statusCode") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (parsed.message?.trim()) return parsed.message.trim();
    } catch {
      // ignore JSON parse errors
    }
  }

  if (raw.length > 0 && raw.length < 180 && !raw.includes("at ")) {
    return raw;
  }

  return fallback;
};

/**
 * 502/504/NoResponse: el conector cortó la espera (p. ej. Respond lento),
 * pero el flujo en Power Automate puede haber terminado bien.
 */
export const isTransientFlowGatewayError = (error: unknown): boolean => {
  const raw =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : String(error ?? "").toLowerCase();

  try {
    const nested = JSON.stringify(error).toLowerCase();
    return (
      nested.includes("502") ||
      nested.includes("504") ||
      nested.includes("badgateway") ||
      nested.includes("bad gateway") ||
      nested.includes("noresponse") ||
      nested.includes("gateway") ||
      nested.includes("timeout") ||
      nested.includes("timed out")
    );
  } catch {
    return (
      raw.includes("502") ||
      raw.includes("504") ||
      raw.includes("bad gateway") ||
      raw.includes("noresponse") ||
      raw.includes("gateway") ||
      raw.includes("timeout")
    );
  }
};

/**
 * Valida el resultado inmediato del Run().
 * Lanza si falló; si sigue "running" no lanza (el caller debe hacer polling).
 */
export const assertFlowResult = <T>(
  result: FlowOperationResult<T>,
  actionLabel: string,
): T | undefined => {
  if (result.success === false || result.error) {
    throw new Error(
      toFriendlyFlowError(
        result.error,
        `No se pudo completar: ${actionLabel}.`,
      ),
    );
  }

  const payloadFailure = flowPayloadFailureMessage(result);
  if (payloadFailure) {
    throw new FlowRunFailedError(payloadFailure);
  }

  const status = extractStatus(result) ?? extractStatus(result.data);
  if (status) {
    const normalized = normalizeStatus(status);

    if (FAILED_STATUSES.has(normalized)) {
      throw new FlowRunFailedError(
        `La operación falló mientras se procesaba (${actionLabel}). Intente nuevamente.`,
      );
    }
  }

  return result.data;
};

export const isFlowStillRunning = (
  result: FlowOperationResult,
): boolean => {
  const status = extractStatus(result) ?? extractStatus(result.data);
  if (!status) return false;
  return RUNNING_STATUSES.has(normalizeStatus(status));
};

interface WaitUntilOptions {
  timeoutMs?: number;
  intervalMs?: number;
  timeoutMessage?: string;
  /** Si false, al agotar tiempo lanza Error duro. Por defecto soft. */
  softTimeout?: boolean;
}

/** Tiempo de UI antes de mostrar “sigue procesando” y continuar en background. */
export const SOFT_CONFIRM_TIMEOUT_MS = 5_000;

/**
 * Tope opcional del poll en background. Por defecto no hay tope: la escucha
 * sigue hasta que el efecto del flujo aparece en Dataverse.
 */
export const BACKGROUND_CONFIRM_TIMEOUT_MS = Number.POSITIVE_INFINITY;

/** Espera hasta que `check` sea true. Sin timeout finito, no se corta. */
export const waitUntil = async (
  check: () => Promise<boolean>,
  options: WaitUntilOptions = {},
): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? SOFT_CONFIRM_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? 1_000;
  const startedAt = Date.now();
  const unlimited = !Number.isFinite(timeoutMs);

  if (await check()) return;

  while (unlimited || Date.now() - startedAt < timeoutMs) {
    await sleep(intervalMs);
    if (await check()) return;
  }

  const message =
    options.timeoutMessage ?? OPERATION_COPY.softTimeoutGeneric;

  if (options.softTimeout !== false) {
    throw new FlowConfirmationTimeoutError(message, check);
  }

  throw new Error(message);
};

export type FlowConfirmOutcome = "confirmed" | "failed";

/**
 * Continúa el poll de `confirm` en background tras un soft-timeout.
 * Sigue hasta que el efecto aparece. Solo falla por tiempo si se pasa
 * un `backgroundTimeoutMs` finito.
 */
export const continueConfirmInBackground = (
  confirm: () => Promise<boolean>,
  options: {
    backgroundTimeoutMs?: number;
    intervalMs?: number;
    onSettled: (outcome: FlowConfirmOutcome, error?: unknown) => void;
  },
): void => {
  const backgroundTimeoutMs =
    options.backgroundTimeoutMs ?? BACKGROUND_CONFIRM_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? 2_000;
  const startedAt = Date.now();
  const unlimited = !Number.isFinite(backgroundTimeoutMs);

  const tick = async () => {
    try {
      if (await confirm()) {
        options.onSettled("confirmed");
        return;
      }
    } catch (error) {
      if (isFlowRunFailedError(error)) {
        options.onSettled("failed", error);
        return;
      }
    }

    if (!unlimited && Date.now() - startedAt >= backgroundTimeoutMs) {
      options.onSettled("failed");
      return;
    }

    window.setTimeout(() => {
      void tick();
    }, intervalMs);
  };

  window.setTimeout(() => {
    void tick();
  }, intervalMs);
};

/**
 * Ejecuta un flujo asíncrono y confirma el efecto en Dataverse.
 * Si el conector responde 502/NoResponse (Respond lento), no falla:
 * sigue esperando a que el efecto sea visible.
 *
 * Soft-timeout (por defecto): el reloj corre desde el inicio (incluye el Run()
 * del conector). Si a los `timeoutMs` aún no hay confirmación, lanza
 * FlowConfirmationTimeoutError y el trabajo sigue en la misma promesa para
 * que la UI confirme en background.
 */
export const runFlowAndConfirm = async <T>(
  run: () => Promise<FlowOperationResult<T>>,
  options: {
    actionLabel: string;
    confirm: () => Promise<boolean>;
    timeoutMs?: number;
    intervalMs?: number;
    timeoutMessage?: string;
    softTimeout?: boolean;
  },
): Promise<T | undefined> => {
  const softTimeout = options.softTimeout !== false;
  const uiTimeoutMs = options.timeoutMs ?? SOFT_CONFIRM_TIMEOUT_MS;
  const timeoutMessage =
    options.timeoutMessage ??
    OPERATION_COPY.softTimeoutFallback(options.actionLabel);

  const pipeline = (async (): Promise<T | undefined> => {
    let data: T | undefined;

    try {
      const result = await run();
      const payloadFailure = flowPayloadFailureMessage(result);
      if (payloadFailure) {
        throw new FlowRunFailedError(payloadFailure);
      }

      if (result.success === false || result.error) {
        if (!isTransientFlowGatewayError(result.error ?? result)) {
          throw new FlowRunFailedError(
            toFriendlyFlowError(
              result.error,
              `No se pudo completar: ${options.actionLabel}.`,
            ),
          );
        }
      } else {
        data = assertFlowResult(result, options.actionLabel);
      }
    } catch (error) {
      if (isFlowRunFailedError(error)) {
        throw error;
      }
      if (!isTransientFlowGatewayError(error)) {
        throw new FlowRunFailedError(
          toFriendlyFlowError(
            error,
            `No se pudo completar: ${options.actionLabel}.`,
          ),
        );
      }
    }

    // El poll no se corta por reloj: sigue hasta que el flujo deje el efecto en Dataverse.
    await waitUntil(options.confirm, {
      timeoutMs: Number.POSITIVE_INFINITY,
      intervalMs: options.intervalMs ?? 2_000,
      timeoutMessage,
      softTimeout: false,
    });

    return data;
  })();

  if (!softTimeout) {
    return pipeline;
  }

  type RaceWinner =
    | { kind: "done"; data: T | undefined }
    | { kind: "soft" };

  let winner: RaceWinner;
  try {
    winner = await Promise.race([
      pipeline.then((data): RaceWinner => ({ kind: "done", data })),
      sleep(uiTimeoutMs).then((): RaceWinner => ({ kind: "soft" })),
    ]);
  } catch (error) {
    // Fallo real del flujo/confirmación antes del soft-timeout de UI.
    throw error;
  }

  if (winner.kind === "done") {
    return winner.data;
  }

  // Evitar unhandledrejection si el pipeline falla después del soft.
  void pipeline.catch(() => undefined);

  // Soft: el pipeline sigue vivo; la UI confirma con la misma promesa.
  throw new FlowConfirmationTimeoutError(timeoutMessage, async () => {
    await pipeline;
    return true;
  });
};
