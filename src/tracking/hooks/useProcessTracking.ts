/**
 * Hook del tablero de seguimiento.
 */
import { useCallback, useState } from "react";

import { getProcessTrackingBoard } from "../services/trackingService";
import type {
  ProcessTrackingRow,
  ProcessTrackingSummary,
} from "../types/tracking.types";

const EMPTY_SUMMARY: ProcessTrackingSummary = {
  total: 0,
  authorPending: 0,
  authorReturned: 0,
  validatorPending: 0,
  advisorPending: 0,
  completed: 0,
};

export const useProcessTracking = (userEmail: string, userRole: string) => {
  const [rows, setRows] = useState<ProcessTrackingRow[]>([]);
  const [summary, setSummary] =
    useState<ProcessTrackingSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  const loadTracking = useCallback(async () => {
    if (!userEmail || !userRole) return;

    try {
      setLoading(true);
      const data = await getProcessTrackingBoard(userEmail, userRole);
      setRows(data.rows);
      setSummary(data.summary);
    } catch (error) {
      console.error("Error cargando seguimiento", error);
      setRows([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [userEmail, userRole]);

  return { rows, summary, loading, loadTracking };
};
