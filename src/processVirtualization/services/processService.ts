/**
 * Servicio de lectura de procesos de virtualización.
 * Usado por el líder para listar y supervisar todos los procesos del entorno.
 */
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitiesService } from "../../generated/services/Dev_tableactivitiesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";

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
    activitiesResult,
    activityTemplatesResult,
    deliverablesResult,
    assignRolesResult,
  ] = await Promise.all([
    Dev_tablevirtualizationprocessesService.getAll(),
    Dev_tablecourseinstancesService.getAll(),
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
    Dev_tablephasesService.getAll(),
    Dev_tableactivitiesService.getAll(),
    Dev_tableactivitytemplatesService.getAll().catch(() => ({ data: [] })),
    // Entregables: alimentan el resumen "N en <estado>" de la tabla.
    Dev_tabledeliverablesService.getAll({ filter: "statecode eq 0" }).catch(
      () => ({ data: [] }),
    ),
    Dev_tableassignrolesService.getAll().catch(() => ({ data: [] })),
  ]);

  return mapVirtualizationProcesses({
    processes: processesResult.data ?? [],
    courses: coursesResult.data ?? [],
    programs: programsResult.data ?? [],
    faculties: facultiesResult.data ?? [],
    phases: phasesResult.data ?? [],
    activities: activitiesResult.data ?? [],
    activityTemplates: activityTemplatesResult.data ?? [],
    deliverables: deliverablesResult.data ?? [],
    assignRoles: assignRolesResult.data ?? [],
  });
};
