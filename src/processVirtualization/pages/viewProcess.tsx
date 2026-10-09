import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import {
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoCreateOutline,
  IoPersonAddOutline,
  IoTrashOutline,
} from "react-icons/io5";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";

import { useAuth } from "../../global/hooks/useAuth";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import {
  OPERATION_COPY,
  PENDING_ACTION_COPY,
} from "../../global/constants/operationCopy";
import { useCourseDetail } from "../../courses/hooks/useCourseDetail";
import CourseDetailView from "../../courses/components/courseDetailView";
import ClassroomConfirmModal from "../../courses/components/classroomConfirmModal";
import { confirmClassroomUpload } from "../../courses/services/courseService";
import {
  canUserConfirmClassroomStatus,
  canUserUploadStatus,
  hasAssignedDideDesigner,
  hasAssignedValidator,
  isAdvisorGuideUploadStatus,
  isLeaderSyllabusStatus,
} from "../../courses/mappers/courseMappers";
import {
  canAssignDideDesigner,
  canCreateOrEditProcesses,
  canDeleteProcesses,
  isCoordinatorRole,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
import { OPERATION_SETTLED_EVENT } from "../../global/utils/operationSettled";
import { deleteVirtualizationProcess } from "../services/processMutationService";
import DeleteProcessModal from "../components/deleteProcessModal";

const ViewProcess = () => {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole, refreshRoles } = useAuth();
  const { detail, loading, loadDetail } = useCourseDetail();
  const { runAction, isOperationPending, pendingResourceLock } =
    useActionFeedback();
  const [showClassroomConfirm, setShowClassroomConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formBusy = submitting || isOperationPending;
  const syllabusUploadLocked =
    Boolean(processId) && pendingResourceLock?.processId === processId;

  const includeInactive = canDeleteProcesses(currentRole);

  useEffect(() => {
    if (processId) void loadDetail(processId, { includeInactive });
  }, [
    processId,
    loadDetail,
    includeInactive,
    location.key,
    (location.state as { refreshAt?: number } | null)?.refreshAt,
  ]);

  useEffect(() => {
    if (!processId) return;
    const reload = () => {
      void loadDetail(processId, { refresh: true, includeInactive });
    };
    window.addEventListener(OPERATION_SETTLED_EVENT, reload);
    return () => window.removeEventListener(OPERATION_SETTLED_EVENT, reload);
  }, [processId, loadDetail, includeInactive]);

  const isFinalized = detail?.status === PROCESS_PHASES.COMPLETED;
  const isDeleted = Boolean(detail?.isDeleted);

  const hasValidator = useMemo(
    () => (detail ? hasAssignedValidator(detail.assignedRoles) : false),
    [detail],
  );

  const hasDesigner = useMemo(
    () => (detail ? hasAssignedDideDesigner(detail.assignedRoles) : false),
    [detail],
  );

  const isSyllabusPhase = useMemo(
    () => (detail ? isLeaderSyllabusStatus(detail.status) : false),
    [detail],
  );

  const needsValidatorAssignment =
    !isDeleted && !isFinalized && isSyllabusPhase && !hasValidator;

  /** Bloqueo del asesor: fase de guión sin diseñador. */
  const guideBlockedWithoutDesigner = useMemo(() => {
    if (isFinalized || isDeleted || !detail || hasDesigner) return false;
    if (isAdvisorGuideUploadStatus(detail.status)) return true;
    return detail.materials.some((material) =>
      isAdvisorGuideUploadStatus(material.status),
    );
  }, [detail, hasDesigner, isFinalized, isDeleted]);

  const canUpload = useMemo(() => {
    if (isFinalized || isDeleted || !detail || needsValidatorAssignment) {
      return false;
    }
    return canUserUploadStatus(currentRole, detail.status);
  }, [
    currentRole,
    detail,
    needsValidatorAssignment,
    isFinalized,
    isDeleted,
  ]);

  const canConfirmClassroom = useMemo(() => {
    if (isFinalized || isDeleted || !detail) return false;
    return canUserConfirmClassroomStatus(currentRole, detail.status);
  }, [currentRole, detail, isFinalized, isDeleted]);

  const canEditProcess =
    !isDeleted && !isFinalized && canCreateOrEditProcesses(currentRole);
  const canDeleteProcess = !isDeleted && canDeleteProcesses(currentRole);
  const canAssignDesigner =
    !isDeleted && !isFinalized && canAssignDideDesigner(currentRole);
  const handleDeleteProcess = async () => {
    if (!processId || !detail) return;
    setShowDeleteConfirm(false);

    await runAction(() => deleteVirtualizationProcess(processId), {
      successTitle: "Proceso eliminado",
      successMessage: "El proceso y sus registros asociados ya no están activos.",
      errorTitle: "No se pudo eliminar",
      errorMessage: "Intente nuevamente o verifique los permisos en Dataverse.",
      onSuccess: async () => {
        await refreshRoles();
        navigate("/virtualization-processes", {
          state: { refreshAt: Date.now() },
        });
      },
    });
  };

  const backTo = isCoordinatorRole(currentRole)
    ? "/tracking"
    : "/virtualization-processes";

  const handleConfirmClassroom = async () => {
    if (!processId) return;
    try {
      setSubmitting(true);
      await runAction(() => confirmClassroomUpload({ processId }), {
        successTitle: PROCESS_PHASES.COMPLETED,
        successMessage: "El cargue en el aula quedó confirmado.",
        errorTitle: "No se pudo confirmar",
        ...PENDING_ACTION_COPY.confirmClassroom,
        onSoftTimeout: () => setShowClassroomConfirm(false),
        onSuccess: async () => {
          setShowClassroomConfirm(false);
          await loadDetail(processId, { refresh: true, includeInactive });
        },
        onSuccessClose: () => {
          void loadDetail(processId, { refresh: true, includeInactive });
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !detail) {
    return <LoadingState message="Cargando detalle del proceso..." />;
  }

  return (
    <div>
      <PageHeader
        title="Ver Proceso"
        description={
          needsValidatorAssignment
            ? `${detail.processName} — Asigne el validador disciplinar antes de cargar el syllabus`
            : canUpload
              ? `${detail.processName} — Carga el syllabus para pasar el proceso al autor`
              : canConfirmClassroom
                ? `${detail.processName} — Confirma el cargue en el aula para finalizar`
                : detail.processName
        }
        backTo={backTo}
        compact
        badge={
          needsValidatorAssignment
            ? "Validador pendiente"
            : canUpload
              ? "Syllabus pendiente"
              : canConfirmClassroom
                ? PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM
                : undefined
        }
        actions={
          <>
            {needsValidatorAssignment && processId && (
              <Link to={`/virtualization-processes/${processId}/assign-validator`}>
                <Button size="sm">
                  <IoPersonAddOutline size={16} />
                  Asignar validador
                </Button>
              </Link>
            )}
            {canAssignDesigner && processId && (
              <Link to={`/virtualization-processes/${processId}/assign-designer`}>
                <Button size="sm" variant={hasDesigner ? "secondary" : "primary"}>
                  <IoPersonAddOutline size={16} />
                  {hasDesigner ? "Cambiar diseñador" : "Asignar diseñador"}
                </Button>
              </Link>
            )}
            {canUpload && processId && (
              syllabusUploadLocked ? (
                <Button
                  size="sm"
                  disabled
                  title={OPERATION_COPY.uploadLockedTitle}
                >
                  <IoCloudUploadOutline size={16} />
                  {OPERATION_COPY.uploadLockedLabel}
                </Button>
              ) : (
                <Link to={`/courses/${processId}/upload`}>
                  <Button size="sm">
                    <IoCloudUploadOutline size={16} />
                    Cargar syllabus
                  </Button>
                </Link>
              )
            )}
            {canConfirmClassroom && (
              <Button
                size="sm"
                disabled={submitting}
                onClick={() => setShowClassroomConfirm(true)}
              >
                <IoCheckmarkCircleOutline size={16} />
                Confirmar Cargue en el Aula
              </Button>
            )}
            {canEditProcess && (
              <Link to={`/virtualization-processes/${processId}/edit`}>
                <Button variant="secondary" size="sm">
                  <IoCreateOutline size={16} />
                  Editar proceso
                </Button>
              </Link>
            )}
            {canDeleteProcess && (
              <Button
                variant="danger"
                size="sm"
                disabled={formBusy}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <IoTrashOutline size={16} />
                Eliminar proceso
              </Button>
            )}
          </>
        }
      />

      {isDeleted && (
        <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          <p className="font-semibold text-primary">Proceso eliminado</p>
          <p className="mt-1 text-xs">
            Este proceso ya no está activo. Puede consultarlo, sin modificarlo.
          </p>
        </div>
      )}

      {needsValidatorAssignment && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Asignación de validador disciplinar requerida</p>
          <p className="mt-1 text-xs text-amber-900/80">
            La carga del syllabus requiere la previa asignación del validador
            disciplinar. Utilice la opción «Asignar validador».
          </p>
        </div>
      )}

      {guideBlockedWithoutDesigner && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Asignación de Diseñador DIDE requerida</p>
          <p className="mt-1 text-xs text-amber-900/80">
            La carga del guión instruccional requiere la previa asignación del
            Diseñador DIDE por parte del Coordinador de Diseñadores.
          </p>
        </div>
      )}

      <CourseDetailView
        detail={detail}
        actionsDisabled={submitting}
        canConfirmClassroom={canConfirmClassroom}
        onConfirmClassroomRequest={() => setShowClassroomConfirm(true)}
      />

      <ClassroomConfirmModal
        isOpen={showClassroomConfirm}
        processName={detail.processName}
        onClose={() => setShowClassroomConfirm(false)}
        onConfirm={() => {
          void handleConfirmClassroom();
        }}
        loading={formBusy}
      />

      <DeleteProcessModal
        isOpen={showDeleteConfirm}
        processName={detail.processName}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          void handleDeleteProcess();
        }}
      />
    </div>
  );
};

export default ViewProcess;
