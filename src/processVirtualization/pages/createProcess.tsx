import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import EmailAutocomplete from "../../global/components/emailAutocomplete";
import Select from "../../global/components/select";
import Button from "../../global/components/button";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import LoadingState from "../../global/components/loadingState";
import FeedbackModal from "../../global/components/feedbackModal";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useAuth } from "../../global/hooks/useAuth";
import {
  FIELD_LIMITS,
  validateOrganizationEmail,
  validateTitle,
} from "../../global/utils/inputValidation";
import { buildProcessDisplayName } from "../../global/utils/processNameUtils";

import {
  getAvailableCourses,
  getFaculties,
  getProcessNames,
  getPrograms,
  getRoles,
  createVirtualizationProcess,
} from "../../courses/services/courseService";
import { findRoleId } from "../../courses/utils/roleUtils";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";
import type { Dev_tablecourseinstances } from "../../generated/models/Dev_tablecourseinstancesModel";

type SelectOption = { label: string; value: string };

function CreateProcess() {
  const navigate = useNavigate();
  const { user, refreshRoles } = useAuth();
  const { feedback, closeFeedback, runAction } = useActionFeedback();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rolesError, setRolesError] = useState("");

  const [processName, setProcessName] = useState("");
  const [existingProcessNames, setExistingProcessNames] = useState<string[]>(
    [],
  );

  const [faculties, setFaculties] = useState<Dev_table_faculties[]>([]);
  const [programs, setPrograms] = useState<Dev_table_programs[]>([]);
  const [courses, setCourses] = useState<Dev_tablecourseinstances[]>([]);

  const [selectedFaculty, setSelectedFaculty] = useState<SelectOption | null>(
    null,
  );
  const [selectedProgram, setSelectedProgram] = useState<SelectOption | null>(
    null,
  );
  const [selectedCourse, setSelectedCourse] = useState<SelectOption | null>(
    null,
  );

  const [leaderEmail, setLeaderEmail] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [validatorEmail, setValidatorEmail] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [credits, setCredits] = useState("");

  const [roleIds, setRoleIds] = useState({
    leader: "",
    author: "",
    validator: "",
    advisor: "",
  });

  const processNameCheck = validateTitle(processName, {
    label: "El nombre del proceso",
  });
  const leaderCheck = validateOrganizationEmail(leaderEmail);
  const authorCheck = validateOrganizationEmail(authorEmail);
  const validatorCheck = validateOrganizationEmail(validatorEmail);
  const advisorCheck = validateOrganizationEmail(advisorEmail);
  const creditsNumber = Number(credits);
  const creditsValid =
    credits.trim() !== "" &&
    Number.isInteger(creditsNumber) &&
    creditsNumber >= 1;

  const namePreview = processNameCheck.ok
    ? buildProcessDisplayName(processNameCheck.value, existingProcessNames)
    : null;

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

  const courseOptions = useMemo(() => {
    if (!selectedProgram) return [];

    return [...courses]
      .filter(
        (course) => course._dev_tableprogram_value === selectedProgram.value,
      )
      .map((course) => ({
        label: course.dev_namecourse?.trim() || "Sin nombre",
        value: course.dev_tablecourseinstanceid,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [courses, selectedProgram]);

  const formIsValid =
    processNameCheck.ok &&
    Boolean(selectedFaculty) &&
    Boolean(selectedProgram) &&
    Boolean(selectedCourse) &&
    creditsValid &&
    leaderCheck.ok &&
    authorCheck.ok &&
    validatorCheck.ok &&
    advisorCheck.ok &&
    Boolean(roleIds.leader) &&
    Boolean(roleIds.author) &&
    Boolean(roleIds.validator) &&
    Boolean(roleIds.advisor);

  const handleFacultyChange = (faculty: SelectOption | null) => {
    setSelectedFaculty(faculty);
    setSelectedProgram(null);
    setSelectedCourse(null);
  };

  const handleProgramChange = (program: SelectOption | null) => {
    setSelectedProgram(program);
    setSelectedCourse(null);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [facultiesData, programsData, coursesData, roles, processNames] =
          await Promise.all([
            getFaculties(),
            getPrograms(),
            getAvailableCourses(),
            getRoles(),
            getProcessNames(),
          ]);

        setFaculties(facultiesData);
        setPrograms(programsData);
        setCourses(coursesData);
        setExistingProcessNames(processNames);

        const leaderRoleId = findRoleId(roles, [
          "Líder de virtualización",
          "Lider de virtualizacion",
          "Líder de Virtualización",
        ]);
        const authorRoleId = findRoleId(roles, [
          "Autor de asignatura",
          "Autor de Asignatura",
        ]);
        const validatorRoleId = findRoleId(roles, [
          "Validador disciplinar",
          "Validador Disciplinar",
        ]);
        const advisorRoleId = findRoleId(roles, ["Asesor pedagógico"]);

        setRoleIds({
          leader: leaderRoleId,
          author: authorRoleId,
          validator: validatorRoleId,
          advisor: advisorRoleId,
        });

        if (
          !leaderRoleId ||
          !authorRoleId ||
          !validatorRoleId ||
          !advisorRoleId
        ) {
          setRolesError(
            "No se encontraron todos los roles en el sistema. Verifica que existan Líder de virtualización, Autor de asignatura, Validador disciplinar y Asesor pedagógico.",
          );
        }
      } catch (error) {
        console.error("Error cargando datos del formulario", error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleSubmit = async () => {
    if (!formIsValid || !selectedCourse) return;

    let createdProcessId = "";

    try {
      setSubmitting(true);
      await runAction(
        async () => {
          // Solo se envía el curso; facultad y programa son filtros de UI.
          createdProcessId = await createVirtualizationProcess({
            processName: processNameCheck.value,
            courseId: selectedCourse.value,
            credits: creditsNumber,
            leaderEmail: leaderCheck.value,
            authorEmail: authorCheck.value,
            validatorEmail: validatorCheck.value,
            advisorEmail: advisorCheck.value,
            leaderRoleId: roleIds.leader,
            authorRoleId: roleIds.author,
            validatorRoleId: roleIds.validator,
            advisorRoleId: roleIds.advisor,
          });
        },
        {
          successTitle: "Proceso creado",
          successMessage:
            "El proceso de virtualización se creó y los roles fueron asignados correctamente.",
          errorTitle: "No se pudo crear el proceso",
          errorMessage:
            "Verifica los datos e intenta nuevamente. Si el problema persiste, contacta al administrador.",
          onSuccess: async () => {
            const me = user?.email?.trim().toLowerCase() ?? "";
            const assigned = [
              leaderCheck.value,
              authorCheck.value,
              validatorCheck.value,
              advisorCheck.value,
            ].map((email) => email.trim().toLowerCase());

            if (!me || !assigned.includes(me)) return;

            await refreshRoles();
            window.setTimeout(() => {
              void refreshRoles();
            }, 4_000);
          },
          onSuccessClose: () =>
            navigate(
              createdProcessId
                ? `/virtualization-processes/${createdProcessId}`
                : "/virtualization-processes",
            ),
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
        title="Crear Proceso de Virtualización"
        description="Configura un nuevo proceso y asigna los roles responsables"
        backTo="/virtualization-processes"
      />

      <FormBusyOverlay
        busy={submitting}
        message="Creando proceso..."
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]"
      >
        <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 sm:px-8">
          <h2 className="text-base font-semibold text-primary">
            Datos del proceso
          </h2>
        </div>
        <div className="space-y-5 p-4 sm:p-6 md:p-8">
          {rolesError && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {rolesError}
            </div>
          )}

          <FormField
            label="Nombre del proceso"
            required
            error={processName.trim() ? processNameCheck.message : undefined}
            hint="Escribe solo el título (ej. Desarrollo Web I). El semestre y el código consecutivo se agregan automáticamente."
          >
            <InputText
              value={processName}
              onChange={setProcessName}
              placeholder="Nombre del proceso"
              maxLength={FIELD_LIMITS.title}
              invalid={Boolean(processName.trim() && !processNameCheck.ok)}
              disabled={submitting}
            />
          </FormField>

          {namePreview && (
            <p className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
              Se creará como:{" "}
              <span className="font-medium">{namePreview}</span>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
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
              hint="Solo se listan programas de la facultad elegida."
            >
              <Select
                options={programOptions}
                value={selectedProgram}
                onChange={handleProgramChange}
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

            <FormField
              label="Curso"
              required
              hint="Solo se listan cursos del programa elegido. Al crear el proceso solo se envía el curso."
            >
              <Select
                options={courseOptions}
                value={selectedCourse}
                onChange={setSelectedCourse}
                placeholder={
                  selectedProgram
                    ? courseOptions.length
                      ? "Selecciona un curso"
                      : "Sin cursos en este programa"
                    : "Selecciona primero un programa"
                }
                disabled={submitting || !selectedProgram}
              />
            </FormField>
          </div>

          <FormField
            label="Créditos"
            required
            error={
              credits.trim() && !creditsValid
                ? "Ingresa un número entero mayor o igual a 1."
                : undefined
            }
            hint="Cantidad de créditos del proceso de virtualización."
          >
            <InputText
              type="number"
              value={credits}
              onChange={setCredits}
              placeholder="Ej. 3"
              invalid={Boolean(credits.trim() && !creditsValid)}
              disabled={submitting}
            />
          </FormField>

          <div className="border-t pt-5">
            <h3 className="mb-4 text-sm font-semibold text-primary">
              Asignar roles
            </h3>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              <FormField
                label="Líder de virtualización"
                required
                error={leaderEmail.trim() ? leaderCheck.message : undefined}
                hint="Correo institucional del líder responsable del proceso."
              >
                <EmailAutocomplete
                  value={leaderEmail}
                  onChange={setLeaderEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(leaderEmail.trim() && !leaderCheck.ok)}
                  disabled={submitting}
                />
              </FormField>

              <FormField
                label="Autor de asignatura"
                required
                error={authorEmail.trim() ? authorCheck.message : undefined}
                hint="Escribe el correo institucional del autor. Puedes buscar por nombre o correo (ej. autor@unbosque.edu.co)."
              >
                <EmailAutocomplete
                  value={authorEmail}
                  onChange={setAuthorEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(authorEmail.trim() && !authorCheck.ok)}
                  disabled={submitting}
                />
              </FormField>

              <FormField
                label="Validador disciplinar"
                required
                error={
                  validatorEmail.trim() ? validatorCheck.message : undefined
                }
                hint="Escribe el correo institucional del validador. Puedes buscar por nombre o correo (ej. validador@unbosque.edu.co)."
              >
                <EmailAutocomplete
                  value={validatorEmail}
                  onChange={setValidatorEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(validatorEmail.trim() && !validatorCheck.ok)}
                  disabled={submitting}
                />
              </FormField>

              <FormField
                label="Asesor pedagógico"
                required
                error={advisorEmail.trim() ? advisorCheck.message : undefined}
                hint="Escribe el correo institucional del asesor. Puedes buscar por nombre o correo (ej. asesor@unbosque.edu.co)."
              >
                <EmailAutocomplete
                  value={advisorEmail}
                  onChange={setAdvisorEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(advisorEmail.trim() && !advisorCheck.ok)}
                  disabled={submitting}
                />
              </FormField>
            </div>
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
              Aceptar
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

export default CreateProcess;
