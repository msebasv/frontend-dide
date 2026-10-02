import { Input } from "@headlessui/react";
import clsx from "clsx";

interface InputTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  invalid?: boolean;
}

const InputText = ({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  maxLength,
  min,
  max,
  step,
  invalid = false,
}: InputTextProps) => {
  return (
    <Input
      type={type}
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      min={min}
      max={max}
      step={step}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(
        "w-full rounded-full border bg-white px-4 py-2.5 text-base text-primary sm:py-2.5 sm:text-sm",
        "focus:outline-none focus:ring-2",
        "disabled:cursor-not-allowed disabled:bg-acacia-5 disabled:text-muted",
        invalid
          ? "border-danger focus:ring-danger/40"
          : "border-border focus:border-secondary/50 focus:ring-secondary/25",
      )}
    />
  );
};

export default InputText;
