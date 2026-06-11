import { useState, useCallback } from "react";

import { getVirtualizationProcesses } from "../services/processService";

import type { VirtualizationProcess } from "../types/process.types";

export const useVirtualizationProcesses = () => {
  const [processes, setProcesses] = useState<VirtualizationProcess[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProcesses = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getVirtualizationProcesses();
      console.log("Procesos cargados:", data);
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
