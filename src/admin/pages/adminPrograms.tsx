/**
 * Catálogo académico: facultades y programas (solo Administrador).
 * Crear / editar facultades y programas.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { IoAddOutline, IoCreateOutline } from "react-icons/io5";
import clsx from "clsx";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import DataTable from "../../global/components/dataTable";
import Button from "../../global/components/button";
import Modal from "../../global/components/modal";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import Select from "../../global/components/select";
import FeedbackModal from "../../global/components/feedbackModal";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useAuth } from "../../global/hooks/useAuth";
import { isAdminRole } from "../../global/constants/domainConstants";
import {
  FIELD_LIMITS,
  validateTitle,
} from "../../global/utils/inputValidation";
import {
  createFaculty,
  createProgram,
  listAdminFaculties,
  listAdminPrograms,
  PROGRAM_LEVEL_OPTIONS,
  updateFaculty,
  updateProgram,
  type AdminFacultyRow,
  type AdminProgramRow,
  type ProgramLevelValue,
} from "../services/adminService";

type SelectOption = { label: string; value: string };
type CatalogTab = "programs" | "faculties";

function AdminProgramsPage() {
  const { currentRole } = useAuth();
  const { feedback, closeFeedback, runAction } = useActionFeedback();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<CatalogTab>("programs");
  const [programs, setPrograms] = useState<AdminProgramRow[]>([]);
  const [faculties, setFaculties] = useState<AdminFacultyRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AdminProgramRow | null>(
    null,
  );
  const [programName, setProgramName] = useState("");
  const [programFaculty, setProgramFaculty] = useState<SelectOption | null>(
    null,
  );
  const [programLevel, setProgramLevel] = useState<SelectOption | null>(null);

  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<AdminFacultyRow | null>(
    null,
  );
  const [facultyName, setFacultyName] = useState("");

  const programNameCheck = validateTitle(programName, {
    label: "El nombre del programa",
  });
  const facultyNameCheck = validateTitle(facultyName, {
    label: "El nombre de la facultad",
  });

  const programFormValid =
    programNameCheck.ok && Boolean(programFaculty) && Boolean(programLevel);
  const facultyFormValid = facultyNameCheck.ok;

  const activeFacultyOptions = useMemo(
    () =>
      faculties
        .filter((item) => item.isActive)
        .map((item) => ({ label: item.name, value: item.id }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [faculties],
  );

  const levelOptions = useMemo(
    () =>
      PROGRAM_LEVEL_OPTIONS.map((option) => ({
        label: option.label,
        value: String(option.value),
      })),
    [],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [programRows, facultyRows] = await Promise.all([
        listAdminPrograms(),
        listAdminFaculties(),
      ]);
      setPrograms(programRows);
      setFaculties(facultyRows);
    } catch (error) {
      console.error("Error cargando catálogo académico", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!isAdminRole(currentRole)) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando catálogo académico..." />;
  }

  const resetProgramForm = () => {
    setEditingProgram(null);
    setProgramName("");
    setProgramFaculty(null);
    setProgramLevel(null);
  };

  const resetFacultyForm = () => {
    setEditingFaculty(null);
    setFacultyName("");
  };

  const openCreateProgram = () => {
    resetProgramForm();
    setProgramModalOpen(true);
  };

  const openEditProgram = (row: AdminProgramRow) => {
    setEditingProgram(row);
    setProgramName(row.name);
    setProgramFaculty(
      row.facultyId
        ? { label: row.facultyName, value: row.facultyId }
        : null,
    );
    setProgramLevel(
      row.level != null
        ? {
            label: row.levelLabel,
            value: String(row.level),
          }
        : null,
    );
    setProgramModalOpen(true);
  };

  const openCreateFaculty = () => {
    resetFacultyForm();
    setFacultyModalOpen(true);
  };

  const openEditFaculty = (row: AdminFacultyRow) => {
    setEditingFaculty(row);
    setFacultyName(row.name);
    setFacultyModalOpen(true);
  };

  const handleSaveProgram = async () => {
    if (!programFormValid || !programFaculty || !programLevel) return;

    const payload = {
      name: programNameCheck.value,
      facultyId: programFaculty.value,
      level: Number(programLevel.value) as ProgramLevelValue,
    };

    try {
      setSubmitting(true);
      await runAction(
        () =>
          editingProgram
            ? updateProgram({ id: editingProgram.id, ...payload })
            : createProgram(payload),
        {
          successTitle: editingProgram
            ? "Programa actualizado"
            : "Programa creado",
          successMessage: editingProgram
            ? "Los datos del programa se guardaron correctamente."
            : "El programa se registró correctamente en la facultad.",
          errorTitle: editingProgram
            ? "No se pudo actualizar el programa"
            : "No se pudo crear el programa",
          errorMessage:
            "Verifica los datos e intenta nuevamente. Si el problema persiste, revisa permisos en Dataverse.",
          onSuccess: async () => {
            setProgramModalOpen(false);
            resetProgramForm();
            await loadData();
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveFaculty = async () => {
    if (!facultyFormValid) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          editingFaculty
            ? updateFaculty({
                id: editingFaculty.id,
                name: facultyNameCheck.value,
              })
            : createFaculty(facultyNameCheck.value),
        {
          successTitle: editingFaculty
            ? "Facultad actualizada"
            : "Facultad creada",
          successMessage: editingFaculty
            ? "El nombre de la facultad se actualizó correctamente."
            : "La facultad se registró correctamente.",
          errorTitle: editingFaculty
            ? "No se pudo actualizar la facultad"
            : "No se pudo crear la facultad",
          errorMessage:
            "Verifica el nombre e intenta nuevamente. Si el problema persiste, revisa permisos en Dataverse.",
          onSuccess: async () => {
            setFacultyModalOpen(false);
            resetFacultyForm();
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
        title="Programas y facultades"
        description="Administra el catálogo académico: facultades y programas por nivel"
        badge="Administración"
        actions={
          tab === "programs" ? (
            <Button size="sm" onClick={openCreateProgram}>
              <IoAddOutline size={16} />
              Nuevo programa
            </Button>
          ) : (
            <Button size="sm" onClick={openCreateFaculty}>
              <IoAddOutline size={16} />
              Nueva facultad
            </Button>
          )
        }
      />

      <div className="inline-flex gap-1 rounded-xl border border-border bg-gray-50 p-1">
        {(
          [
            {
              id: "programs" as const,
              label: `Programas (${programs.length})`,
            },
            {
              id: "faculties" as const,
              label: `Facultades (${faculties.length})`,
            },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              tab === option.id
                ? "bg-white text-primary shadow-sm"
                : "text-muted hover:text-primary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "programs" ? (
        <DataTable
          title="Programas registrados"
          subtitle={`${programs.length} programa${programs.length === 1 ? "" : "s"}`}
          columns={[
            { key: "name", header: "Programa" },
            { key: "facultyName", header: "Facultad" },
            { key: "levelLabel", header: "Nivel" },
            {
              key: "id",
              header: "Acciones",
              render: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditProgram(row)}
                >
                  <IoCreateOutline size={16} />
                  Editar
                </Button>
              ),
            },
          ]}
          data={programs}
          searchKeys={["name", "facultyName", "levelLabel"]}
          emptyMessage="Aún no hay programas registrados"
        />
      ) : (
        <DataTable
          title="Facultades registradas"
          subtitle={`${faculties.length} facultad${faculties.length === 1 ? "" : "es"}`}
          columns={[
            { key: "name", header: "Facultad" },
            {
              key: "isActive",
              header: "Estado",
              render: (row) => (
                <span
                  className={clsx(
                    "inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                    row.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-muted",
                  )}
                >
                  {row.isActive ? "Activa" : "Inactiva"}
                </span>
              ),
            },
            {
              key: "id",
              header: "Acciones",
              render: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditFaculty(row)}
                >
                  <IoCreateOutline size={16} />
                  Editar
                </Button>
              ),
            },
          ]}
          data={faculties}
          searchKeys={["name"]}
          emptyMessage="Aún no hay facultades registradas"
        />
      )}

      <Modal
        isOpen={programModalOpen}
        onClose={() => {
          if (submitting) return;
          setProgramModalOpen(false);
          resetProgramForm();
        }}
        title={editingProgram ? "Editar programa" : "Nuevo programa"}
        size="md"
        preventClose={submitting}
      >
        <div className="space-y-4">
          <FormField
            label="Nombre del programa"
            required
            error={programName.trim() ? programNameCheck.message : undefined}
          >
            <InputText
              value={programName}
              onChange={setProgramName}
              maxLength={FIELD_LIMITS.title}
              placeholder="Ej. Ingeniería de Sistemas"
              disabled={submitting}
            />
          </FormField>

          <FormField label="Facultad" required>
            <Select
              options={activeFacultyOptions}
              value={programFaculty}
              onChange={setProgramFaculty}
              placeholder="Selecciona facultad"
              disabled={submitting}
            />
          </FormField>

          <FormField label="Nivel" required>
            <Select
              options={levelOptions}
              value={programLevel}
              onChange={setProgramLevel}
              placeholder="Selecciona nivel"
              disabled={submitting}
            />
          </FormField>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setProgramModalOpen(false);
                resetProgramForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={submitting || !programFormValid}
              onClick={() => void handleSaveProgram()}
            >
              {submitting
                ? "Guardando..."
                : editingProgram
                  ? "Guardar cambios"
                  : "Crear programa"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={facultyModalOpen}
        onClose={() => {
          if (submitting) return;
          setFacultyModalOpen(false);
          resetFacultyForm();
        }}
        title={editingFaculty ? "Editar facultad" : "Nueva facultad"}
        size="md"
        preventClose={submitting}
      >
        <div className="space-y-4">
          <FormField
            label="Nombre de la facultad"
            required
            error={facultyName.trim() ? facultyNameCheck.message : undefined}
          >
            <InputText
              value={facultyName}
              onChange={setFacultyName}
              maxLength={FIELD_LIMITS.title}
              placeholder="Ej. Facultad de Ingeniería"
              disabled={submitting}
            />
          </FormField>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setFacultyModalOpen(false);
                resetFacultyForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={submitting || !facultyFormValid}
              onClick={() => void handleSaveFaculty()}
            >
              {submitting
                ? "Guardando..."
                : editingFaculty
                  ? "Guardar cambios"
                  : "Crear facultad"}
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
        confirmLabel={feedback.type === "success" ? "Continuar" : "Entendido"}
      />
    </div>
  );
}

export default AdminProgramsPage;
