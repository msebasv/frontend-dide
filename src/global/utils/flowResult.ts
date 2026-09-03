/**
 * Utilidades para invocar flujos Power Automate desde la code app.
 *
 * Varios flujos responden HTTP 202 (Accepted): la llamada termina cuando el
 * flujo se acepta, no cuando termina. Por eso hay que:
 * 1. Validar success/error del IOperationResult.
 * 2. Si el flujo es asíncrono, esperar un efecto observable en Dataverse.
 */

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
export const toFriendlyFlowError = (
  error: unknown,
  fallback = "No se pudo completar la operación. Intenta de nuevo.",
): string => {
  const raw = getRawErrorMessage(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("bad gateway") ||
    lower.includes("gateway") ||
    lower.includes("noresponse")
  ) {
    return "La operación tardó demasiado en responder. El proceso pudo completarse en segundo plano; revisa el estado en unos segundos.";
  }

  if (
    lower.includes("failed") ||
    lower.includes("failure") ||
    lower.includes("error")
  ) {
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return "La operación tardó demasiado y no se pudo confirmar. Revisa el estado en unos minutos.";
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

  const status = extractStatus(result) ?? extractStatus(result.data);
  if (status) {
    const normalized = normalizeStatus(status);

    if (FAILED_STATUSES.has(normalized)) {
      throw new Error(
        `La operación falló mientras se procesaba (${actionLabel}). Intenta de nuevo.`,
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
}

/** Espera hasta que `check` sea true o se agote el tiempo. */
export const waitUntil = async (
  check: () => Promise<boolean>,
  options: WaitUntilOptions = {},
): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const startedAt = Date.now();

  // Primera verificación inmediata
  if (await check()) return;

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(intervalMs);
    if (await check()) return;
  }

  throw new Error(
    options.timeoutMessage ??
      "La operación sigue en proceso y no se pudo confirmar a tiempo. Revisa el estado en unos minutos.",
  );
};

/**
 * Ejecuta un flujo asíncrono y confirma el efecto en Dataverse.
 * Si el conector responde 502/NoResponse (Respond lento), no falla:
 * sigue esperando a que el efecto sea visible.
 */
export const runFlowAndConfirm = async <T>(
  run: () => Promise<FlowOperationResult<T>>,
  options: {
    actionLabel: string;
    confirm: () => Promise<boolean>;
    timeoutMs?: number;
    intervalMs?: number;
    timeoutMessage?: string;
  },
): Promise<T | undefined> => {
  let data: T | undefined;

  try {
    const result = await run();

    if (result.success === false || result.error) {
      if (!isTransientFlowGatewayError(result.error ?? result)) {
        throw new Error(
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
    if (!isTransientFlowGatewayError(error)) {
      throw error;
    }
  }

  await waitUntil(options.confirm, {
    timeoutMs: options.timeoutMs,
    intervalMs: options.intervalMs,
    timeoutMessage: options.timeoutMessage,
  });

  return data;
};
