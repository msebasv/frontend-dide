import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

import Modal from "./modal";
import Select from "./select";
import Button from "./button";
import { FaExchangeAlt } from "react-icons/fa";
import { formatDomainLabel } from "../utils/textUtils";

const ChangeRoleModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { roles, currentRole, setCurrentRole } = useAuth();

  const roleOptions = roles.map((role) => ({
    label: formatDomainLabel(role),
    value: role,
  }));

  const [selectedRole, setSelectedRole] = useState<{
    label: string;
    value: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedRole(
      currentRole
        ? {
            label: formatDomainLabel(currentRole),
            value: currentRole,
          }
        : null,
    );
  }, [isOpen, currentRole, roles]);

  const handleAccept = () => {
    if (selectedRole) {
      const roleChanged = selectedRole.value !== currentRole;
      setCurrentRole(selectedRole.value);
      onClose();
      if (roleChanged) {
        navigate("/", { replace: true });
      }
      return;
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
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
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
