/**
 * Plantillas de categoría (table-category-templates).
 * Listado desde Dataverse; alta vía fl-dev-cu-template-category.
 */
import { Dev_tablecategorytemplatesService } from "../../generated/services/Dev_tablecategorytemplatesService";
import { Fl_dev_cu_template_categoryService } from "../../generated/services/Fl_dev_cu_template_categoryService";
import type { Dev_tablecategorytemplates } from "../../generated/models/Dev_tablecategorytemplatesModel";
import { assertFlowResult } from "../../global/utils/flowResult";
import {
  assertSafeDescription,
  assertSafeTitle,
} from "../../global/utils/inputValidation";

/** Valores del option set `dev_granularity` en Dataverse. */
export const CATEGORY_GRANULARITY = {
  GENERAL: 775730001,
  POR_CREDITO: 775730002,
} as const;

export type CategoryGranularityCode =
  (typeof CATEGORY_GRANULARITY)[keyof typeof CATEGORY_GRANULARITY];

export type CategoryGranularityLabel = "General" | "Por crédito";

export interface CategoryTemplateRow {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
  granularity: CategoryGranularityLabel;
  granularityCode: number | null;
}

export interface CreateCategoryTemplateInput {
  name: string;
  description: string;
  isRequired: boolean;
  granularity: CategoryGranularityCode;
}

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
    return "Por crédito";
  }
  if (normalizedName.includes("general")) {
    return "General";
  }

  const numeric = typeof code === "number" ? code : Number(code);
  if (numeric === CATEGORY_GRANULARITY.POR_CREDITO) return "Por crédito";
  if (numeric === CATEGORY_GRANULARITY.GENERAL) return "General";

  return "General";
};

const mapCategoryRow = (
  record: Dev_tablecategorytemplates,
): CategoryTemplateRow => {
  const codeRaw = record.dev_granularity as unknown;
  const code =
    typeof codeRaw === "number"
      ? codeRaw
      : Number.isFinite(Number(codeRaw))
        ? Number(codeRaw)
        : null;

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
  };
};

export const listCategoryTemplates = async (): Promise<
  CategoryTemplateRow[]
> => {
  const result = await Dev_tablecategorytemplatesService.getAll({
    filter: "statecode eq 0",
  });

  return (result.data ?? [])
    .map(mapCategoryRow)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
};

/**
 * Crea una categoría vía fl-dev-cu-template-category.
 * text = name, text_1 = description, boolean = is-required, number = granularity.
 */
export const createCategoryTemplate = async (
  input: CreateCategoryTemplateInput,
): Promise<void> => {
  const name = assertSafeTitle(input.name, "El nombre de la categoría");
  const description = assertSafeDescription(input.description, {
    required: true,
    label: "La descripción",
  });

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
};
