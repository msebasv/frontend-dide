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

export const getProcessTrackingBoard = async (
  userEmail: string,
  userRole: string,
): Promise<{ rows: ProcessTrackingRow[]; summary: ProcessTrackingSummary }> => {
  const [
    assignRolesResult,
    processesResult,
    coursesResult,
    programsResult,
    facultiesResult,
    phasesResult,
    activitiesResult,
    deliverablesResult,
    activityTemplatesResult,
  ] = await Promise.all([
    Dev_tableassignrolesService.getAll(),
    Dev_tablevirtualizationprocessesService.getAll(),
    Dev_tablecourseinstancesService.getAll(),
    Dev_table_programsService.getAll(),
    Dev_table_facultiesService.getAll(),
    Dev_tablephasesService.getAll(),
    Dev_tableactivitiesService.getAll(),
    Dev_tabledeliverablesService.getAll(),
    Dev_tableactivitytemplatesService.getAll(),
  ]);

  const rows = buildProcessTrackingRows({
    processes: processesResult.data ?? [],
    courses: coursesResult.data ?? [],
    programs: programsResult.data ?? [],
    faculties: facultiesResult.data ?? [],
    phases: phasesResult.data ?? [],
    activities: activitiesResult.data ?? [],
    deliverables: deliverablesResult.data ?? [],
    activityTemplates: activityTemplatesResult.data ?? [],
    assignRoles: assignRolesResult.data ?? [],
    userEmail,
    userRole,
  });

  return {
    rows,
    summary: buildTrackingSummary(rows),
  };
};
