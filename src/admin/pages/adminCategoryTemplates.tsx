/**
 * Catálogo de plantillas de categoría (créditos / general).
 * Solo Administrador / Coordinador DIDE. Alta, edición y baja.
 * Una categoría puede vincularse a varias fases (tabla intermedia).
 */
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  IoAddOutline,
  IoCreateOutline,
  IoLayersOutline,
  IoTrashOutline,
} from "react-icons/io5";
import clsx from "clsx";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import DataTable, { type Column } from "../../global/components/dataTable";
import Button from "../../global/components/button";
import FormatsFolderButton from "../../global/components/formatsFolderButton";
import Modal from "../../global/components/modal";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import TextArea from "../../global/components/textArea";
import Select from "../../global/components/select";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useAuth } from "../../global/hooks/useAuth";
import {
  isAdminRole,
  isDideCoordinatorRole,
} from "../../global/constants/domainConstants";
import {
  CATEGORY_GRANULARITY,
  createCategoryTemplate,
  deleteCategoryTemplate,
  listCategoryTemplates,
  listPhaseTemplateOptions,
  updateCategoryTemplate,
  type CategoryGranularityCode,
  type CategoryTemplateRow,
  type PhaseTemplateOption,
} from "../services/categoryTemplateService";

type SelectOption = { label: string; value: string };

const canManageCategoryTemplates = (role: string): boolean =>
  isAdminRole(role) || isDideCoordinatorRole(role);

const GRANULARITY_OPTIONS: SelectOption[] = [
  { label: "General", value: String(CATEGORY_GRANULARITY.GENERAL) },
  { label: "Por unidad", value: String(CATEGORY_GRANULARITY.POR_CREDITO) },
];

const resolveGranularityOption = (code: number | null): SelectOption => {
  if (code === CATEGORY_GRANULARITY.POR_CREDITO) {
    return GRANULARITY_OPTIONS[1];
  }
  return GRANULARITY_OPTIONS[0];
};

function AdminCategoryTemplatesPage() {
  const { currentRole } = useAuth();
  const { runAction } = useActionFeedback();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CategoryTemplateRow[]>([]);
  const [phaseCatalog, setPhaseCatalog] = useState<PhaseTemplateOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoryTemplateRow | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [granularity, setGranularity] = useState<SelectOption | null>(
    GRANULARITY_OPTIONS[0],
  );
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<string[]>([]);

  const isEditing = Boolean(editingRow);
  const formIsValid =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    Boolean(granularity) &&
    selectedPhaseIds.length > 0;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [data, phases] = await Promise.all([
        listCategoryTemplates(),
        listPhaseTemplateOptions(),
      ]);
      setRows(data);
      setPhaseCatalog(phases);
    } catch {
      setRows([]);
      setPhaseCatalog([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsRequired(false);
    setGranularity(GRANULARITY_OPTIONS[0]);
    setSelectedPhaseIds([]);
    setEditingRow(null);
  };

  const openCreateModal = () => {
    setEditingRow(null);
    setName("");
    setDescription("");
    setIsRequired(false);
    setGranularity(GRANULARITY_OPTIONS[0]);
    setSelectedPhaseIds([]);
    setModalOpen(true);
  };

  const openEditModal = (row: CategoryTemplateRow) => {
    setEditingRow(row);
    setName(row.name);
    setDescription(row.description);
    setIsRequired(row.isRequired);
    setGranularity(resolveGranularityOption(row.granularityCode));
    setSelectedPhaseIds(row.phases.map((phase) => phase.phaseTemplateId));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    resetForm();
  };

  const togglePhase = (phaseId: string) => {
    setSelectedPhaseIds((current) =>
      current.includes(phaseId)
        ? current.filter((id) => id !== phaseId)
        : [...current, phaseId],
    );
  };

  const handleSubmit = async () => {
    if (!formIsValid || !granularity) return;

    const payload = {
      name,
      description,
      isRequired,
      granularity: Number(granularity.value) as CategoryGranularityCode,
      phaseTemplateIds: selectedPhaseIds,
    };

    try {
      setSubmitting(true);

      if (editingRow) {
        await runAction(
          () =>
            updateCategoryTemplate({
              id: editingRow.id,
              ...payload,
            }),
          {
            successTitle: "Entregable actualizado",
            successMessage: "Los cambios y las fases quedaron guardados.",
            errorTitle: "No se pudo actualizar",
            errorMessage:
              "Verifique el nombre, las fases y los permisos en Dataverse.",
            onSuccess: async () => {
              setModalOpen(false);
              resetForm();
              await loadData();
            },
          },
        );
        return;
      }

      await runAction(() => createCategoryTemplate(payload), {
        successTitle: "Entregable creado",
        successMessage:
          "La plantilla quedó registrada y vinculada a las fases seleccionadas.",
        errorTitle: "No se pudo crear",
        errorMessage:
          "Verifique el nombre, las fases y que el flujo esté activo.",
        onSuccess: async () => {
          setModalOpen(false);
          resetForm();
          await loadData();
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: CategoryTemplateRow) => {
    const confirmed = window.confirm(
      `¿Eliminar el entregable "${row.name}"?\n\nDejará de aparecer en el catálogo activo. Esta acción inactiva el registro y sus vínculos con fases.`,
    );
    if (!confirmed) return;

    await runAction(() => deleteCategoryTemplate(row.id), {
      successTitle: "Entregable eliminado",
      successMessage: "La plantilla y sus vínculos de fase ya no están activos.",
      errorTitle: "No se pudo eliminar",
      errorMessage: "Intente nuevamente o verifique los permisos en Dataverse.",
      onSuccess: async () => {
        await loadData();
      },
    });
  };

  const columns: Column<CategoryTemplateRow>[] = [
    {
      key: "name",
      header: "Nombre",
      className: "font-medium text-primary",
    },
    {
      key: "phaseTemplateName",
      header: "Fases",
      render: (row) =>
        row.phases.length === 0 ? (
          <span className="text-sm text-muted">Sin fase</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {row.phases.map((phase) => (
              <span
                key={phase.linkId || phase.phaseTemplateId}
                className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/20"
              >
                {phase.phaseTemplateName}
              </span>
            ))}
          </div>
        ),
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
            row.granularity === "Por unidad"
              ? "bg-sky-100 text-sky-900 ring-1 ring-sky-300/60"
              : "bg-primary/10 text-primary ring-1 ring-primary/20",
          )}
        >
          {row.granularity}
        </span>
      ),
    },
    {
      key: "id",
      header: "Acciones",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
          >
            <IoCreateOutline size={16} />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleDelete(row)}
          >
            <IoTrashOutline size={16} />
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  if (!canManageCategoryTemplates(currentRole)) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando entregables..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entregables"
        description="Plantillas de entregable; cada una puede calificarse en una o varias fases"
        badge="Administración"
        actions={
          <>
            <FormatsFolderButton variant="outline" />
            <Button
              size="sm"
              onClick={openCreateModal}
              disabled={phaseCatalog.length === 0}
            >
              <IoAddOutline size={16} />
              Crear entregable
            </Button>
          </>
        }
      />

      {phaseCatalog.length === 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No hay plantillas de fase activas. Crea fases en Dataverse antes de
          registrar entregables.
        </p>
      ) : null}

      <DataTable
        title="Plantillas de entregable"
        subtitle={`${rows.length} entregable${rows.length === 1 ? "" : "s"} activo${rows.length === 1 ? "" : "s"}`}
        columns={columns}
        data={rows}
        searchable
        searchPlaceholder="Buscar por nombre, fase o granularidad..."
        searchKeys={["name", "granularity", "phaseTemplateName"]}
        emptyMessage="No hay entregables registrados. Cree el primero con el botón superior."
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={isEditing ? "Editar entregable" : "Crear entregable"}
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
              placeholder="Describa el propósito de este entregable"
              rows={3}
              disabled={submitting}
            />
          </FormField>

          <FormField
            label="Fases"
            required
            hint="Marca todas las fases en las que se califica este entregable"
          >
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-border bg-white p-3">
              {phaseCatalog.map((phase) => {
                const checked = selectedPhaseIds.includes(phase.id);
                return (
                  <label
                    key={phase.id}
                    className={clsx(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition",
                      checked ? "bg-primary/5" : "hover:bg-gray-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePhase(phase.id)}
                      disabled={submitting}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span className="text-sm font-medium text-primary">
                      {phase.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </FormField>

          <FormField label="Granularidad" required>
            <Select
              options={GRANULARITY_OPTIONS}
              value={granularity}
              onChange={setGranularity}
              placeholder="Seleccione granularidad"
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
              onClick={closeModal}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!formIsValid || submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting
                ? isEditing
                  ? "Guardando..."
                  : "Creando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear entregable"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminCategoryTemplatesPage;
