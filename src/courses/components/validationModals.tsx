import { useEffect, useState } from "react";
import {
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
  validateDescription,
  validateFiles,
} from "../../global/utils/inputValidation";

interface ValidationModalsProps {
  showApprove: boolean;
  showReturn: boolean;
  materialName?: string;
  /** Categoría / entregable del material en revisión. */
  deliverableLabel?: string;
  /**
   * Diseñador DIDE: pide observaciones en texto plano (enlaces u otros datos).
   */
  approveMode?: "designer";
  onCloseApprove: () => void;
  onCloseReturn: () => void;
  onConfirmApprove: (files: File[], observations: string) => void;
  onConfirmReturn: (comments: string, files: File[]) => void;
  loading?: boolean;
}

function ValidationModals({
  showApprove,
  showReturn,
  materialName,
  deliverableLabel,
  approveMode,
  onCloseApprove,
  onCloseReturn,
  onConfirmApprove,
  onConfirmReturn,
  loading = false,
}: ValidationModalsProps) {
  const [comments, setComments] = useState("");
  const [returnFiles, setReturnFiles] = useState<File[]>([]);
  const [approveObservations, setApproveObservations] = useState("");

  const requireObservations = approveMode === "designer";

  const commentsCheck = validateDescription(comments, {
    required: true,
    label: "Los comentarios",
  });
  const returnFilesCheck = validateFiles(returnFiles);
  const returnIsValid = commentsCheck.ok && returnFilesCheck.ok;

  const observationsCheck = validateDescription(approveObservations, {
    required: requireObservations,
    label: "Las observaciones",
    allowUrls: true,
  });
  const approveIsValid = !requireObservations || observationsCheck.ok;

  useEffect(() => {
    if (!showReturn) {
      setComments("");
      setReturnFiles([]);
    }
  }, [showReturn]);

  useEffect(() => {
    if (!showApprove) {
      setApproveObservations("");
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
    setApproveObservations("");
    onCloseApprove();
  };

  const handleConfirmReturn = () => {
    if (!returnIsValid || loading) return;
    onConfirmReturn(commentsCheck.value, returnFilesCheck.files);
  };

  const handleConfirmApprove = () => {
    if (!approveIsValid || loading) return;
    if (requireObservations) {
      if (!observationsCheck.ok) return;
      onConfirmApprove([], observationsCheck.value);
      return;
    }
    onConfirmApprove([], "");
  };

  const isDesignerLoad = approveMode === "designer";
  const approveTitle = isDesignerLoad ? "Confirmar cargue" : "Confirmar aprobación";
  const approveBusyMessage = isDesignerLoad
    ? "Registrando enlaces..."
    : "Aprobando...";
  const approveConfirmLabel = isDesignerLoad ? "Confirmar" : "Aprobar";
  const subject =
    deliverableLabel?.trim() || materialName?.trim() || "este material";
  const approvePrompt = isDesignerLoad
    ? `¿Desea confirmar el cargue de «${subject}»?`
    : `¿Desea aprobar «${subject}»?`;
  const approveHint = isDesignerLoad
    ? "Puede registrar varios enlaces: uno por línea, con un texto descriptivo opcional delante de cada URL."
    : "Al confirmar, el material avanzará a la siguiente fase.";

  return (
    <>
      <Modal
        isOpen={showApprove}
        onClose={handleCloseApprove}
        title={approveTitle}
        icon={<IoCheckmarkCircleOutline size={20} />}
        size={requireObservations ? "lg" : "md"}
        preventClose={loading}
      >
        <FormBusyOverlay busy={loading} message={approveBusyMessage}>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">{approvePrompt}</p>
              <p className="text-xs text-muted">{approveHint}</p>
            </div>

            {requireObservations && (
              <FormField
                label="Enlaces / observaciones"
                required
                error={
                  approveObservations.trim()
                    ? observationsCheck.message
                    : undefined
                }
              >
                <TextArea
                  value={approveObservations}
                  onChange={setApproveObservations}
                  placeholder={
                    "Video guía 1 https://...\nVideo sesión 2 https://..."
                  }
                  rows={5}
                  maxLength={FIELD_LIMITS.description}
                  invalid={Boolean(
                    approveObservations.trim() && !observationsCheck.ok,
                  )}
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
              {approveConfirmLabel}
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
        <FormBusyOverlay busy={loading} message="Devolviendo...">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                ¿Desea devolver «{subject}»?
              </p>
              <p className="text-xs text-muted">
                Indique los comentarios para el autor. Puede adjuntar archivos.
              </p>
            </div>

            <FormField
              label="Comentarios"
              required
              error={comments.trim() ? commentsCheck.message : undefined}
            >
              <TextArea
                value={comments}
                onChange={setComments}
                placeholder="Observaciones para el autor..."
                rows={4}
                maxLength={FIELD_LIMITS.description}
                invalid={Boolean(comments.trim() && !commentsCheck.ok)}
                disabled={loading}
              />
            </FormField>

            <FormField
              label="Archivos (opcional)"
              error={
                returnFiles.length > 0 ? returnFilesCheck.message : undefined
              }
            >
              <FileUpload
                files={returnFiles}
                onChange={setReturnFiles}
                multiple
                disabled={loading}
              />
            </FormField>
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
              Devolver
            </Button>
          </div>
        </FormBusyOverlay>
      </Modal>
    </>
  );
}

export default ValidationModals;
