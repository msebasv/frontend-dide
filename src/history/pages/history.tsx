/**
 * Página de historial / auditoría.
 *
 * Dos vistas según la ruta:
 * - /history           → tabla de procesos (clic para ver detalle)
 * - /history/:processId → actividades de un proceso específico
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../../global/hooks/useAuth";
import DataTable from "../../global/components/dataTable";
import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";

import { useHistory } from "../hooks/useHistory";
import { getHistoryDetailColumns } from "../constants/historyColumns";
import { historyProcessColumns } from "../constants/historyProcessColumns";
import HistoryActivityDetailModal from "../components/historyActivityDetailModal";
import type { HistoryEntry } from "../types/history.types";

const History = () => {
  const { processId } = useParams();
  const { user, currentRole } = useAuth();
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const { processes, entries, loading, loadHistory } = useHistory(
    user?.email ?? "",
    currentRole,
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setSelectedEntry(null);
  }, [processId]);

  const selectedProcess = useMemo(
    () => processes.find((process) => process.processId === processId),
    [processes, processId],
  );

  const processEntries = useMemo(
    () =>
      processId
        ? entries.filter((entry) => entry.processId === processId)
        : [],
    [entries, processId],
  );

  const detailColumns = useMemo(
    () => getHistoryDetailColumns(setSelectedEntry),
    [],
  );

  if (loading) {
    return <LoadingState />;
  }

  if (processId) {
    return (
      <div>
        <PageHeader
          title="Historial del proceso"
          description={
            selectedProcess
              ? `${selectedProcess.processName} · ${selectedProcess.courseName}`
              : "Registro de actividades del proceso"
          }
          badge="Auditoría"
          backTo="/history"
        />

        <DataTable
          columns={detailColumns}
          data={processEntries}
          pageSize={10}
          title="Actividades del proceso"
          subtitle={`${processEntries.length} actividad${processEntries.length !== 1 ? "es" : ""} registrada${processEntries.length !== 1 ? "s" : ""}`}
          searchPlaceholder="Buscar por acción, estado o fecha..."
          searchKeys={["action", "status", "date"]}
        />

        <HistoryActivityDetailModal
          entry={selectedEntry}
          isOpen={Boolean(selectedEntry)}
          onClose={() => setSelectedEntry(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Historial"
        description="Selecciona un proceso para ver el detalle de sus actividades"
        badge="Auditoría"
      />

      <DataTable
        columns={historyProcessColumns}
        data={processes}
        pageSize={10}
        title="Procesos con historial"
        subtitle={`${processes.length} proceso${processes.length !== 1 ? "s" : ""}`}
        searchPlaceholder="Buscar por proceso o curso..."
        searchKeys={["processName", "courseName", "status"]}
        getRowLink={(row) => `/history/${row.processId}`}
      />
    </div>
  );
};

export default History;
