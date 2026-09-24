import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import FeedbackModal from "../../global/components/feedbackModal";

import { useAuth } from "../../global/hooks/useAuth";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useCourseDetail } from "../hooks/useCourseDetail";
import CourseDetailView, {
  type MaterialValidationContext,
} from "../components/courseDetailView";
import ValidationModals from "../components/validationModals";
import GuideUploadModal from "../components/guideUploadModal";
import {
  approveCourseMaterial,
  confirmClassroomUpload,
  returnCourseMaterial,
  uploadCourseMaterial,
} from "../services/courseService";
import {
  canUserConfirmClassroomStatus,
  canUserFinalizeStatus,
  canUserValidateStatus,
  hasAssignedDideDesigner,
  isAdvisorGuideUploadStatus,
  isAdvisorRole,
  isDideDesignerRole,
  isValidatorRole,
} from "../mappers/courseMappers";
import type { CourseMaterial } from "../types/course.types";
import ClassroomConfirmModal from "../components/classroomConfirmModal";
import { PROCESS_PHASES } from "../../global/constants/domainConstants";

const ViewCourse = () => {
  const { processId } = useParams<{ processId: string }>();
  const location = useLocation();
  const { currentRole } = useAuth();
  const { detail, loading, loadDetail } = useCourseDetail();
  const { feedback, closeFeedback, runAction } = useActionFeedback();

  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [materialToValidate, setMaterialToValidate] =
    useState<CourseMaterial | null>(null);
  const [deliverableLabel, setDeliverableLabel] = useState<string | undefined>();
  const [deliverableStateLabel, setDeliverableStateLabel] = useState<
    string | undefined
  >();
  const [showApprove, setShowApprove] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showGuideUpload, setShowGuideUpload] = useState(false);
  const [guideDeliverableId, setGuideDeliverableId] = useState("");
  const [guideDeliverableLabel, setGuideDeliverableLabel] = useState("");
  const [showClassroomConfirm, setShowClassroomConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (processId) void loadDetail(processId);
  }, [processId, loadDetail, location.key]);

  useEffect(() => {
    if (!detail?.materials.length) {
      setSelectedActivityId("");
      return;
    }

    setSelectedActivityId((current) => {
      if (current && detail.materials.some((m) => m.activityId === current)) {
        return current;
      }

      return (
        detail.materials.find((item) => item.isAuthorUpload)?.activityId ??
        detail.materials[0]?.activityId ??
        ""
      );
    });
  }, [detail]);

  const isFinalized = detail?.status === PROCESS_PHASES.COMPLETED;

  const isValidationUserRole =
    isValidatorRole(currentRole) ||
    isAdvisorRole(currentRole) ||
    isDideDesignerRole(currentRole);

  const guideBlockedWithoutDesigner = useMemo(() => {
    if (isFinalized || !detail || !isAdvisorRole(currentRole)) return false;
    if (hasAssignedDideDesigner(detail.assignedRoles)) return false;
    if (isAdvisorGuideUploadStatus(detail.status)) return true;
    return detail.materials.some((material) =>
      isAdvisorGuideUploadStatus(material.status),
    );
  }, [detail, currentRole, isFinalized]);

  const canValidate = useMemo(
    () =>
      !isFinalized &&
      (isValidationUserRole ||
        (detail ? canUserValidateStatus(currentRole, detail.status) : false)),
    [isValidationUserRole, currentRole, detail, isFinalized],
  );

  const canFinalize = useMemo(
    () =>
      !isFinalized &&
      (isDideDesignerRole(currentRole) ||
        (detail ? canUserFinalizeStatus(currentRole, detail.status) : false)),
    [currentRole, detail, isFinalized],
  );

  const canConfirmClassroom = useMemo(
    () =>
      !isFinalized &&
      (detail
        ? canUserConfirmClassroomStatus(currentRole, detail.status)
        : false),
    [currentRole, detail, isFinalized],
  );

  const clearValidationTarget = () => {
    setMaterialToValidate(null);
    setDeliverableLabel(undefined);
    setDeliverableStateLabel(undefined);
  };

  const clearGuideTarget = () => {
    setGuideDeliverableId("");
    setGuideDeliverableLabel("");
  };

  const handleApproveRequest = (context: MaterialValidationContext) => {
    setSelectedActivityId(context.material.activityId);
    setMaterialToValidate(context.material);
    setDeliverableLabel(context.deliverableName);
    setDeliverableStateLabel(context.deliverableStateLabel);
    setShowApprove(true);
  };

  const handleReturnRequest = (context: MaterialValidationContext) => {
    setSelectedActivityId(context.material.activityId);
    setMaterialToValidate(context.material);
    setDeliverableLabel(context.deliverableName);
    setDeliverableStateLabel(context.deliverableStateLabel);
    setShowReturn(true);
  };

  const handleGuideUploadRequest = (context: {
    deliverableId: string;
    deliverableName: string;
  }) => {
    setGuideDeliverableId(context.deliverableId);
    setGuideDeliverableLabel(context.deliverableName);
    setShowGuideUpload(true);
  };

  const handleApprove = async (files: File[], observations: string) => {
    if (!processId || !materialToValidate) return;

    const successTitle = isDideDesignerRole(currentRole)
      ? "Cargue registrado"
      : "Material aprobado";

    try {
      setSubmitting(true);
      await runAction(
        () =>
          approveCourseMaterial({
            processId,
            userRole: currentRole,
            activityId: materialToValidate.activityId,
            deliverableId: materialToValidate.deliverableId || undefined,
            files,
            observations,
            currentStatus: deliverableStateLabel,
          }),
        {
          successTitle,
          successMessage: isDideDesignerRole(currentRole)
            ? "Los enlaces quedaron registrados."
            : "La aprobación se registró correctamente.",
          errorTitle: isDideDesignerRole(currentRole)
            ? "No se pudo cargar"
            : "No se pudo aprobar",
          onSuccess: () => {
            setShowApprove(false);
            clearValidationTarget();
          },
          onSuccessClose: () => {
            void loadDetail(processId);
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (comments: string, files: File[]) => {
    if (!processId || !materialToValidate) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          returnCourseMaterial({
            processId,
            userRole: currentRole,
            activityId: materialToValidate.activityId,
            deliverableId: materialToValidate.deliverableId || undefined,
            comments,
            files,
            currentStatus: deliverableStateLabel,
          }),
        {
          successTitle: "Material devuelto",
          successMessage: "La devolución se registró correctamente.",
          errorTitle: "No se pudo devolver",
          onSuccess: () => {
            setShowReturn(false);
            clearValidationTarget();
          },
          onSuccessClose: () => {
            void loadDetail(processId);
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuideUpload = async (file: File) => {
    if (!processId || !guideDeliverableId) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          uploadCourseMaterial({
            activityName: "Guión instruccional",
            description: "",
            processId,
            files: [file],
            deliverableId: guideDeliverableId,
            userRole: currentRole,
          }),
        {
          successTitle: "Guión instruccional cargado",
          successMessage: "El documento se registró correctamente.",
          errorTitle: "No se pudo cargar",
          onSuccess: () => {
            setShowGuideUpload(false);
            clearGuideTarget();
          },
          onSuccessClose: () => {
            void loadDetail(processId);
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

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
    return <LoadingState message="Cargando detalle del curso..." />;
  }

  return (
    <div>
      <PageHeader
        title="Ver Proceso"
        description={detail.processName}
        backTo="/my-courses"
        compact
        badge={
          guideBlockedWithoutDesigner ? "Diseñador pendiente" : undefined
        }
      />

      <CourseDetailView
        detail={detail}
        isValidationMode={canValidate || canFinalize}
        canApprove={canValidate || canFinalize}
        canReturn={canValidate}
        actionsDisabled={submitting}
        selectedMaterialId={selectedActivityId}
        onSelectedMaterialChange={setSelectedActivityId}
        onApproveRequest={handleApproveRequest}
        onReturnRequest={handleReturnRequest}
        onGuideUploadRequest={
          !isFinalized && isAdvisorRole(currentRole)
            ? handleGuideUploadRequest
            : undefined
        }
        canConfirmClassroom={canConfirmClassroom}
        onConfirmClassroomRequest={() => setShowClassroomConfirm(true)}
      />

      <ValidationModals
        showApprove={showApprove}
        showReturn={showReturn}
        materialName={materialToValidate?.name}
        deliverableLabel={deliverableLabel}
        approveMode={
          isDideDesignerRole(currentRole) ? "designer" : undefined
        }
        onCloseApprove={() => {
          setShowApprove(false);
          clearValidationTarget();
        }}
        onCloseReturn={() => {
          setShowReturn(false);
          clearValidationTarget();
        }}
        onConfirmApprove={handleApprove}
        onConfirmReturn={handleReturn}
        loading={submitting}
      />

      <GuideUploadModal
        isOpen={showGuideUpload}
        deliverableLabel={guideDeliverableLabel}
        onClose={() => {
          setShowGuideUpload(false);
          clearGuideTarget();
        }}
        onConfirm={handleGuideUpload}
        loading={submitting}
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

export default ViewCourse;
