import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  canCreateProcesses,
  isVirtualizationLeaderRole,
} from "../../global/constants/domainConstants";

const VirtualizationProcessList = () => {
  const { user, currentRole } = useAuth();
  const { processes, loading, loadProcesses } = useVirtualizationProcesses(
    user?.email ?? "",
    currentRole,
  );
  const [activeTab, setActiveTab] = useState<ProcessStatusFilterTab>("all");

  const columns = useMemo(
    () => getVirtualizationProcessColumns(currentRole),
    [currentRole],
  );

  const showCreateActions = canCreateProcesses(currentRole);

  const tabCounts = useMemo(
    () => countByProcessStatusTab(processes, (process) => process.status),
    [processes],
  );

  const filteredProcesses = useMemo(
    () =>
      filterByProcessStatusTab(
        processes,
        activeTab,
        (process) => process.status,
      ),
    [processes, activeTab],
  );

  useEffect(() => {
    void loadProcesses();
  }, [loadProcesses]);

  return (
    <div>
      <PageHeader
        title="Procesos de Virtualización"
        description={
          isVirtualizationLeaderRole(currentRole)
            ? "Procesos de virtualización en los que usted está asignado como líder"
            : "Gestione y supervise todos los procesos de virtualización de la universidad"
        }
        badge="Administración"
        actions={
          showCreateActions ? (
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
          ) : undefined
        }
      />

      {loading ? (
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
            pageSize={8}
            title={processStatusTabTitle(activeTab)}
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
          />
        </div>
      )}
    </div>
  );
};

export default VirtualizationProcessList;
