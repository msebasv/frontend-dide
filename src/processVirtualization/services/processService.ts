import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";

import { mapVirtualizationProcesses } from "../mappers/processMappers";

import type { VirtualizationProcess } from "../types/process.types";

export const getVirtualizationProcesses = async (): Promise<
  VirtualizationProcess[]
> => {
  const [
    processesResult,
    coursesResult,
    programsResult,
    facultiesResult,
    phasesResult,
  ] = await Promise.all([
    Dev_tablevirtualizationprocessesService.getAll(),
    Dev_tablecourseinstancesService.getAll(),
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
    Dev_tablephasesService.getAll(),
  ]);

  return mapVirtualizationProcesses({
    processes: processesResult.data ?? [],
    courses: coursesResult.data ?? [],
    programs: programsResult.data ?? [],
    faculties: facultiesResult.data ?? [],
    phases: phasesResult.data ?? [],
  });
};
