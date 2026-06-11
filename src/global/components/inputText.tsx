import React from "react";
import { Input } from "@headlessui/react";

interface InputTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const InputText = ({ value, onChange, placeholder }: InputTextProps) => {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
};

export default InputText;
