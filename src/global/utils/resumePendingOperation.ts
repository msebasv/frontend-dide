/**
 * Reconstruye la confirmación de una operación guardada antes de recargar.
 */
import { createActivityWatcher } from "../../courses/services/courseService";
import { createProcessWatcher } from "../../processVirtualization/services/processMutationService";
import type { PendingOperation } from "./pendingOperation";

export const confirmPendingOperation = (
  pending: PendingOperation,
): (() => Promise<boolean>) => {
  if (pending.watch.kind === "activity") {
    return createActivityWatcher(pending.watch);
  }
  if (pending.watch.kind === "create-process") {
    return createProcessWatcher(pending.watch);
  }
  return async () => false;
};
