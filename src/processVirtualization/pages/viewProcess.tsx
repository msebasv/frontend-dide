import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoCreateOutline,
  IoPersonAddOutline,
} from "react-icons/io5";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";
import FeedbackModal from "../../global/components/feedbackModal";

import { useAuth } from "../../global/hooks/useAuth";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
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
  isCoordinatorRole,
  isLeaderRole,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";

const ViewProcess = () => {
  const { processId } = useParams<{ processId: string }>();
  const { currentRole } = useAuth();
  const { detail, loading, loadDetail } = useCourseDetail();
  const { feedback, closeFeedback, runAction } = useActionFeedback();
  const [showClassroomConfirm, setShowClassroomConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (processId) void loadDetail(processId);
  }, [processId, loadDetail]);

  const isFinalized = detail?.status === PROCESS_PHASES.COMPLETED;

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
    !isFinalized && isSyllabusPhase && !hasValidator;

  /** Bloqueo del asesor: fase de guión sin diseñador. */
  const guideBlockedWithoutDesigner = useMemo(() => {
    if (isFinalized || !detail || hasDesigner) return false;
    if (isAdvisorGuideUploadStatus(detail.status)) return true;
    return detail.materials.some((material) =>
      isAdvisorGuideUploadStatus(material.status),
    );
  }, [detail, hasDesigner, isFinalized]);

  const canUpload = useMemo(() => {
    if (isFinalized || !detail || needsValidatorAssignment) return false;
    if (canUserUploadStatus(currentRole, detail.status)) return true;
    return (
      canCreateOrEditProcesses(currentRole) &&
      isLeaderRole(currentRole) &&
      isSyllabusPhase
    );
  }, [
    currentRole,
    detail,
    needsValidatorAssignment,
    isSyllabusPhase,
    isFinalized,
  ]);

  const canConfirmClassroom = useMemo(() => {
    if (isFinalized || !detail) return false;
    return canUserConfirmClassroomStatus(currentRole, detail.status);
  }, [currentRole, detail, isFinalized]);

  const canEditProcess =
    !isFinalized && canCreateOrEditProcesses(currentRole);
  const canAssignDesigner =
    !isFinalized && canAssignDideDesigner(currentRole);
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
        onSuccess: () => setShowClassroomConfirm(false),
        onSuccessClose: () => {
          void loadDetail(processId);
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
              <Link to={`/courses/${processId}/upload`}>
                <Button size="sm">
                  <IoCloudUploadOutline size={16} />
                  Cargar syllabus
                </Button>
              </Link>
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
          </>
        }
      />

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
        loading={submitting}
      />

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
};

export default ViewProcess;
