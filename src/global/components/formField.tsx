import type { ReactNode } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  /** Texto de ayuda mostrado en tooltip (desktop) y debajo del label (móvil). */
  hint?: string;
  className?: string;
}

function FormField({
  label,
  children,
  required = false,
  error,
  hint,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
        <span>
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </span>
        {hint && (
          <span className="group relative hidden shrink-0 md:inline-flex">
            <button
              type="button"
              className="rounded-full text-muted transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
              aria-label={`Ayuda: ${label}`}
            >
              <IoInformationCircleOutline size={16} />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-primary px-3 py-2 text-left text-[11px] leading-relaxed font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {hint}
              <span className="absolute top-full left-1/2 -mt-px -translate-x-1/2 border-4 border-transparent border-t-primary" />
            </span>
          </span>
        )}
      </label>
      {hint && (
        <p className="text-xs leading-relaxed text-muted md:hidden">{hint}</p>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default FormField;
