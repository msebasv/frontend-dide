import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

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
import { canCreateOrEditProcesses, USER_ROLES } from "../../global/constants/domainConstants";
import {
  PROCESS_CREDITS_MIN,
  validateOrganizationEmail,
  validateProcessName,
} from "../../global/utils/inputValidation";
import {
  parseProcessDisplayName,
  processBaseNameMaxLength,
  rebuildProcessDisplayName,
} from "../../global/utils/processNameUtils";

import {
  getProcessForEdit,
  getRoles,
  updateVirtualizationProcess,
} from "../../courses/services/courseService";
import { resolveProcessRoleIds } from "../../courses/utils/roleUtils";

function EditProcess() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { user, currentRole, refreshRoles } = useAuth();
  const { runAction, isOperationPending } = useActionFeedback();
  const canManage = canCreateOrEditProcesses(currentRole);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const formBusy = submitting || isOperationPending;
  const [rolesError, setRolesError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  const [processName, setProcessName] = useState("");
  const [semester, setSemester] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{
    label: string;
    value: string;
  } | null>(null);
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

  const processNameMaxLength = processBaseNameMaxLength(semester, code);
  const processNameCheck = validateProcessName(processName, {
    maxLength: processNameMaxLength,
  });
  const leaderCheck = validateOrganizationEmail(leaderEmail);
  const authorCheck = validateOrganizationEmail(authorEmail);
  const validatorCheck = validateOrganizationEmail(validatorEmail);
  const advisorCheck = validateOrganizationEmail(advisorEmail);
  const directoryEmails = useDirectoryEmailReady();
  const creditsNumber = Number(credits);
  const creditsValid =
    credits.trim() !== "" &&
    Number.isInteger(creditsNumber) &&
    creditsNumber >= PROCESS_CREDITS_MIN;

  const namePreview =
    processNameCheck.ok && semester && code
      ? rebuildProcessDisplayName(processNameCheck.value, semester, code)
      : processNameCheck.ok
        ? processNameCheck.value
        : null;

  const formIsValid =
    processNameCheck.ok &&
    Boolean(selectedCourse) &&
    creditsValid &&
    leaderCheck.ok &&
    authorCheck.ok &&
    validatorCheck.ok &&
    advisorCheck.ok &&
    directoryEmails.allReady("leader", "author", "validator", "advisor") &&
    Boolean(roleIds.leader) &&
    Boolean(roleIds.author) &&
    Boolean(roleIds.validator) &&
    Boolean(roleIds.advisor);

  useEffect(() => {
    if (!processId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const [editData, roles] = await Promise.all([
          getProcessForEdit(processId),
          getRoles(),
        ]);

        if (!editData) {
          setNotFound(true);
          return;
        }

        if (editData.isFinalized) {
          setIsFinalized(true);
          return;
        }

        const parsed = parseProcessDisplayName(editData.processName);
        setProcessName(parsed.baseName);
        setSemester(parsed.semester);
        setCode(parsed.code);
        setSelectedCourse({
          label: editData.courseName,
          value: editData.courseId,
        });
        setCredits(
          editData.credits > 0 ? String(editData.credits) : "",
        );
        setLeaderEmail(editData.leaderEmail);
        setAuthorEmail(editData.authorEmail);
        setValidatorEmail(editData.validatorEmail);
        setAdvisorEmail(editData.advisorEmail);

        const {
          leader: leaderRoleId,
          author: authorRoleId,
          validator: validatorRoleId,
          advisor: advisorRoleId,
        } = resolveProcessRoleIds(roles);

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
        console.error("Error cargando proceso para edición", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [processId]);

  const handleSubmit = async () => {
    if (!formIsValid || !selectedCourse || !processId || !namePreview) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          updateVirtualizationProcess({
            processId,
            processName: namePreview,
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
          }),
        {
          successTitle: "Proceso actualizado",
          successMessage:
            "El nombre y los responsables del proceso se actualizaron correctamente.",
          errorTitle: "No se pudo actualizar el proceso",
          errorMessage:
            "Verifique los datos e intente nuevamente. Si el problema persiste, contacte al administrador.",
          ...PENDING_ACTION_COPY.updateProcess,
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
            navigate(`/virtualization-processes/${processId}`, {
              replace: true,
            }),
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
    return <LoadingState message="Cargando proceso..." />;
  }

  if (isFinalized && processId) {
    return (
      <Navigate to={`/virtualization-processes/${processId}`} replace />
    );
  }

  if (notFound || !processId) {
    return (
      <div>
        <PageHeader
          title="Editar proceso"
          description="No se encontró el proceso solicitado"
          backTo="/virtualization-processes"
        />
        <p className="text-sm text-muted">
          El proceso no existe o no dispone de permisos para editarlo.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Editar proceso"
        description="Actualiza el nombre y los usuarios asignados a cada rol"
        backTo={`/virtualization-processes/${processId}`}
      />

      <FormBusyOverlay
        busy={formBusy}
        message={
          isOperationPending && !submitting
            ? "La solicitud permanece en procesamiento..."
            : "Guardando cambios..."
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
              Quedará como:{" "}
              <span className="font-medium">{namePreview}</span>
            </p>
          )}

          <FormField
            label="Curso asociado"
            hint="El curso no se puede cambiar después de crear el proceso."
          >
            <Select
              options={selectedCourse ? [selectedCourse] : []}
              value={selectedCourse}
              onChange={() => undefined}
              placeholder="Curso"
              disabled
            />
          </FormField>

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
                hint="Correo institucional del autor. Puede buscar por nombre o correo."
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
                label={USER_ROLES.VALIDATOR}
                required
                error={
                  validatorEmail.trim() ? validatorCheck.message : undefined
                }
                hint="Obligatorio antes de cargar el syllabus. Solo el líder de virtualización debe asignarlo."
              >
                <EmailAutocomplete
                  value={validatorEmail}
                  onChange={setValidatorEmail}
                  placeholder="Buscar correo"
                  invalid={Boolean(validatorEmail.trim() && !validatorCheck.ok)}
                  disabled={formBusy}
                  onDirectoryReady={directoryEmails.bind("validator")}
                />
              </FormField>

              <FormField
                label={USER_ROLES.ADVISOR}
                required
                error={advisorEmail.trim() ? advisorCheck.message : undefined}
                hint="Correo institucional del asesor. Puede buscar por nombre o correo."
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
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              variant="secondary"
              onClick={() =>
                navigate(`/virtualization-processes/${processId}`)
              }
              disabled={formBusy}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !formIsValid}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </FormBusyOverlay>
    </div>
  );
}

export default EditProcess;
