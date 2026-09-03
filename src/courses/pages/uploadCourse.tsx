import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import TextArea from "../../global/components/textArea";
import FileUpload from "../../global/components/fileUpload";
import Button from "../../global/components/button";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import InfoCard from "../../global/components/infoCard";
import FeedbackModal from "../../global/components/feedbackModal";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import {
  FIELD_LIMITS,
  validateDescription,
  validateFiles,
  validateTitle,
} from "../../global/utils/inputValidation";

import { useCourseDetail } from "../hooks/useCourseDetail";
import { uploadCourseMaterial } from "../services/courseService";

const UploadCourse = () => {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { detail, loading, loadDetail } = useCourseDetail();
  const { feedback, closeFeedback, runAction } = useActionFeedback();

  const [resourceName, setResourceName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resourceNameCheck = validateTitle(resourceName, {
    label: "El nombre del recurso",
  });
  const descriptionCheck = validateDescription(description, {
    label: "La descripción",
  });
  const filesCheck = validateFiles(files, { required: true });
  const formIsValid =
    resourceNameCheck.ok &&
    descriptionCheck.ok &&
    filesCheck.ok &&
    Boolean(processId);

  useEffect(() => {
    if (processId) void loadDetail(processId);
  }, [processId, loadDetail]);

  const handleSubmit = async () => {
    if (!formIsValid || !processId) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          uploadCourseMaterial({
            activityName: resourceNameCheck.value,
            description: descriptionCheck.value,
            processId,
            files: filesCheck.files,
          }),
        {
          successTitle: "Material cargado",
          successMessage:
            "El recurso académico se cargó correctamente y quedó disponible para revisión.",
          errorTitle: "No se pudo cargar el material",
          errorMessage:
            "Verifica los datos e intenta nuevamente. Si el problema persiste, contacta al administrador.",
          onSuccessClose: () =>
            navigate(`/courses/${processId}`, {
              replace: true,
              state: { fromUpload: true },
            }),
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !detail) {
    return <LoadingState message="Cargando información del curso..." />;
  }

  return (
    <div>
      <PageHeader
        title="Cargar Curso"
        description="Sube el material académico para virtualización"
        backTo="/my-courses"
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <InfoCard
          title="Curso seleccionado"
          items={[
            { label: "Proceso de virtualización", value: detail.processName },
            { label: "Curso", value: detail.courseName },
            { label: "Programa", value: detail.programName },
            { label: "Facultad", value: detail.facultyName },
          ]}
        />

        <FormBusyOverlay
          busy={submitting}
          message="Cargando material..."
          className="w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-border bg-gradient-to-r from-secondary/5 to-transparent px-6 py-4 sm:px-8">
            <h2 className="text-base font-semibold text-primary">
              Formulario de carga
            </h2>
          </div>

          <div className="space-y-5 p-4 sm:p-6 md:p-8">
            <FormField
              label="Nombre del recurso"
              required
              error={
                resourceName.trim() ? resourceNameCheck.message : undefined
              }
              hint="Nombre del material (ej. Syllabus, Guía de estudio). Solo letras, tildes, números y guiones."
            >
              <InputText
                value={resourceName}
                onChange={setResourceName}
                placeholder="Nombre del recurso"
                maxLength={FIELD_LIMITS.title}
                invalid={Boolean(resourceName.trim() && !resourceNameCheck.ok)}
                disabled={submitting}
              />
            </FormField>

            <FormField
              label="Descripción del recurso"
              error={description.trim() ? descriptionCheck.message : undefined}
              hint="Describe brevemente el contenido. Se permiten letras, números, guiones, comillas y puntuación habitual."
            >
              <TextArea
                value={description}
                onChange={setDescription}
                placeholder="Descripción (opcional)"
                maxLength={FIELD_LIMITS.description}
                invalid={Boolean(description.trim() && !descriptionCheck.ok)}
                disabled={submitting}
              />
            </FormField>

            <FormField
              label="Archivos"
              required
              hint="Puedes adjuntar uno o varios archivos en la misma entrega."
            >
              <FileUpload
                files={files}
                onChange={setFiles}
                required
                disabled={submitting}
              />
            </FormField>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
              <Button
                variant="secondary"
                onClick={() => navigate("/my-courses")}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !formIsValid}
              >
                Cargar material
              </Button>
            </div>
          </div>
        </FormBusyOverlay>
      </div>

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

export default UploadCourse;
