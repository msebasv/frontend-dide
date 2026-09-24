/**
 * Modal de confirmación del cargue en el aula (líder de virtualización).
 */
import { IoCheckmarkCircleOutline } from "react-icons/io5";

import Modal from "../../global/components/modal";
import Button from "../../global/components/button";
import FormBusyOverlay from "../../global/components/formBusyOverlay";

interface ClassroomConfirmModalProps {
  isOpen: boolean;
  processName?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

function ClassroomConfirmModal({
  isOpen,
  processName,
  onClose,
  onConfirm,
  loading = false,
}: ClassroomConfirmModalProps) {
  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirmar cargue en el aula"
      icon={<IoCheckmarkCircleOutline size={20} />}
      size="md"
      preventClose={loading}
    >
      <FormBusyOverlay busy={loading} message="Confirmando...">
        <div className="space-y-1">
          <p className="text-sm text-gray-600">
            {processName
              ? `¿Desea confirmar el cargue en el aula de «${processName}»?`
              : "¿Desea confirmar el cargue en el aula?"}
          </p>
          <p className="text-xs text-muted">
            Al confirmar, el proceso quedará finalizado.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            Confirmar
          </Button>
        </div>
      </FormBusyOverlay>
    </Modal>
  );
}

export default ClassroomConfirmModal;
