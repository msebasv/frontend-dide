/**
 * Hook de listado global de procesos de virtualización.
 * Solo usado por el líder y el dashboard de inicio del líder.
 */
import { useState, useCallback } from "react";

import { getVirtualizationProcesses } from "../services/processService";

import type { VirtualizationProcess } from "../types/process.types";

export const useVirtualizationProcesses = () => {
  const [processes, setProcesses] = useState<VirtualizationProcess[]>([]);
  // true al inicio para no pintar el dashboard vacío antes del primer fetch.
  const [loading, setLoading] = useState(true);

  const loadProcesses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getVirtualizationProcesses();
      setProcesses(data);
    } catch (error) {
      console.error("Error cargando procesos", error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    processes,
    loading,
    loadProcesses,
  };
};
