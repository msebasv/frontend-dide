import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { IoAddCircleOutline } from "react-icons/io5";

import DataTable from "../../global/components/dataTable";
import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";
import ProcessStatusFilterTabs, {
  countByProcessStatusTab,
  filterByProcessStatusTab,
  processStatusTabTitle,
  type ProcessStatusFilterTab,
} from "../../global/components/processStatusFilterTabs";

import { getVirtualizationProcessColumns } from "../constants/processColumns";
import { useVirtualizationProcesses } from "../hooks/useVirtualizationProcess";
import { useAuth } from "../../global/hooks/useAuth";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import {
  canCreateProcesses,
  canDeleteProcesses,
  isVirtualizationLeaderRole,
} from "../../global/constants/domainConstants";
import { deleteVirtualizationProcess } from "../services/processMutationService";
import { getVirtualizationProcesses } from "../services/processService";
import DeleteProcessModal from "../components/deleteProcessModal";
import type { VirtualizationProcess } from "../types/process.types";

const VirtualizationProcessList = () => {
  const location = useLocation();
  const { user, currentRole, refreshRoles } = useAuth();
  const { processes, loading, loadProcesses } = useVirtualizationProcesses(
    user?.email ?? "",
    currentRole,
  );
  const { runAction } = useActionFeedback();
  const [activeTab, setActiveTab] = useState<ProcessStatusFilterTab>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedProcesses, setDeletedProcesses] = useState<
    VirtualizationProcess[]
  >([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [processToDelete, setProcessToDelete] =
    useState<VirtualizationProcess | null>(null);
  const canSeeDeleted = canDeleteProcesses(currentRole);

  const handleDeleteRequest = useCallback((row: VirtualizationProcess) => {
    setProcessToDelete(row);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!processToDelete) return;
    const row = processToDelete;
    setProcessToDelete(null);

    await runAction(() => deleteVirtualizationProcess(row.processId), {
      successTitle: "Proceso eliminado",
      successMessage: "El proceso y sus registros asociados ya no están activos.",
      errorTitle: "No se pudo eliminar",
      errorMessage: "Intente nuevamente o verifique los permisos en Dataverse.",
      onSuccess: async () => {
        await refreshRoles();
        await loadProcesses();
      },
    });
  }, [loadProcesses, processToDelete, refreshRoles, runAction]);

  const columns = useMemo(
    () => getVirtualizationProcessColumns(currentRole, handleDeleteRequest),
    [currentRole, handleDeleteRequest],
  );

  const showCreateActions = canCreateProcesses(currentRole);

  const loadDeleted = useCallback(async () => {
    try {
      setDeletedLoading(true);
      const data = await getVirtualizationProcesses({
        recordState: "inactive",
      });
      setDeletedProcesses(data);
    } catch {
      setDeletedProcesses([]);
    } finally {
      setDeletedLoading(false);
    }
  }, []);

  const visibleProcesses = showDeleted ? deletedProcesses : processes;

  const tabCounts = useMemo(
    () =>
      countByProcessStatusTab(visibleProcesses, (process) => process.status),
    [visibleProcesses],
  );

  const filteredProcesses = useMemo(
    () =>
      filterByProcessStatusTab(
        visibleProcesses,
        activeTab,
        (process) => process.status,
      ),
    [visibleProcesses, activeTab],
  );

  const refreshAt = (location.state as { refreshAt?: number } | null)
    ?.refreshAt;
  const openDeleted = Boolean(
    (location.state as { showDeleted?: boolean } | null)?.showDeleted,
  );

  useEffect(() => {
    if (openDeleted && canSeeDeleted) setShowDeleted(true);
  }, [openDeleted, canSeeDeleted]);

  useEffect(() => {
    void loadProcesses();
  }, [loadProcesses, refreshAt]);

  useEffect(() => {
    if (!showDeleted) return;
    void loadDeleted();
  }, [showDeleted, loadDeleted, refreshAt]);

  return (
    <div>
      <PageHeader
        title="Procesos de Virtualización"
        description={
          showDeleted
            ? "Procesos eliminados. Solo puede consultarlos."
            : isVirtualizationLeaderRole(currentRole)
              ? "Procesos de virtualización en los que usted está asignado como líder"
              : "Gestione y supervise todos los procesos de virtualización de la universidad"
        }
        badge="Administración"
        actions={
          <>
            {canSeeDeleted && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleted((current) => !current)}
              >
                {showDeleted ? "Ver activos" : "Procesos eliminados"}
              </Button>
            )}
            {showCreateActions && !showDeleted ? (
              <>
                <Link to="/virtualization-processes/create">
                  <Button size="sm">
                    <IoAddCircleOutline size={16} />
                    Nuevo Proceso
                  </Button>
                </Link>
                <Link to="/virtualization-processes/create-course">
                  <Button variant="secondary" size="sm">
                    <IoAddCircleOutline size={16} />
                    Nuevo Curso
                  </Button>
                </Link>
              </>
            ) : null}
          </>
        }
      />

      {loading || (showDeleted && deletedLoading) ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          <ProcessStatusFilterTabs
            activeTab={activeTab}
            counts={tabCounts}
            onChange={setActiveTab}
          />

          <DataTable
            columns={columns}
            data={filteredProcesses}
            title={
              showDeleted
                ? "Procesos eliminados"
                : processStatusTabTitle(activeTab)
            }
            subtitle={`${filteredProcesses.length} proceso${filteredProcesses.length !== 1 ? "s" : ""}`}
            searchPlaceholder="Buscar por proceso, curso o facultad..."
            searchKeys={[
              "processName",
              "courseName",
              "facultyName",
              "programName",
              "status",
              "modifiedOn",
            ]}
            catalogFields={(process) => ({
              facultyName: process.facultyName,
              programName: process.programName,
              semester: process.semester,
              createdOn: process.createdOn,
            })}
          />
        </div>
      )}

      <DeleteProcessModal
        isOpen={Boolean(processToDelete)}
        processName={processToDelete?.processName}
        onClose={() => setProcessToDelete(null)}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />
    </div>
  );
};

export default VirtualizationProcessList;
