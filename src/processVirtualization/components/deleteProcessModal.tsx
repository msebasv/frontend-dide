/**
 * Confirmación para eliminar un proceso de virtualización.
 */
import { IoTrashOutline } from "react-icons/io5";

import Modal from "../../global/components/modal";
import Button from "../../global/components/button";

interface DeleteProcessModalProps {
  isOpen: boolean;
  processName?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

function DeleteProcessModal({
  isOpen,
  processName,
  onClose,
  onConfirm,
  loading = false,
}: DeleteProcessModalProps) {
  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Eliminar proceso"
      icon={<IoTrashOutline size={20} />}
      size="md"
      preventClose={loading}
    >
      <div className="space-y-1">
        <p className="text-sm text-gray-600">
          {processName
            ? `¿Desea eliminar el proceso «${processName}»?`
            : "¿Desea eliminar este proceso?"}
        </p>
        <p className="text-xs text-muted">
          Dejará de aparecer en los listados, el seguimiento y las estadísticas.
        </p>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          Eliminar
        </Button>
      </div>
    </Modal>
  );
}

export default DeleteProcessModal;
