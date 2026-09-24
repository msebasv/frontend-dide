/**
 * Servicio de entregables — acceso a Dataverse.
 * Tipos y reglas puras: domain/deliverableDomain.ts (re-exportados abajo).
 */
import { Dev_tabledeliverablesService } from "../../generated/services/Dev_tabledeliverablesService";
import { Dev_tablephasesService } from "../../generated/services/Dev_tablephasesService";
import { Dev_tableactivitytemplatesService } from "../../generated/services/Dev_tableactivitytemplatesService";
import { Dev_tablecategorytemplatesService } from "../../generated/services/Dev_tablecategorytemplatesService";
import { escapeODataString } from "../../global/utils/inputValidation";
import {
  buildProcessDeliverableGroups,
  type ProcessDeliverableGroup,
} from "../domain/deliverableDomain";

export type {
  ProcessDeliverableItem,
  ProcessDeliverableGroup,
  DeliverableUploadStatusKind,
  DeliverableUploadStatusInfo,
  ActivityVersionFolderMeta,
} from "../domain/deliverableDomain";

export {
  formatDeliverableState,
  isSyllabusDeliverable,
  materialBelongsToDeliverable,
  findSyllabusDeliverable,
  isOptionalDeliverableState,
  isDeliverableReadyForUnitClose,
  isCreditGroupApproved,
  getDeliverableUploadStatus,
  formatCreditFolderSegment,
  normalizeFolderSegment,
  parseActivityVersionFolder,
  isActivityVersionFolderSegment,
  getActivityIdFolderPrefix,
  fileBelongsToActivity,
  extractActivityVersionMetaFromPath,
  formatDeliverableSharePointLocation,
  extractProcessRelativeSegments,
  fileBelongsToDeliverable,
  resolveDeliverableFilesFolder,
  formatDeliverableUploadLabel,
  filterDeliverablesForUpload,
  resolveDeliverableStateLabel,
  resolvePhaseExpectedActivity,
  findDeliverablePhase,
  resolveEffectiveDeliverableState,
  isAdvisorGuideMaterialLabel,
  pathLooksLikeAdvisorGuide,
  buildProcessDeliverableGroups,
} from "../domain/deliverableDomain";

/** Lista entregables del proceso agrupados por crédito (General / Unidad N). */
export const listProcessDeliverableGroups = async (
  processId: string,
): Promise<ProcessDeliverableGroup[]> => {
  const trimmed = processId.trim();
  if (!trimmed) return [];

  const [deliverablesResult, phasesResult, templatesResult, categoriesResult] =
    await Promise.all([
      Dev_tabledeliverablesService.getAll({
        filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(trimmed)}' and statecode eq 0`,
      }),
      Dev_tablephasesService.getAll({
        filter: `_dev_tablevirtualizationprocess_value eq '${escapeODataString(trimmed)}' and statecode eq 0`,
      }),
      Dev_tableactivitytemplatesService.getAll(),
      Dev_tablecategorytemplatesService.getAll().catch(() => ({ data: [] })),
    ]);

  const templatesMap = new Map(
    (templatesResult.data ?? []).map((t) => [t.dev_tableactivitytemplateid, t]),
  );
  const requiredByCategoryId = new Map(
    (categoriesResult.data ?? []).map((category) => [
      category.dev_tablecategorytemplateid,
      Boolean(category.dev_isrequired),
    ]),
  );

  return buildProcessDeliverableGroups(
    deliverablesResult.data ?? [],
    phasesResult.data ?? [],
    templatesMap,
    requiredByCategoryId,
  );
};
