import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";

import { FaAngleDown } from "react-icons/fa";
import { FaCheck } from "react-icons/fa6";

import clsx from "clsx";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
  hint?: string;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "neutral" | "info";
  };
}

export type Option = SelectOption;

interface SelectProps {
  options: SelectOption[];

  value: SelectOption | null;

  onChange: (value: SelectOption | null) => void;

  placeholder?: string;
  disabled?: boolean;
}

function Select({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
}: SelectProps) {
  return (
    <Listbox value={value} onChange={onChange} by="value" disabled={disabled}>
      <div className="relative">
        <ListboxButton
          className={clsx(
            "flex w-full items-center justify-between rounded-full border border-border bg-white px-4 py-2.5 text-base text-primary sm:py-2.5 sm:text-sm",
            "focus:outline-none focus:ring-2 focus:ring-secondary/30",
            "data-disabled:cursor-not-allowed data-disabled:bg-acacia-5 data-disabled:text-muted",
          )}
        >
          <span className="min-w-0 truncate text-left">
            {value?.label || placeholder}
          </span>

          <FaAngleDown className="h-4 w-4 shrink-0 text-muted" />
        </ListboxButton>

        {/*
          modal={false}: evita que Headless UI bloquee el scroll del documento
          al abrir (eso hacía saltar sidebar/contenido y dejaba hueco abajo).
        */}
        <ListboxOptions
          anchor={{ to: "bottom start", gap: "4px", padding: 8 }}
          modal={false}
          className={clsx(
            "z-[110] max-h-60 w-[var(--button-width)] overflow-auto rounded-2xl",
            "border border-border bg-white shadow-lg",
            "focus:outline-none",
          )}
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option}
              disabled={option.disabled}
              className={clsx(
                "group flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                "data-focus:bg-primary/10",
                "data-disabled:cursor-not-allowed data-disabled:opacity-60 data-disabled:bg-gray-50",
              )}
            >
              {({ selected, disabled: optionDisabled }) => (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FaCheck
                      className={clsx(
                        "h-3 w-3 shrink-0 text-primary",
                        selected ? "visible" : "invisible",
                      )}
                    />
                    <span
                      className={clsx(
                        "min-w-0 truncate",
                        optionDisabled ? "text-muted" : "text-primary font-normal",
                      )}
                    >
                      {option.label}
                    </span>
                  </div>
                  {option.badge && (
                    <span
                      className={clsx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        option.badge.variant === "success" &&
                          "bg-emerald-100 text-emerald-800",
                        option.badge.variant === "warning" &&
                          "bg-amber-100 text-amber-900",
                        option.badge.variant === "info" &&
                          "bg-blue-100 text-blue-800",
                        (!option.badge.variant ||
                          option.badge.variant === "neutral") &&
                          "bg-gray-100 text-gray-700",
                      )}
                    >
                      {option.badge.text}
                    </span>
                  )}
                </div>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

export default Select;
