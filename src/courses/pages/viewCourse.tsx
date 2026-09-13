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
import {
  approveCourseMaterial,
  returnCourseMaterial,
} from "../services/courseService";
import {
  canUserFinalizeStatus,
  canUserValidateStatus,
  isAdvisorRole,
  isDideDesignerRole,
  isValidatorRole,
} from "../mappers/courseMappers";
import type { CourseMaterial } from "../types/course.types";

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
  const [showApprove, setShowApprove] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
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

  const isValidationUserRole =
    isValidatorRole(currentRole) ||
    isAdvisorRole(currentRole) ||
    isDideDesignerRole(currentRole);

  const canValidate = useMemo(
    () =>
      isValidationUserRole ||
      (detail ? canUserValidateStatus(currentRole, detail.status) : false),
    [isValidationUserRole, currentRole, detail],
  );

  const canFinalize = useMemo(
    () =>
      isDideDesignerRole(currentRole) ||
      (detail ? canUserFinalizeStatus(currentRole, detail.status) : false),
    [currentRole, detail],
  );

  const clearValidationTarget = () => {
    setMaterialToValidate(null);
    setDeliverableLabel(undefined);
  };

  const handleApproveRequest = (context: MaterialValidationContext) => {
    setSelectedActivityId(context.material.activityId);
    setMaterialToValidate(context.material);
    setDeliverableLabel(context.deliverableName);
    setShowApprove(true);
  };

  const handleReturnRequest = (context: MaterialValidationContext) => {
    setSelectedActivityId(context.material.activityId);
    setMaterialToValidate(context.material);
    setDeliverableLabel(context.deliverableName);
    setShowReturn(true);
  };

  const handleApprove = async (files: File[]) => {
    if (!processId || !materialToValidate) return;

    const successMessage = isDideDesignerRole(currentRole)
      ? "El documento se registró correctamente y el proceso avanzará al Asesor pedagógico."
      : isAdvisorRole(currentRole)
        ? "La guía instruccional se registró correctamente y el proceso quedó finalizado."
        : "La validación se registró correctamente y el proceso avanzará a la siguiente fase.";

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
          }),
        {
          successTitle: "Material aprobado",
          successMessage,
          errorTitle: "No se pudo aprobar el material",
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
          }),
        {
          successTitle: "Material devuelto",
          successMessage:
            "La devolución se registró correctamente. El autor recibirá tus comentarios y podrá cargar las correcciones.",
          errorTitle: "No se pudo devolver el material",
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

  if (loading || !detail) {
    return <LoadingState message="Cargando detalle del curso..." />;
  }

  return (
    <div>
      <PageHeader
        title="Ver Curso"
        description={
          detail.programName
            ? `${detail.courseName} · ${detail.programName}`
            : detail.courseName
        }
        backTo="/my-courses"
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
      />

      <ValidationModals
        showApprove={showApprove}
        showReturn={showReturn}
        materialName={materialToValidate?.name}
        deliverableLabel={deliverableLabel}
        instructionalGuideFor={
          isDideDesignerRole(currentRole)
            ? "designer"
            : isAdvisorRole(currentRole)
              ? "advisor"
              : undefined
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
