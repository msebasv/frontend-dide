import { useEffect, useState } from "react";
import {
  IoWarningOutline,
  IoCheckmarkCircleOutline,
  IoReturnDownBackOutline,
} from "react-icons/io5";

import Modal from "../../global/components/modal";
import Button from "../../global/components/button";
import TextArea from "../../global/components/textArea";
import FileUpload from "../../global/components/fileUpload";
import FormField from "../../global/components/formField";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import {
  FIELD_LIMITS,
  WORD_FILE_EXTENSIONS,
  WORD_FILE_TYPES,
  validateDescription,
  validateFiles,
} from "../../global/utils/inputValidation";

interface ValidationModalsProps {
  showApprove: boolean;
  showReturn: boolean;
  materialName?: string;
  /**
   * Exige Word al aprobar:
   * - advisor: guía instruccional → Confirmación DIDE
   * - designer: documento de aprobación → cierra el proceso
   */
  instructionalGuideFor?: "advisor" | "designer";
  onCloseApprove: () => void;
  onCloseReturn: () => void;
  onConfirmApprove: (files: File[]) => void;
  onConfirmReturn: (comments: string, files: File[]) => void;
  loading?: boolean;
}

function ValidationModals({
  showApprove,
  showReturn,
  materialName,
  instructionalGuideFor,
  onCloseApprove,
  onCloseReturn,
  onConfirmApprove,
  onConfirmReturn,
  loading = false,
}: ValidationModalsProps) {
  const [comments, setComments] = useState("");
  const [returnFiles, setReturnFiles] = useState<File[]>([]);
  const [approveFiles, setApproveFiles] = useState<File[]>([]);

  const requireWordGuide = Boolean(instructionalGuideFor);

  const commentsCheck = validateDescription(comments, {
    required: true,
    label: "Los comentarios",
  });
  const returnFilesCheck = validateFiles(returnFiles);
  const returnIsValid = commentsCheck.ok && returnFilesCheck.ok;

  const approveFilesCheck = validateFiles(approveFiles, {
    required: requireWordGuide,
    maxFiles: 1,
    allowedExtensions: WORD_FILE_EXTENSIONS,
  });
  const approveIsValid = !requireWordGuide || approveFilesCheck.ok;

  const approveDescription =
    instructionalGuideFor === "designer"
      ? "Adjunta el documento Word. Al confirmar, el proceso avanzará al Asesor pedagógico."
      : instructionalGuideFor === "advisor"
        ? "Adjunta la guía instruccional en Word. Al confirmar, el proceso quedará finalizado."
        : "El proceso avanzará a la siguiente fase y el autor recibirá la confirmación de tu validación.";

  const guideFieldLabel =
    instructionalGuideFor === "designer"
      ? "Documento de aprobación"
      : "Guía instruccional";

  const guideFieldHint =
    instructionalGuideFor === "designer"
      ? "Documento Word (.doc o .docx) para la revisión del Asesor pedagógico."
      : "Documento Word (.doc o .docx) con la guía instruccional. Esta aprobación cierra el proceso.";

  useEffect(() => {
    if (!showReturn) {
      setComments("");
      setReturnFiles([]);
    }
  }, [showReturn]);

  useEffect(() => {
    if (!showApprove) {
      setApproveFiles([]);
    }
  }, [showApprove]);

  const handleCloseReturn = () => {
    if (loading) return;
    setComments("");
    setReturnFiles([]);
    onCloseReturn();
  };

  const handleCloseApprove = () => {
    if (loading) return;
    setApproveFiles([]);
    onCloseApprove();
  };

  const handleConfirmReturn = () => {
    if (!returnIsValid || loading) return;
    onConfirmReturn(commentsCheck.value, returnFilesCheck.files);
  };

  const handleConfirmApprove = () => {
    if (!approveIsValid || loading) return;
    onConfirmApprove(approveFilesCheck.files);
  };

  const materialLabel = materialName ? `"${materialName}"` : "este material";

  return (
    <>
      <Modal
        isOpen={showApprove}
        onClose={handleCloseApprove}
        title="Confirmar aprobación"
        icon={<IoCheckmarkCircleOutline size={20} />}
        size={requireWordGuide ? "lg" : "md"}
        preventClose={loading}
      >
        <FormBusyOverlay busy={loading} message="Aprobando material...">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Confirmas la aprobación de {materialLabel}?
            </p>
            <p className="text-sm text-gray-600">{approveDescription}</p>

            {requireWordGuide && (
              <FormField
                label={guideFieldLabel}
                required
                error={
                  approveFiles.length > 0
                    ? approveFilesCheck.message
                    : undefined
                }
                hint={guideFieldHint}
              >
                <FileUpload
                  files={approveFiles}
                  onChange={setApproveFiles}
                  multiple={false}
                  accept={WORD_FILE_TYPES}
                  required
                  maxFiles={1}
                  allowedExtensions={WORD_FILE_EXTENSIONS}
                  helperText="Word (.doc, .docx) · máx. 25 MB"
                  disabled={loading}
                />
              </FormField>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              variant="secondary"
              onClick={handleCloseApprove}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={loading || !approveIsValid}
            >
              Confirmar aprobación
            </Button>
          </div>
        </FormBusyOverlay>
      </Modal>

      <Modal
        isOpen={showReturn}
        onClose={handleCloseReturn}
        title="Devolver material"
        icon={<IoReturnDownBackOutline size={20} />}
        size="lg"
        preventClose={loading}
      >
        <FormBusyOverlay busy={loading} message="Devolviendo material...">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Indica las observaciones para devolver {materialLabel}. Puedes
              adjuntar archivos con las correcciones sugeridas para el autor.
            </p>

            <FormField
              label="Comentarios de devolución"
              required
              error={comments.trim() ? commentsCheck.message : undefined}
              hint="Letras, tildes, números, guiones, comillas y puntuación habitual."
            >
              <TextArea
                value={comments}
                onChange={setComments}
                placeholder="Describe qué debe corregir el autor antes de volver a enviar el material..."
                rows={5}
                maxLength={FIELD_LIMITS.description}
                invalid={Boolean(comments.trim() && !commentsCheck.ok)}
                disabled={loading}
              />
            </FormField>

            <FormField
              label="Archivos de corrección"
              hint="Opcional. Sube guías, ejemplos o documentos con las correcciones."
            >
              <FileUpload
                files={returnFiles}
                onChange={setReturnFiles}
                disabled={loading}
              />
            </FormField>

            <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
              <IoWarningOutline className="mr-1 inline" size={14} />
              Al devolver el material, el autor podrá revisar tus comentarios y
              cargar una nueva versión.
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              variant="secondary"
              onClick={handleCloseReturn}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmReturn}
              disabled={loading || !returnIsValid}
            >
              Confirmar devolución
            </Button>
          </div>
        </FormBusyOverlay>
      </Modal>
    </>
  );
}

export default ValidationModals;
