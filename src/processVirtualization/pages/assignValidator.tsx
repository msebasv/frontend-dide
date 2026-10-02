import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import FormField from "../../global/components/formField";
import EmailAutocomplete, {
  useDirectoryEmailReady,
} from "../../global/components/emailAutocomplete";
import Button from "../../global/components/button";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import LoadingState from "../../global/components/loadingState";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { PENDING_ACTION_COPY } from "../../global/constants/operationCopy";
import { useAuth } from "../../global/hooks/useAuth";
import { validateOrganizationEmail } from "../../global/utils/inputValidation";
import { USER_ROLES } from "../../global/constants/domainConstants";

import {
  assignProcessValidator,
  getProcessForEdit,
} from "../../courses/services/courseService";

function AssignValidator() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { user, refreshRoles } = useAuth();
  const { runAction, isOperationPending } = useActionFeedback();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const formBusy = submitting || isOperationPending;
  const [notFound, setNotFound] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [processName, setProcessName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [validatorEmail, setValidatorEmail] = useState("");

  const validatorCheck = validateOrganizationEmail(validatorEmail);
  const directoryEmails = useDirectoryEmailReady();
  const formIsValid =
    validatorCheck.ok && directoryEmails.allReady("validator");
  const backTo = processId
    ? `/virtualization-processes/${processId}`
    : "/virtualization-processes";

  useEffect(() => {
    if (!processId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const editData = await getProcessForEdit(processId);
        if (!editData) {
          setNotFound(true);
          return;
        }

        if (editData.isFinalized) {
          setIsFinalized(true);
          return;
        }

        setProcessName(editData.processName);
        setCourseName(editData.courseName);
        setValidatorEmail(editData.validatorEmail);
      } catch (error) {
        console.error("Error cargando proceso para asignar validador", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [processId]);

  if (!loading && isFinalized && processId) {
    return (
      <Navigate to={`/virtualization-processes/${processId}`} replace />
    );
  }

  const handleSubmit = async () => {
    if (!formIsValid || !processId) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          assignProcessValidator({
            processId,
            validatorEmail: validatorCheck.value,
          }),
        {
          successTitle: "Validador asignado",
          successMessage:
            "El validador disciplinar fue asignado correctamente. Ya puede proceder con la carga del syllabus.",
          errorTitle: "No se pudo asignar el validador",
          errorMessage:
            "Verifique el correo e intente nuevamente. Si el problema persiste, contacte al administrador.",
          ...PENDING_ACTION_COPY.assignValidator,
          onSoftTimeout: () => {
            navigate(backTo, { replace: true });
          },
          onPendingDismiss: () => {
            navigate(backTo, { replace: true });
          },
          onSuccess: async () => {
            const me = user?.email?.trim().toLowerCase() ?? "";
            if (me && me === validatorCheck.value.trim().toLowerCase()) {
              await refreshRoles();
              window.setTimeout(() => {
                void refreshRoles();
              }, 4_000);
            }
            navigate(backTo, {
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

  if (loading) {
    return <LoadingState message="Cargando proceso..." />;
  }

  if (notFound || !processId) {
    return (
      <div>
        <PageHeader
          title="Asignar validador"
          description="No se encontró el proceso solicitado"
          backTo="/virtualization-processes"
        />
        <p className="text-sm text-muted">
          El proceso no existe o no dispone de permisos para asignar el validador.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Asignar validador disciplinar"
        description="Permite agregar o modificar el validador. El resto del proceso no se altera."
        backTo={backTo}
        badge="Validador pendiente"
      />

      <FormBusyOverlay
        busy={formBusy}
        message={
          isOperationPending && !submitting
            ? "La solicitud permanece en procesamiento..."
            : "Asignando validador..."
        }
        className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]"
      >
        <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 sm:px-8">
          <h2 className="text-base font-semibold text-primary">
            Validador del proceso
          </h2>
          <p className="mt-1 text-xs text-muted">
            {processName}
            {courseName ? ` · ${courseName}` : ""}
          </p>
        </div>

        <div className="space-y-5 p-4 sm:p-6 md:p-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Requisito previo al syllabus</p>
            <p className="mt-1 text-xs text-amber-900/80">
              La carga del syllabus requiere la asignación del validador
              disciplinar. Para modificar el nombre u otros roles, utilice
              «Editar proceso».
            </p>
          </div>

          <FormField
            label={USER_ROLES.VALIDATOR}
            required
            error={validatorEmail.trim() ? validatorCheck.message : undefined}
            hint="Correo institucional del validador. Puede buscar por nombre o correo."
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

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              variant="secondary"
              onClick={() => navigate(backTo)}
              disabled={formBusy}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                void handleSubmit();
              }}
              disabled={submitting || !formIsValid}
            >
              Asignar validador
            </Button>
          </div>
        </div>
      </FormBusyOverlay>
    </div>
  );
}

export default AssignValidator;
