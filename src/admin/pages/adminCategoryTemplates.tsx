/**
 * Catálogo de plantillas de categoría (créditos / general).
 * Solo Administrador. Alta vía fl-dev-cu-template-category.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { IoAddOutline, IoLayersOutline } from "react-icons/io5";
import clsx from "clsx";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import DataTable, { type Column } from "../../global/components/dataTable";
import Button from "../../global/components/button";
import Modal from "../../global/components/modal";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import TextArea from "../../global/components/textArea";
import Select from "../../global/components/select";
import FeedbackModal from "../../global/components/feedbackModal";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useAuth } from "../../global/hooks/useAuth";
import {
  canonicalizeUserRole,
  isAdminRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import {
  CATEGORY_GRANULARITY,
  createCategoryTemplate,
  listCategoryTemplates,
  type CategoryGranularityCode,
  type CategoryTemplateRow,
} from "../services/categoryTemplateService";

type SelectOption = { label: string; value: string };

const canManageCategoryTemplates = (role: string): boolean =>
  isAdminRole(role) ||
  canonicalizeUserRole(role) === USER_ROLES.DIDE_COORDINATOR;

const GRANULARITY_OPTIONS: SelectOption[] = [
  { label: "General", value: String(CATEGORY_GRANULARITY.GENERAL) },
  { label: "Por crédito", value: String(CATEGORY_GRANULARITY.POR_CREDITO) },
];

function AdminCategoryTemplatesPage() {
  const { currentRole } = useAuth();
  const { feedback, closeFeedback, runAction } = useActionFeedback();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CategoryTemplateRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [granularity, setGranularity] = useState<SelectOption | null>(
    GRANULARITY_OPTIONS[0],
  );

  const formIsValid =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    Boolean(granularity);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listCategoryTemplates();
      setRows(data);
    } catch (error) {
      console.error("Error cargando entregables", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const columns = useMemo<Column<CategoryTemplateRow>[]>(
    () => [
      {
        key: "name",
        header: "Nombre",
        className: "font-medium text-primary",
      },
      {
        key: "isRequired",
        header: "Obligatorio",
        render: (row) => (
          <span
            className={clsx(
              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              row.isRequired
                ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300/60"
                : "bg-gray-100 text-muted ring-1 ring-border",
            )}
          >
            {row.isRequired ? "Sí" : "No"}
          </span>
        ),
      },
      {
        key: "granularity",
        header: "Granularidad",
        render: (row) => (
          <span
            className={clsx(
              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              row.granularity === "Por crédito"
                ? "bg-sky-100 text-sky-900 ring-1 ring-sky-300/60"
                : "bg-primary/10 text-primary ring-1 ring-primary/20",
            )}
          >
            {row.granularity}
          </span>
        ),
      },
    ],
    [],
  );

  if (!canManageCategoryTemplates(currentRole)) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando entregables..." />;
  }

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsRequired(false);
    setGranularity(GRANULARITY_OPTIONS[0]);
  };

  const handleCreate = async () => {
    if (!formIsValid || !granularity) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          createCategoryTemplate({
            name,
            description,
            isRequired,
            granularity: Number(granularity.value) as CategoryGranularityCode,
          }),
        {
          successTitle: "Entregable creado",
          successMessage: "La plantilla quedó registrada en el catálogo.",
          errorTitle: "No se pudo crear",
          errorMessage:
            "Revisa el nombre, la descripción y que el flujo esté activo.",
          onSuccess: async () => {
            setModalOpen(false);
            resetForm();
            await loadData();
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entregables"
        description="Plantillas de entregable para material académico (general o por crédito)"
        badge="Administración"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <IoAddOutline size={16} />
            Crear entregable
          </Button>
        }
      />

      <DataTable
        title="Plantillas de entregable"
        subtitle={`${rows.length} entregable${rows.length === 1 ? "" : "s"} activo${rows.length === 1 ? "" : "s"}`}
        columns={columns}
        data={rows}
        searchable
        searchPlaceholder="Buscar por nombre o granularidad..."
        searchKeys={["name", "granularity"]}
        emptyMessage="Aún no hay entregables. Crea el primero con el botón de arriba."
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          if (submitting) return;
          setModalOpen(false);
          resetForm();
        }}
        title="Crear entregable"
        icon={<IoLayersOutline size={18} />}
        size="md"
        preventClose={submitting}
      >
        <div className="space-y-4">
          <FormField label="Nombre" required>
            <InputText
              value={name}
              onChange={setName}
              placeholder="Ej. Guía instruccional"
              disabled={submitting}
            />
          </FormField>

          <FormField label="Descripción" required>
            <TextArea
              value={description}
              onChange={setDescription}
              placeholder="Describe el propósito de este entregable"
              rows={3}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Granularidad" required>
            <Select
              options={GRANULARITY_OPTIONS}
              value={granularity}
              onChange={setGranularity}
              placeholder="Selecciona granularidad"
              disabled={submitting}
            />
          </FormField>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(event) => setIsRequired(event.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <div>
              <p className="text-sm font-semibold text-primary">
                Es obligatorio
              </p>
              <p className="text-xs text-muted">
                Si está activo, el entregable será requerido en el proceso
              </p>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!formIsValid || submitting}
              onClick={() => void handleCreate()}
            >
              {submitting ? "Creando..." : "Crear entregable"}
            </Button>
          </div>
        </div>
      </Modal>

      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
      />
    </div>
  );
}

export default AdminCategoryTemplatesPage;
