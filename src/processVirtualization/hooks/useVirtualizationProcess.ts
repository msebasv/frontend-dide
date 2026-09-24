/**
 * Hook de listado de procesos de virtualización.
 * Administrador y coordinadores ven todos.
 * El Líder de virtualización solo ve los procesos en los que está asignado.
 */
import { useState, useCallback } from "react";

import { isVirtualizationLeaderRole } from "../../global/constants/domainConstants";
import { getVirtualizationProcesses } from "../services/processService";

import type { VirtualizationProcess } from "../types/process.types";

const isAssignedVirtualizationLeader = (
  process: VirtualizationProcess,
  userEmail: string,
): boolean =>
  process.leaderEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();

export const useVirtualizationProcesses = (
  userEmail = "",
  userRole = "",
) => {
  const [processes, setProcesses] = useState<VirtualizationProcess[]>([]);
  // true al inicio para no pintar el dashboard vacío antes del primer fetch.
  const [loading, setLoading] = useState(true);

  const loadProcesses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getVirtualizationProcesses();
      const visible = isVirtualizationLeaderRole(userRole)
        ? data.filter((process) =>
            isAssignedVirtualizationLeader(process, userEmail),
          )
        : data;
      setProcesses(visible);
    } catch (error) {
      console.error("Error cargando procesos", error);
    } finally {
      setLoading(false);
    }
  }, [userEmail, userRole]);

  return {
    processes,
    loading,
    loadProcesses,
  };
};
