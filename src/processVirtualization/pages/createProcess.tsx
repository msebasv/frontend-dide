import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import EmailAutocomplete, {
  useDirectoryEmailReady,
} from "../../global/components/emailAutocomplete";
import Select from "../../global/components/select";
import Button from "../../global/components/button";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import LoadingState from "../../global/components/loadingState";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { PENDING_ACTION_COPY } from "../../global/constants/operationCopy";
import { useAuth } from "../../global/hooks/useAuth";
import {
  canCreateProcesses,
  isDideCoordinatorRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import {
  PROCESS_CREDITS_MIN,
  validateOrganizationEmail,
  validateProcessName,
} from "../../global/utils/inputValidation";
import {
  buildProcessDisplayName,
  getCurrentSemester,
  getNextProcessCode,
  processBaseNameMaxLength,
} from "../../global/utils/processNameUtils";

import {
  getAvailableCourses,
  getFaculties,
  getProcessNames,
  getPrograms,
  getRoles,
  createVirtualizationProcess,
} from "../../courses/services/courseService";
import { resolveProcessRoleIds } from "../../courses/utils/roleUtils";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import type { Dev_table_programs } from "../../generated/models/Dev_table_programsModel";
import type { Dev_tablecourseinstances } from "../../generated/models/Dev_tablecourseinstancesModel";

type SelectOption = { label: string; value: string; action?: boolean };

const CREATE_COURSE_OPTION_VALUE = "__create_course__";

function CreateProcess() {
  const navigate = useNavigate();
  const { user, currentRole, refreshRoles } = useAuth();
  const { runAction, isOperationPending } = useActionFeedback();

  // El coordinador DIDE entra desde Seguimiento; no tiene el listado de procesos.
  const returnTo = isDideCoordinatorRole(currentRole)
    ? "/tracking"
    : "/virtualization-processes";
  const canManage = canCreateProcesses(currentRole);
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
  const formBusy = submitting || isOperationPending;

  const [leaderEmail, setLeaderEmail] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [credits, setCredits] = useState("");

  const [roleIds, setRoleIds] = useState({
    leader: "",
    author: "",
    advisor: "",
  });

  const processNameMaxLength = useMemo(
    () =>
      processBaseNameMaxLength(
        getCurrentSemester(),
        getNextProcessCode(existingProcessNames),
      ),
    [existingProcessNames],
  );
  const processNameCheck = validateProcessName(processName, {
    maxLength: processNameMaxLength,
  });
  const leaderCheck = validateOrganizationEmail(leaderEmail);
  const authorCheck = validateOrganizationEmail(authorEmail);
  const advisorCheck = validateOrganizationEmail(advisorEmail);
  const directoryEmails = useDirectoryEmailReady();
  const creditsNumber = Number(credits);
  const creditsValid =
    credits.trim() !== "" &&
    Number.isInteger(creditsNumber) &&
    creditsNumber >= PROCESS_CREDITS_MIN;

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

    const items = [...courses]
      .filter(
        (course) => course._dev_tableprogram_value === selectedProgram.value,
      )
      .map((course) => ({
        label: course.dev_namecourse?.trim() || "Sin nombre",
        value: course.dev_tablecourseinstanceid,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));

    return [
      ...items,
      {
        label: "Crear curso",
        value: CREATE_COURSE_OPTION_VALUE,
        action: true,
      },
    ];
  }, [courses, selectedProgram]);

  const courseListCount = courseOptions.filter(
    (option) => option.value !== CREATE_COURSE_OPTION_VALUE,
  ).length;

  const formIsValid =
    processNameCheck.ok &&
    Boolean(selectedFaculty) &&
    Boolean(selectedProgram) &&
    Boolean(selectedCourse) &&
    selectedCourse?.value !== CREATE_COURSE_OPTION_VALUE &&
    creditsValid &&
    leaderCheck.ok &&
    authorCheck.ok &&
    advisorCheck.ok &&
    directoryEmails.allReady("leader", "author", "advisor") &&
    Boolean(roleIds.leader) &&
    Boolean(roleIds.author) &&
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

  const handleCourseChange = (course: SelectOption | null) => {
    if (course?.value === CREATE_COURSE_OPTION_VALUE) {
      navigate("/virtualization-processes/create-course", {
        state: { returnTo: "/virtualization-processes/create" },
      });
      return;
    }
    setSelectedCourse(course);
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

        const {
          leader: leaderRoleId,
          author: authorRoleId,
          advisor: advisorRoleId,
        } = resolveProcessRoleIds(roles);

        setRoleIds({
          leader: leaderRoleId,
          author: authorRoleId,
          advisor: advisorRoleId,
        });

        if (!leaderRoleId || !authorRoleId || !advisorRoleId) {
          setRolesError(
            "No se encontraron todos los roles en el sistema. Verifica que existan Líder de virtualización, Autor de asignatura y Asesor pedagógico.",
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
            advisorEmail: advisorCheck.value,
            leaderRoleId: roleIds.leader,
            authorRoleId: roleIds.author,
            advisorRoleId: roleIds.advisor,
            onProcessIdKnown: (id) => {
              createdProcessId = id;
            },
          });
        },
        {
          successTitle: "Proceso creado",
          successMessage:
            "El proceso quedó listo con estado Cargue Syllabus y los roles asignados. El líder debe asignar el validador disciplinar antes de cargar el syllabus.",
          errorTitle: "No se pudo crear el proceso",
          errorMessage:
            "Verifique los datos e intente nuevamente. Si el problema persiste, contacte al administrador.",
          ...PENDING_ACTION_COPY.createProcess,
          viewActionLabel: "Ver proceso",
          onViewAction: () => {
            navigate(
              createdProcessId
                ? `/virtualization-processes/${createdProcessId}`
                : returnTo,
            );
          },
          onSoftTimeout: () => {
            navigate(returnTo, { replace: true });
          },
          onPendingDismiss: () => {
            navigate(returnTo, { replace: true });
          },
          onSuccess: async () => {
            const me = user?.email?.trim().toLowerCase() ?? "";
            const assigned = [
              leaderCheck.value,
              authorCheck.value,
              advisorCheck.value,
            ].map((email) => email.trim().toLowerCase());

            if (me && assigned.includes(me)) {
              await refreshRoles();
              window.setTimeout(() => {
                void refreshRoles();
              }, 4_000);
            }

            navigate(returnTo, {
              replace: true,
              state: { refreshAt: Date.now() },
            });
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando formulario..." />;
  }

  return (
    <div>
      <PageHeader
        title="Crear Proceso de Virtualización"
        description="Configura un nuevo proceso y asigna los roles responsables"
        backTo={returnTo}
      />

      <FormBusyOverlay
        busy={formBusy}
        message={
          isOperationPending && !submitting
            ? "La solicitud permanece en procesamiento..."
            : "Creando proceso..."
        }
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
            hint="Solo letras, números y espacios. El nombre completo, con semestre y código, no supera 200 caracteres."
          >
            <InputText
              value={processName}
              onChange={setProcessName}
              placeholder="Nombre del proceso"
              maxLength={processNameMaxLength}
              invalid={Boolean(processName.trim() && !processNameCheck.ok)}
              disabled={formBusy}
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
              hint="Primero seleccione la facultad para filtrar los programas."
            >
              <Select
                options={facultyOptions}
                value={selectedFaculty}
                onChange={handleFacultyChange}
                placeholder="Seleccione una facultad"
                disabled={formBusy}
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
                      ? "Seleccione un programa"
                      : "Sin programas en esta facultad"
                    : "Seleccione primero una facultad"
                }
                disabled={formBusy || !selectedFaculty}
              />
            </FormField>

            <FormField
              label="Curso"
              required
              hint="Solo se listan cursos del programa elegido. Si no aparece, use Crear curso al final de la lista."
            >
              <Select
                options={courseOptions}
                value={selectedCourse}
                onChange={handleCourseChange}
                placeholder={
                  selectedProgram
                    ? courseListCount
                      ? "Seleccione un curso"
                      : "Sin cursos — cree uno nuevo"
                    : "Seleccione primero un programa"
                }
                disabled={formBusy || !selectedProgram}
              />
            </FormField>
          </div>

          <FormField
            label="Créditos"
            required
            error={
              credits.trim() && !creditsValid
                ? "Ingrese un número entero desde 1."
                : undefined
            }
            hint="Número entero desde 1."
          >
            <InputText
              type="number"
              value={credits}
              onChange={setCredits}
              placeholder="Ej. 3"
              min={PROCESS_CREDITS_MIN}
              step={1}
              invalid={Boolean(credits.trim() && !creditsValid)}
              disabled={formBusy}
            />
          </FormField>

          <div className="border-t pt-5">
            <h3 className="mb-4 text-sm font-semibold text-primary">
              Asignar roles
            </h3>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              <FormField
                label={USER_ROLES.LEADER}
                required
                error={leaderEmail.trim() ? leaderCheck.message : undefined}
                hint="Correo institucional del líder responsable del proceso."
              >
                <EmailAutocomplete
                  value={leaderEmail}
                  onChange={setLeaderEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(leaderEmail.trim() && !leaderCheck.ok)}
                  disabled={formBusy}
                  onDirectoryReady={directoryEmails.bind("leader")}
                />
              </FormField>

              <FormField
                label={USER_ROLES.AUTHOR}
                required
                error={authorEmail.trim() ? authorCheck.message : undefined}
                hint="Indique el correo institucional del autor. Puede buscar por nombre o correo (ej. autor@unbosque.edu.co)."
              >
                <EmailAutocomplete
                  value={authorEmail}
                  onChange={setAuthorEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(authorEmail.trim() && !authorCheck.ok)}
                  disabled={formBusy}
                  onDirectoryReady={directoryEmails.bind("author")}
                />
              </FormField>

              <FormField
                label={USER_ROLES.ADVISOR}
                required
                error={advisorEmail.trim() ? advisorCheck.message : undefined}
                hint="Indique el correo institucional del asesor. Puede buscar por nombre o correo (ej. asesor@unbosque.edu.co)."
              >
                <EmailAutocomplete
                  value={advisorEmail}
                  onChange={setAdvisorEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(advisorEmail.trim() && !advisorCheck.ok)}
                  disabled={formBusy}
                  onDirectoryReady={directoryEmails.bind("advisor")}
                />
              </FormField>
            </div>

            <p className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-primary">
              El <span className="font-semibold">validador disciplinar</span> lo
              asigna después el líder de virtualización, antes de cargar el
              syllabus.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              variant="secondary"
              onClick={() => navigate(returnTo)}
              disabled={formBusy}
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
    </div>
  );
}

export default CreateProcess;
