/**
 * Plantillas de categoría (table-category-templates).
 * Listado desde Dataverse; alta vía fl-dev-cu-template-category.
 * Relación N:M con fases vía table-category-phase-template
 * (una categoría puede calificarse en varias fases).
 * Edición y baja (soft-delete) vía Dataverse.
 */
import { Dev_tablecategorytemplatesService } from "../../generated/services/Dev_tablecategorytemplatesService";
import { Dev_tablecategoryphasetemplatesService } from "../../generated/services/Dev_tablecategoryphasetemplatesService";
import { Dev_tablephasetemplatesService } from "../../generated/services/Dev_tablephasetemplatesService";
import { Fl_dev_cu_template_categoryService } from "../../generated/services/Fl_dev_cu_template_categoryService";
import type { Dev_tablecategorytemplates } from "../../generated/models/Dev_tablecategorytemplatesModel";
import type { Dev_tablecategoryphasetemplates } from "../../generated/models/Dev_tablecategoryphasetemplatesModel";
import type { Dev_tablecategoryphasetemplatesBase } from "../../generated/models/Dev_tablecategoryphasetemplatesModel";
import type { Dev_tablephasetemplates } from "../../generated/models/Dev_tablephasetemplatesModel";
import { assertFlowResult } from "../../global/utils/flowResult";
import {
  assertSafeDescription,
  assertSafeTitle,
  escapeODataString,
} from "../../global/utils/inputValidation";

/** Valores del option set `dev_granularity` en Dataverse. */
export const CATEGORY_GRANULARITY = {
  GENERAL: 775730001,
  POR_CREDITO: 775730002,
} as const;

export type CategoryGranularityCode =
  (typeof CATEGORY_GRANULARITY)[keyof typeof CATEGORY_GRANULARITY];

export type CategoryGranularityLabel = "General" | "Por unidad";

export interface PhaseTemplateOption {
  id: string;
  name: string;
  order: number;
}

export interface CategoryPhaseLink {
  linkId: string;
  phaseTemplateId: string;
  phaseTemplateName: string;
}

export interface CategoryTemplateRow {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
  granularity: CategoryGranularityLabel;
  granularityCode: number | null;
  /** Vínculos activos categoría ↔ fase (puede haber varios). */
  phases: CategoryPhaseLink[];
  /** Texto agregado para búsqueda / columna. */
  phaseTemplateName: string;
}

export interface CreateCategoryTemplateInput {
  name: string;
  description: string;
  isRequired: boolean;
  granularity: CategoryGranularityCode;
  phaseTemplateIds: string[];
}

export type UpdateCategoryTemplateInput = CreateCategoryTemplateInput & {
  id: string;
};

export const formatCategoryGranularity = (
  code: unknown,
  formattedName?: string,
): CategoryGranularityLabel => {
  const normalizedName = (formattedName ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/_/g, "");

  if (
    normalizedName.includes("credito") ||
    normalizedName.includes("porcr")
  ) {
    return "Por unidad";
  }
  if (normalizedName.includes("general")) {
    return "General";
  }

  const numeric = typeof code === "number" ? code : Number(code);
  if (numeric === CATEGORY_GRANULARITY.POR_CREDITO) return "Por unidad";
  if (numeric === CATEGORY_GRANULARITY.GENERAL) return "General";

  return "General";
};

const normalizeCategoryName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");

const normalizeGuid = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/[{}]/g, "")
    .trim()
    .toLowerCase();

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const readLookupId = (
  record: unknown,
  logicalName: string,
): string | null => {
  const row = asRecord(record);
  const candidates = [
    row[`_${logicalName}_value`],
    row[logicalName],
    row[`${logicalName}id`],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && normalizeGuid(candidate)) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === "object") {
      const nested = asRecord(candidate);
      const nestedId =
        nested.id ?? nested.value ?? nested[`${logicalName}id`];
      if (typeof nestedId === "string" && normalizeGuid(nestedId)) {
        return nestedId.trim();
      }
    }
  }

  return null;
};

const readLookupName = (
  record: unknown,
  logicalName: string,
  fallbackNameField?: string,
): string => {
  const row = asRecord(record);
  const formattedKey =
    `_${logicalName}_value@OData.Community.Display.V1.FormattedValue`;
  const candidates = [
    row[formattedKey],
    row[`${logicalName}name`],
    fallbackNameField ? row[fallbackNameField] : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
};

const assertCreateSuccess = (
  result: { success?: boolean; error?: unknown },
  fallback: string,
) => {
  if (result.success === false || result.error) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : typeof result.error === "object" &&
            result.error &&
            "message" in result.error
          ? String((result.error as { message?: string }).message)
          : fallback;
    throw new Error(message || fallback);
  }
};

const uniquePhaseIds = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    const key = normalizeGuid(id);
    if (!id || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(id);
  }
  return result;
};

const mapCategoryRow = (
  record: Dev_tablecategorytemplates,
  links: Dev_tablecategoryphasetemplates[],
  phaseNameById: Map<string, string>,
  phaseOrderById: Map<string, number>,
): CategoryTemplateRow => {
  const codeRaw = record.dev_granularity as unknown;
  const code =
    typeof codeRaw === "number"
      ? codeRaw
      : Number.isFinite(Number(codeRaw))
        ? Number(codeRaw)
        : null;

  const phases: CategoryPhaseLink[] = links
    .map((link) => {
      const phaseTemplateId = readLookupId(link, "dev_tablephasetemplate");
      if (!phaseTemplateId) return null;

      const phaseFromLink = readLookupName(
        link,
        "dev_tablephasetemplate",
        "dev_tablephasetemplatename",
      );
      const phaseFromCatalog = phaseNameById.get(
        normalizeGuid(phaseTemplateId),
      );

      return {
        linkId: link.dev_tablecategoryphasetemplateid,
        phaseTemplateId,
        phaseTemplateName:
          phaseFromLink ||
          phaseFromCatalog ||
          "Fase vinculada",
      };
    })
    .filter((item): item is CategoryPhaseLink => Boolean(item))
    .sort((a, b) => {
      const orderA =
        phaseOrderById.get(normalizeGuid(a.phaseTemplateId)) ?? 9999;
      const orderB =
        phaseOrderById.get(normalizeGuid(b.phaseTemplateId)) ?? 9999;
      return (
        orderA - orderB ||
        a.phaseTemplateName.localeCompare(b.phaseTemplateName, "es")
      );
    });

  return {
    id: record.dev_tablecategorytemplateid,
    name: record.dev_namecategory?.trim() || "Sin nombre",
    description: record.dev_description?.trim() || "",
    isRequired: Boolean(record.dev_isrequired),
    granularity: formatCategoryGranularity(
      codeRaw,
      record.dev_granularityname,
    ),
    granularityCode: code,
    phases,
    phaseTemplateName:
      phases.length > 0
        ? phases.map((phase) => phase.phaseTemplateName).join(", ")
        : "Sin fase",
  };
};

const listCategoryPhaseLinks = async (): Promise<
  Dev_tablecategoryphasetemplates[]
> => {
  const result = await Dev_tablecategoryphasetemplatesService.getAll({
    filter: "statecode eq 0",
  });

  if (result.success === false || result.error) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : "No se pudieron cargar los vínculos categoría-fase.";
    throw new Error(message);
  }

  return result.data ?? [];
};

const findCategoryByNormalizedName = async (
  name: string,
): Promise<Dev_tablecategorytemplates | null> => {
  const normalized = normalizeCategoryName(name);
  const result = await Dev_tablecategorytemplatesService.getAll({
    filter: `statecode eq 0 and dev_namecategorynormalized eq '${escapeODataString(normalized)}'`,
  });

  const rows = result.data ?? [];
  if (rows.length === 0) {
    const byName = await Dev_tablecategorytemplatesService.getAll({
      filter: `statecode eq 0 and dev_namecategory eq '${escapeODataString(name.trim())}'`,
    });
    const named = byName.data ?? [];
    if (named.length === 0) return null;
    return [...named].sort((a, b) =>
      String(b.createdon ?? "").localeCompare(String(a.createdon ?? "")),
    )[0];
  }

  return [...rows].sort((a, b) =>
    String(b.createdon ?? "").localeCompare(String(a.createdon ?? "")),
  )[0];
};

const createCategoryPhaseLink = async (
  categoryTemplateId: string,
  phaseTemplateId: string,
): Promise<void> => {
  const result = await Dev_tablecategoryphasetemplatesService.create({
    "dev_tablecategorytemplate@odata.bind": `/dev_tablecategorytemplates(${categoryTemplateId})`,
    "dev_tablephasetemplate@odata.bind": `/dev_tablephasetemplates(${phaseTemplateId})`,
    statecode: 0,
    statuscode: 1,
  } as Omit<
    Dev_tablecategoryphasetemplatesBase,
    "dev_tablecategoryphasetemplateid"
  >);

  assertCreateSuccess(
    result,
    "No se pudo vincular el entregable con la fase.",
  );
};

const deactivateCategoryPhaseLink = async (linkId: string): Promise<void> => {
  const result = await Dev_tablecategoryphasetemplatesService.update(linkId, {
    statecode: 1,
    statuscode: 2,
  });
  assertCreateSuccess(result, "No se pudo quitar el vínculo con la fase.");
};

const listActiveLinksForCategory = async (
  categoryTemplateId: string,
): Promise<Dev_tablecategoryphasetemplates[]> => {
  const result = await Dev_tablecategoryphasetemplatesService.getAll({
    filter: `statecode eq 0 and _dev_tablecategorytemplate_value eq '${escapeODataString(categoryTemplateId)}'`,
  });
  return result.data ?? [];
};

/**
 * Sincroniza los vínculos categoría↔fase:
 * crea los que faltan e inactiva los que se quitaron.
 */
const syncCategoryPhaseLinks = async (
  categoryTemplateId: string,
  phaseTemplateIds: string[],
): Promise<void> => {
  const desiredIds = uniquePhaseIds(phaseTemplateIds);
  if (desiredIds.length === 0) {
    throw new Error("Debe seleccionar al menos una fase.");
  }

  const existing = await listActiveLinksForCategory(categoryTemplateId);
  const existingByPhase = new Map<string, Dev_tablecategoryphasetemplates>();

  for (const link of existing) {
    const phaseId = readLookupId(link, "dev_tablephasetemplate");
    if (!phaseId) continue;
    existingByPhase.set(normalizeGuid(phaseId), link);
  }

  const desiredKeys = new Set(desiredIds.map((id) => normalizeGuid(id)));

  const toCreate = desiredIds.filter(
    (id) => !existingByPhase.has(normalizeGuid(id)),
  );
  const toRemove = [...existingByPhase.entries()]
    .filter(([phaseKey]) => !desiredKeys.has(phaseKey))
    .map(([, link]) => link.dev_tablecategoryphasetemplateid);

  await Promise.all([
    ...toCreate.map((phaseId) =>
      createCategoryPhaseLink(categoryTemplateId, phaseId),
    ),
    ...toRemove.map((linkId) => deactivateCategoryPhaseLink(linkId)),
  ]);
};

/** Lista plantillas de fase activas para el selector. */
export const listPhaseTemplateOptions = async (): Promise<
  PhaseTemplateOption[]
> => {
  const result = await Dev_tablephasetemplatesService.getAll({
    filter: "statecode eq 0",
  });

  return ((result.data ?? []) as Dev_tablephasetemplates[])
    .map((phase) => ({
      id: phase.dev_tablephasetemplateid,
      name: phase.dev_namephase?.trim() || "Sin nombre",
      order: typeof phase.dev_order === "number" ? phase.dev_order : 9999,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));
};

export const listCategoryTemplates = async (): Promise<
  CategoryTemplateRow[]
> => {
  const categoriesResult = await Dev_tablecategorytemplatesService.getAll({
    filter: "statecode eq 0",
  });

  let links: Dev_tablecategoryphasetemplates[] = [];
  try {
    links = await listCategoryPhaseLinks();
  } catch (error) {
    console.error(
      "No se pudieron cargar vínculos de table-category-phase-template",
      error,
    );
  }

  const phases = await listPhaseTemplateOptions();

  const phaseNameById = new Map(
    phases.map((phase) => [normalizeGuid(phase.id), phase.name] as const),
  );
  const phaseOrderById = new Map(
    phases.map((phase) => [normalizeGuid(phase.id), phase.order] as const),
  );

  const linksByCategory = new Map<string, Dev_tablecategoryphasetemplates[]>();
  for (const link of links) {
    const categoryId = readLookupId(link, "dev_tablecategorytemplate");
    if (!categoryId) continue;
    const key = normalizeGuid(categoryId);
    const bucket = linksByCategory.get(key) ?? [];
    bucket.push(link);
    linksByCategory.set(key, bucket);
  }

  return (categoriesResult.data ?? [])
    .map((record) =>
      mapCategoryRow(
        record,
        linksByCategory.get(
          normalizeGuid(record.dev_tablecategorytemplateid),
        ) ?? [],
        phaseNameById,
        phaseOrderById,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
};

/**
 * Crea una categoría y una fila intermedia por cada fase seleccionada.
 */
export const createCategoryTemplate = async (
  input: CreateCategoryTemplateInput,
): Promise<void> => {
  const name = assertSafeTitle(input.name, "El nombre de la categoría");
  const description = assertSafeDescription(input.description, {
    required: true,
    label: "La descripción",
  });
  const phaseTemplateIds = uniquePhaseIds(input.phaseTemplateIds);
  if (phaseTemplateIds.length === 0) {
    throw new Error("Debe seleccionar al menos una fase.");
  }

  const result = await Fl_dev_cu_template_categoryService.Run({
    text: name,
    text_1: description,
    boolean: input.isRequired,
    number: input.granularity,
  });

  const data = assertFlowResult(result, "creación de categoría");
  const status = Number(data?.status_code ?? 200);
  if (Number.isFinite(status) && status >= 400) {
    throw new Error(
      data?.message?.trim() ||
        "El flujo rechazó la creación de la categoría.",
    );
  }

  const created = await findCategoryByNormalizedName(name);
  if (!created?.dev_tablecategorytemplateid) {
    throw new Error(
      "La categoría se creó, pero no se pudo localizar para vincularla a las fases.",
    );
  }

  await syncCategoryPhaseLinks(
    created.dev_tablecategorytemplateid,
    phaseTemplateIds,
  );
};

/** Actualiza categoría y sincroniza sus fases (alta/baja de vínculos). */
export const updateCategoryTemplate = async (
  input: UpdateCategoryTemplateInput,
): Promise<void> => {
  const id = input.id.trim();
  if (!id) {
    throw new Error("Falta el identificador del entregable.");
  }

  const name = assertSafeTitle(input.name, "El nombre de la categoría");
  const description = assertSafeDescription(input.description, {
    required: true,
    label: "La descripción",
  });

  await Dev_tablecategorytemplatesService.update(id, {
    dev_namecategory: name,
    dev_namecategorynormalized: normalizeCategoryName(name),
    dev_description: description,
    dev_isrequired: input.isRequired,
    dev_granularity: input.granularity,
  });

  await syncCategoryPhaseLinks(id, input.phaseTemplateIds);
};

/** Baja lógica del entregable y de todos sus vínculos con fase. */
export const deleteCategoryTemplate = async (id: string): Promise<void> => {
  const templateId = id.trim();
  if (!templateId) {
    throw new Error("Falta el identificador del entregable.");
  }

  const links = await listActiveLinksForCategory(templateId);

  await Promise.all(
    links.map((link) =>
      deactivateCategoryPhaseLink(link.dev_tablecategoryphasetemplateid),
    ),
  );

  await Dev_tablecategorytemplatesService.update(templateId, {
    statecode: 1,
    statuscode: 2,
  });
};
