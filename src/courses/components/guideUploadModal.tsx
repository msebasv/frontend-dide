/**
 * Modal para que el asesor cargue el guión instruccional (Word)
 * en la fase "Cargar Guión instruccional".
 */
import { useEffect, useState } from "react";
import { IoCloudUploadOutline } from "react-icons/io5";

import Modal from "../../global/components/modal";
import Button from "../../global/components/button";
import FileUpload from "../../global/components/fileUpload";
import FormField from "../../global/components/formField";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import {
  GUIDE_FILE_EXTENSIONS,
  GUIDE_FILE_TYPES,
  validateFiles,
} from "../../global/utils/inputValidation";

interface GuideUploadModalProps {
  isOpen: boolean;
  deliverableLabel?: string;
  onClose: () => void;
  onConfirm: (file: File) => void;
  loading?: boolean;
}

function GuideUploadModal({
  isOpen,
  deliverableLabel,
  onClose,
  onConfirm,
  loading = false,
}: GuideUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);

  const filesCheck = validateFiles(files, {
    required: true,
    maxFiles: 1,
    allowedExtensions: GUIDE_FILE_EXTENSIONS,
  });
  const isValid = filesCheck.ok;

  useEffect(() => {
    if (!isOpen) setFiles([]);
  }, [isOpen]);

  const handleClose = () => {
    if (loading) return;
    setFiles([]);
    onClose();
  };

  const handleConfirm = () => {
    if (!isValid || loading) return;
    const file = filesCheck.files[0];
    if (!file) return;
    onConfirm(file);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cargar guión instruccional"
      icon={<IoCloudUploadOutline size={20} />}
      size="lg"
      preventClose={loading}
    >
      <FormBusyOverlay busy={loading} message="Cargando...">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              {deliverableLabel
                ? `Cargar guión instruccional para «${deliverableLabel}».`
                : "Cargar guión instruccional."}
            </p>
            <p className="text-xs text-muted">
              Adjunte un documento Word (.doc, .docx) o PDF.
            </p>
          </div>

          <FormField
            label="Archivo"
            required
            error={files.length > 0 ? filesCheck.message : undefined}
          >
            <FileUpload
              files={files}
              onChange={setFiles}
              multiple={false}
              accept={GUIDE_FILE_TYPES}
              required
              maxFiles={1}
              allowedExtensions={GUIDE_FILE_EXTENSIONS}
              helperText="Word o PDF"
              disabled={loading}
            />
          </FormField>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !isValid}>
            Cargar
          </Button>
        </div>
      </FormBusyOverlay>
    </Modal>
  );
}

export default GuideUploadModal;
