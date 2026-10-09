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
import { Dev_tablecategorytemplatesService } from "../../generated/services/Dev_tablecategorytemplatesService";

import { mapVirtualizationProcesses } from "../mappers/processMappers";

import type { VirtualizationProcess } from "../types/process.types";

type PageResult<T> = {
  data?: T[] | null;
  skipToken?: string;
};

const DATAVERSE_PAGE_SIZE = 500;
const MAX_DATAVERSE_PAGES = 40;

/** Una sola llamada se queda en 500 filas; el panel necesita todos los entregables. */
const loadAllPages = async <T>(
  load: (skipToken?: string) => Promise<PageResult<T>>,
): Promise<T[]> => {
  const rows: T[] = [];
  let skipToken: string | undefined;
  const seen = new Set<string>();

  for (let page = 0; page < MAX_DATAVERSE_PAGES; page += 1) {
    if (skipToken) {
      if (seen.has(skipToken)) break;
      seen.add(skipToken);
    }
    const result = await load(skipToken);
    rows.push(...(result.data ?? []));
    if (!result.skipToken) break;
    skipToken = result.skipToken;
  }

  return rows;
};

const loadPagesOrEmpty = async <T>(
  load: (skipToken?: string) => Promise<PageResult<T>>,
): Promise<T[]> => {
  try {
    return await loadAllPages(load);
  } catch {
    return [];
  }
};

export const getVirtualizationProcesses = async (options?: {
  recordState?: "active" | "inactive";
}): Promise<VirtualizationProcess[]> => {
  const [
    processesResult,
    coursesResult,
    programsResult,
    facultiesResult,
    phases,
    activities,
    activityTemplates,
    deliverables,
    assignRoles,
    categoryTemplates,
  ] = await Promise.all([
    Dev_tablevirtualizationprocessesService.getAll(),
    Dev_tablecourseinstancesService.getAll(),
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
    loadPagesOrEmpty((skipToken) =>
      Dev_tablephasesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadPagesOrEmpty((skipToken) =>
      Dev_tableactivitiesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadPagesOrEmpty((skipToken) =>
      Dev_tableactivitytemplatesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadPagesOrEmpty((skipToken) =>
      Dev_tabledeliverablesService.getAll({
        filter: "statecode eq 0",
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadPagesOrEmpty((skipToken) =>
      Dev_tableassignrolesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadPagesOrEmpty((skipToken) =>
      Dev_tablecategorytemplatesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
  ]);

  return mapVirtualizationProcesses({
    processes: processesResult.data ?? [],
    courses: coursesResult.data ?? [],
    programs: programsResult.data ?? [],
    faculties: facultiesResult.data ?? [],
    phases,
    activities,
    activityTemplates,
    deliverables,
    assignRoles,
    categoryTemplates,
    recordState: options?.recordState ?? "active",
  });
};
