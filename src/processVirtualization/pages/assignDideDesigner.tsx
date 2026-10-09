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
import { canAssignDideDesigner, USER_ROLES } from "../../global/constants/domainConstants";
import { validateOrganizationEmail } from "../../global/utils/inputValidation";

import {
  assignProcessDideDesigner,
  getProcessForEdit,
} from "../../courses/services/courseService";

function AssignDideDesigner() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { user, currentRole, refreshRoles } = useAuth();
  const { runAction, isOperationPending } = useActionFeedback();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const formBusy = submitting || isOperationPending;
  const [notFound, setNotFound] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [processName, setProcessName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [designerEmail, setDesignerEmail] = useState("");

  const designerCheck = validateOrganizationEmail(designerEmail);
  const directoryEmails = useDirectoryEmailReady();
  const formIsValid =
    designerCheck.ok && directoryEmails.allReady("designer");
  const backTo = processId
    ? `/virtualization-processes/${processId}`
    : "/tracking";
  const canAssign = canAssignDideDesigner(currentRole);

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
        setDesignerEmail(editData.designerEmail);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [processId]);

  if (!canAssign) {
    return <Navigate to="/" replace />;
  }

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
          assignProcessDideDesigner({
            processId,
            designerEmail: designerCheck.value,
          }),
        {
          successTitle: "Diseñador DIDE asignado",
          successMessage:
            "El diseñador quedó asignado. El asesor ya puede cargar el guión instruccional.",
          errorTitle: "No se pudo asignar el diseñador",
          errorMessage:
            "Verifique el correo e intente nuevamente. Si el problema persiste, contacte al administrador.",
          ...PENDING_ACTION_COPY.assignDesigner,
          onSoftTimeout: () => {
            navigate(backTo, { replace: true });
          },
          onPendingDismiss: () => {
            navigate(backTo, { replace: true });
          },
          onSuccess: async () => {
            const me = user?.email?.trim().toLowerCase() ?? "";
            if (me && me === designerCheck.value.trim().toLowerCase()) {
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
          title="Asignar diseñador DIDE"
          description="No se encontró el proceso solicitado"
          backTo="/tracking"
        />
        <p className="text-sm text-muted">
          El proceso no existe o no dispone de permisos para asignar el diseñador.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Asignar diseñador DIDE"
        description="Permite agregar o modificar el Diseñador DIDE. El resto del proceso no se altera desde esta vista."
        backTo={backTo}
        badge="Diseñador pendiente"
      />

      <FormBusyOverlay
        busy={formBusy}
        message={
          isOperationPending && !submitting
            ? "La solicitud permanece en procesamiento..."
            : "Asignando diseñador..."
        }
        className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]"
      >
        <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 sm:px-8">
          <h2 className="text-base font-semibold text-primary">
            Diseñador del proceso
          </h2>
          <p className="mt-1 text-xs text-muted">
            {processName}
            {courseName ? ` · ${courseName}` : ""}
          </p>
        </div>

        <div className="space-y-5 p-4 sm:p-6 md:p-8">
          <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
            <p className="font-semibold">Asignación disponible en cualquier momento</p>
            <p className="mt-1 text-xs text-primary/80">
              Si al llegar a la fase «Cargar guión instruccional» no hay
              Diseñador DIDE asignado, el asesor no podrá cargar el guión hasta
              completar esta asignación.
            </p>
          </div>

          <FormField
            label={USER_ROLES.DIDE_DESIGNER}
            required
            error={designerEmail.trim() ? designerCheck.message : undefined}
            hint="Correo institucional del diseñador. Puede buscar por nombre o correo."
          >
            <EmailAutocomplete
              value={designerEmail}
              onChange={setDesignerEmail}
              placeholder="Buscar correo"
              invalid={Boolean(designerEmail.trim() && !designerCheck.ok)}
              disabled={formBusy}
              onDirectoryReady={directoryEmails.bind("designer")}
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
              Asignar diseñador
            </Button>
          </div>
        </div>
      </FormBusyOverlay>
    </div>
  );
}

export default AssignDideDesigner;
