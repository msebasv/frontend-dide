import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}
const Modal = ({ isOpen, title, icon, children }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-500/50">
      <div className="bg-white rounded-lg shadow-lg w-96 p-6">
        <div className="w-full flex items-center gap-4 mb-4 text-center">
          <div className="rounded-lg bg-gray-800 px-2 py-2 font-normaltext-white shadow-inner">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-primary">{title}</h2>
        </div>
        <div className="w-full my-3 h-px bg-gray-400/50" />
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
