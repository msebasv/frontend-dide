import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import {
  IoTimeOutline,
  IoCheckmarkCircle,
  IoCloudUploadOutline,
  IoReturnDownBackOutline,
} from "react-icons/io5";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";
import FeedbackModal from "../../global/components/feedbackModal";

import { useAuth } from "../../global/hooks/useAuth";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useCourseDetail } from "../hooks/useCourseDetail";
import CourseDetailView from "../components/courseDetailView";
import ValidationModals from "../components/validationModals";
import {
  approveCourseMaterial,
  returnCourseMaterial,
} from "../services/courseService";
import {
  canUserFinalizeStatus,
  canUserUploadStatus,
  canUserValidateStatus,
  isAdvisorRole,
  isDideDesignerRole,
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

  const canValidate = useMemo(
    () =>
      detail ? canUserValidateStatus(currentRole, detail.status) : false,
    [currentRole, detail],
  );

  const canFinalize = useMemo(
    () =>
      detail ? canUserFinalizeStatus(currentRole, detail.status) : false,
    [currentRole, detail],
  );

  const canUpload = useMemo(
    () => (detail ? canUserUploadStatus(currentRole, detail.status) : false),
    [currentRole, detail],
  );

  const selectedMaterial =
    detail?.materials.find(
      (material) => material.activityId === selectedActivityId,
    ) ?? null;

  const handleApproveRequest = () => {
    if (!selectedMaterial) return;
    setMaterialToValidate(selectedMaterial);
    setShowApprove(true);
  };

  const handleReturnRequest = () => {
    if (!selectedMaterial) return;
    setMaterialToValidate(selectedMaterial);
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
            files,
          }),
        {
          successTitle: "Material aprobado",
          successMessage,
          errorTitle: "No se pudo aprobar el material",
          onSuccess: () => {
            setShowApprove(false);
            setMaterialToValidate(null);
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
            setMaterialToValidate(null);
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
          canValidate
            ? `${detail.courseName} — Revisa el material y emite tu calificación`
            : canFinalize
              ? `${detail.courseName} — Revisa el material y aprueba el proceso`
              : canUpload
                ? `${detail.courseName} — Puedes cargar el material académico de este proceso`
                : detail.courseName
        }
        backTo="/my-courses"
        badge={
          canValidate
            ? "Validación pendiente"
            : canFinalize
              ? "Aprobación pendiente"
              : canUpload
                ? "Carga pendiente"
                : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canValidate && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleReturnRequest}
                  disabled={!selectedMaterial || submitting}
                >
                  <IoReturnDownBackOutline size={16} />
                  Devolver
                </Button>
                <Button
                  size="sm"
                  onClick={handleApproveRequest}
                  disabled={!selectedMaterial || submitting}
                >
                  <IoCheckmarkCircle size={16} />
                  Aprobar
                </Button>
              </>
            )}
            {canFinalize && (
              <Button
                size="sm"
                onClick={handleApproveRequest}
                disabled={!selectedMaterial || submitting}
              >
                <IoCheckmarkCircle size={16} />
                Aprobar
              </Button>
            )}
            {canUpload && processId && (
              <Link to={`/courses/${processId}/upload`}>
                <Button size="sm">
                  <IoCloudUploadOutline size={16} />
                  Cargar material
                </Button>
              </Link>
            )}
            <Link to={`/history/${processId}`}>
              <Button variant="secondary" size="sm">
                <IoTimeOutline size={16} />
                Ver historial
              </Button>
            </Link>
          </div>
        }
      />

      {(canValidate || canFinalize) && selectedMaterial && (
        <p className="-mt-4 mb-6 text-xs text-muted">
          Material en revisión:{" "}
          <span className="font-medium text-primary">{selectedMaterial.name}</span>
        </p>
      )}

      <CourseDetailView
        detail={detail}
        isValidationMode={canValidate || canFinalize}
        selectedMaterialId={selectedActivityId}
        onSelectedMaterialChange={setSelectedActivityId}
        historyLink={`/history/${processId}`}
      />

      <ValidationModals
        showApprove={showApprove}
        showReturn={showReturn}
        materialName={materialToValidate?.name}
        instructionalGuideFor={
          isDideDesignerRole(currentRole)
            ? "designer"
            : isAdvisorRole(currentRole)
              ? "advisor"
              : undefined
        }
        onCloseApprove={() => {
          setShowApprove(false);
          setMaterialToValidate(null);
        }}
        onCloseReturn={() => {
          setShowReturn(false);
          setMaterialToValidate(null);
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
