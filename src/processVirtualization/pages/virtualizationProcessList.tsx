import { useEffect } from "react";

import DataTable from "../../global/components/dataTable";

import { virtualizationProcessColumns } from "../constants/processColumns";
import { useVirtualizationProcesses } from "../hooks/useVirtualizationProcess";

const VirtualizationProcessList = () => {
  const { processes, loading, loadProcesses } = useVirtualizationProcesses();

  useEffect(() => {
    void loadProcesses();
  }, [loadProcesses]);

  return (
    <div>
      <h1>Virtualization Processes</h1>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <DataTable
          columns={virtualizationProcessColumns}
          data={processes}
          pageSize={5}
        />
      )}
    </div>
  );
};

export default VirtualizationProcessList;
