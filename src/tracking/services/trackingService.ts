/**
 * Servicio del tablero de seguimiento (Asesor / Líder).
 */
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablecourseinstancesService } from "../../generated/services/Dev_tablecourseinstancesService";
import { Dev_table_programsService } from "../../generated/services/Dev_table_programsService";
import { Dev_table_facultiesService } from "../../generated/services/Dev_table_facultiesService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitiesService } from "../../generated/services/Dev_tableactivitiesService";
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";

import {
  buildProcessTrackingRows,
  buildTrackingSummary,
} from "../mappers/trackingMappers";
import type {
  ProcessTrackingRow,
  ProcessTrackingSummary,
} from "../types/tracking.types";

type PageResult<T> = {
  data?: T[] | null;
  skipToken?: string;
};

/** Tope de filas que Dataverse devuelve en una sola llamada. */
const DATAVERSE_PAGE_SIZE = 500;
/** Tope de páginas seguidas, para no quedar en un bucle si el token se repite. */
const MAX_DATAVERSE_PAGES = 40;

/** Recorre todas las páginas de una tabla. Una sola llamada se queda en 500 filas. */
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

export const getProcessTrackingBoard = async (
  userEmail: string,
  userRole: string,
): Promise<{ rows: ProcessTrackingRow[]; summary: ProcessTrackingSummary }> => {
  const [
    assignRoles,
    processes,
    courses,
    programs,
    faculties,
    phases,
    activities,
    deliverables,
    activityTemplates,
  ] = await Promise.all([
    loadAllPages((skipToken) =>
      Dev_tableassignrolesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_tablevirtualizationprocessesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_tablecourseinstancesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_table_programsService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_table_facultiesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_tablephasesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_tableactivitiesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_tabledeliverablesService.getAll({
        filter: "statecode eq 0",
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
    loadAllPages((skipToken) =>
      Dev_tableactivitytemplatesService.getAll({
        maxPageSize: DATAVERSE_PAGE_SIZE,
        skipToken,
      }),
    ),
  ]);

  const rows = buildProcessTrackingRows({
    processes,
    courses,
    programs,
    faculties,
    phases,
    activities,
    deliverables,
    activityTemplates,
    assignRoles,
    userEmail,
    userRole,
  });

  return {
    rows,
    summary: buildTrackingSummary(rows),
  };
};
