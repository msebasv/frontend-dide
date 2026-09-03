import { useEffect } from "react";
import { Link } from "react-router-dom";
import { IoAddCircleOutline } from "react-icons/io5";

import DataTable from "../../global/components/dataTable";
import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";

import { virtualizationProcessColumns } from "../constants/processColumns";
import { useVirtualizationProcesses } from "../hooks/useVirtualizationProcess";

const VirtualizationProcessList = () => {
  const { processes, loading, loadProcesses } = useVirtualizationProcesses();

  useEffect(() => {
    void loadProcesses();
  }, [loadProcesses]);

  return (
    <div>
      <PageHeader
        title="Procesos de Virtualización"
        description="Gestiona y supervisa todos los procesos de virtualización de la universidad"
        badge="Administración"
        actions={
          <>
            <Link to="/virtualization-processes/create">
              <Button size="sm">
                <IoAddCircleOutline size={16} />
                Crear proceso
              </Button>
            </Link>
            <Link to="/virtualization-processes/create-course">
              <Button variant="secondary" size="sm">
                <IoAddCircleOutline size={16} />
                Crear curso
              </Button>
            </Link>
          </>
        }
      />

      {loading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={virtualizationProcessColumns}
          data={processes}
          pageSize={8}
          title="Todos los procesos"
          subtitle={`${processes.length} proceso${processes.length !== 1 ? "s" : ""} registrado${processes.length !== 1 ? "s" : ""}`}
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
      )}
    </div>
  );
};

export default VirtualizationProcessList;
