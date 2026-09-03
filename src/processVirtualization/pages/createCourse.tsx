import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import Select from "../../global/components/select";
import Button from "../../global/components/button";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import LoadingState from "../../global/components/loadingState";
import FeedbackModal from "../../global/components/feedbackModal";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import {
  FIELD_LIMITS,
  validateTitle,
} from "../../global/utils/inputValidation";

import {
  getFaculties,
  getPrograms,
  createCourseInstance,
} from "../../courses/services/courseService";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";

type SelectOption = { label: string; value: string };

function CreateCourse() {
  const navigate = useNavigate();
  const { feedback, closeFeedback, runAction } = useActionFeedback();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [courseName, setCourseName] = useState("");
  const [faculties, setFaculties] = useState<Dev_table_faculties[]>([]);
  const [programs, setPrograms] = useState<Dev_table_programs[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<SelectOption | null>(
    null,
  );
  const [selectedProgram, setSelectedProgram] = useState<SelectOption | null>(
    null,
  );

  const courseNameCheck = validateTitle(courseName, {
    label: "El nombre del curso",
  });
  const formIsValid =
    courseNameCheck.ok && Boolean(selectedFaculty) && Boolean(selectedProgram);

  const facultyOptions = useMemo(
    () =>
      [...faculties]
        .map((faculty) => ({
          label: faculty.dev_namefaculty?.trim() || "Sin nombre",
          value: faculty.dev_table_facultyid,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [faculties],
  );

  const programOptions = useMemo(() => {
    if (!selectedFaculty) return [];

    return [...programs]
      .filter(
        (program) =>
          program._dev_table_faculty_value === selectedFaculty.value,
      )
      .map((program) => ({
        label: program.dev_nameprogram?.trim() || "Sin nombre",
        value: program.dev_table_programid,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [programs, selectedFaculty]);

  const handleFacultyChange = (faculty: SelectOption | null) => {
    setSelectedFaculty(faculty);
    setSelectedProgram(null);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [facultiesData, programsData] = await Promise.all([
          getFaculties(),
          getPrograms(),
        ]);

        setFaculties(facultiesData);
        setPrograms(programsData);
      } catch (error) {
        console.error("Error cargando facultades y programas", error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleSubmit = async () => {
    if (!formIsValid || !selectedProgram) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          // Solo se envía el programa; la facultad es filtro de UI.
          createCourseInstance(courseNameCheck.value, selectedProgram.value),
        {
          successTitle: "Curso creado",
          successMessage: "El curso se registró correctamente en el sistema.",
          errorTitle: "No se pudo crear el curso",
          errorMessage:
            "Verifica los datos e intenta nuevamente. Si el problema persiste, contacta al administrador.",
          onSuccessClose: () => navigate("/virtualization-processes"),
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando formulario..." />;
  }

  return (
    <div>
      <PageHeader
        title="Crear Curso"
        description="Registra un nuevo curso asociado a un programa académico"
        backTo="/virtualization-processes"
      />

      <FormBusyOverlay
        busy={submitting}
        message="Creando curso..."
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]"
      >
        <div className="border-b border-border bg-gradient-to-r from-secondary/5 to-transparent px-6 py-4 sm:px-8">
          <h2 className="text-base font-semibold text-primary">
            Información del curso
          </h2>
        </div>
        <div className="space-y-5 p-4 sm:p-6 md:p-8">
          <FormField
            label="Nombre del curso"
            required
            error={courseName.trim() ? courseNameCheck.message : undefined}
            hint="Nombre oficial del curso (ej. Cálculo Diferencial). Solo letras, tildes, números y guiones."
          >
            <InputText
              value={courseName}
              onChange={setCourseName}
              placeholder="Nombre del curso"
              maxLength={FIELD_LIMITS.title}
              invalid={Boolean(courseName.trim() && !courseNameCheck.ok)}
              disabled={submitting}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            <FormField
              label="Facultad"
              required
              hint="Primero elige la facultad para filtrar los programas."
            >
              <Select
                options={facultyOptions}
                value={selectedFaculty}
                onChange={handleFacultyChange}
                placeholder="Selecciona una facultad"
                disabled={submitting}
              />
            </FormField>

            <FormField
              label="Programa"
              required
              hint="Solo se listan programas de la facultad elegida. Al crear el curso solo se envía el programa."
            >
              <Select
                options={programOptions}
                value={selectedProgram}
                onChange={setSelectedProgram}
                placeholder={
                  selectedFaculty
                    ? programOptions.length
                      ? "Selecciona un programa"
                      : "Sin programas en esta facultad"
                    : "Selecciona primero una facultad"
                }
                disabled={submitting || !selectedFaculty}
              />
            </FormField>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              variant="secondary"
              onClick={() => navigate("/virtualization-processes")}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formIsValid}
            >
              Crear curso
            </Button>
          </div>
        </div>
      </FormBusyOverlay>

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

export default CreateCourse;
