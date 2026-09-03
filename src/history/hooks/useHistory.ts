/**
 * Hook del módulo de historial.
 *
 * Retorna dos vistas de los mismos datos:
 * - processes: resumen por proceso (tabla principal en /history)
 * - entries: actividades individuales (detalle en /history/:processId)
 */
import { useState, useCallback } from "react";

import { getHistoryDataForUser } from "../../courses/services/courseService";
import type { HistoryEntry, HistoryProcess } from "../types/history.types";

export const useHistory = (userEmail: string, userRole: string) => {
  const [processes, setProcesses] = useState<HistoryProcess[]>([]);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!userEmail || !userRole) return;

    try {
      setLoading(true);
      const data = await getHistoryDataForUser(userEmail, userRole);
      setProcesses(data.processes);
      setEntries(data.entries);
    } catch (error) {
      console.error("Error cargando historial", error);
    } finally {
      setLoading(false);
    }
  }, [userEmail, userRole]);

  return { processes, entries, loading, loadHistory };
};
