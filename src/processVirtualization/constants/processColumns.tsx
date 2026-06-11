import type { VirtualizationProcess } from "../types/process.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../components/processStatus";

export const virtualizationProcessColumns: Column<VirtualizationProcess>[] = [
  {
    key: "processName",
    header: "Proceso",
  },
  {
    key: "courseName",
    header: "Curso",
  },
  {
    key: "programName",
    header: "Programa",
  },
  {
    key: "facultyName",
    header: "Facultad",
  },
  {
    key: "status",
    header: "Estado",
    render: (row) => <ProcessStatus status={row.status} />,
  },
];
