import { useState } from "react";

import { useAuth } from "../hooks/useAuth";

import Modal from "./modal";
import Select from "./select";
import Button from "./button";
import { FaExchangeAlt } from "react-icons/fa";

const ChangeRoleModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { roles, currentRole, setCurrentRole } = useAuth();

  const roleOptions = roles.map((role) => ({
    label: role,
    value: role,
  }));

  const [selectedRole, setSelectedRole] = useState<{
    label: string;
    value: string;
  } | null>(
    currentRole
      ? {
          label: currentRole,
          value: currentRole,
        }
      : null,
  );

  const handleAccept = () => {
    if (selectedRole) {
      setCurrentRole(selectedRole.value);
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar Rol"
      icon={<FaExchangeAlt className="size-3 fill-white" />}
    >
      <Select
        options={roleOptions}
        value={selectedRole}
        onChange={setSelectedRole}
        placeholder="Selecciona un rol"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose} variant="secondary">
          Cancelar
        </Button>

        <Button onClick={handleAccept} variant="primary">
          Aceptar
        </Button>
      </div>
    </Modal>
  );
};

export default ChangeRoleModal;
