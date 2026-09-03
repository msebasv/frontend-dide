import clsx from "clsx";

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  invalid?: boolean;
  disabled?: boolean;
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  invalid = false,
  disabled = false,
}: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={clsx(
        "w-full rounded-3xl border bg-white px-4 py-3 text-base text-primary sm:text-sm",
        "focus:outline-none focus:ring-2",
        "resize-y disabled:cursor-not-allowed disabled:bg-acacia-5 disabled:text-muted",
        invalid
          ? "border-danger focus:ring-danger/40"
          : "border-border focus:border-secondary/50 focus:ring-secondary/25",
      )}
    />
  );
}

export default TextArea;
