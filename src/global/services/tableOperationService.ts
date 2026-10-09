/**
 * Lectura de dev_tableoperation. El id de la fila es el request-id de la app.
 * RUNNING o fila ausente no es un fallo: se sigue consultando, también después
 * de varios minutos. FAILED sí cierra la espera.
 */
import { Dev_tableoperationsService } from "../../generated/services/Dev_tableoperationsService";
import { FlowRunFailedError } from "../utils/flowResult";

export type OperationRow = {
  status: string;
  message: string;
  targetId: string;
};

/** null = todavía no hay fila o la lectura no respondió. No es un error de negocio. */
export const getTableOperation = async (
  requestId: string,
): Promise<OperationRow | null> => {
  const id = requestId.trim();
  if (!id) return null;

  try {
    const result = await Dev_tableoperationsService.get(id, {
      select: ["dev_status", "dev_message", "dev_targetid", "dev_step"],
    });
    const row = result.data;
    if (!row) return null;
    return {
      status: (row.dev_status ?? "").trim().toUpperCase(),
      message: row.dev_message?.trim() ?? "",
      targetId: row.dev_targetid?.trim() ?? "",
    };
  } catch {
    return null;
  }
};

/**
 * true cuando la fila queda SUCCEEDED.
 * FAILED lanza error para el toast actual.
 * Cualquier otro caso (incluida la ausencia de fila) sigue en espera.
 */
export const confirmTableOperation = async (
  requestId: string,
  onTargetId?: (targetId: string) => void,
): Promise<boolean> => {
  const row = await getTableOperation(requestId);
  if (!row) return false;
  if (row.targetId) onTargetId?.(row.targetId);
  if (row.status === "SUCCEEDED") return true;
  if (row.status === "FAILED") {
    throw new FlowRunFailedError(
      row.message || "No se pudo completar la operación.",
    );
  }
  return false;
};
