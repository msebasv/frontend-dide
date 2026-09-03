import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";

import { FaAngleDown } from "react-icons/fa";
import { FaCheck } from "react-icons/fa6";

import clsx from "clsx";

interface Option {
  label: string;
  value: string;
}

interface SelectProps {
  options: Option[];

  value: Option | null;

  onChange: (value: Option | null) => void;

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
              className="group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm data-focus:bg-primary/10"
            >
              {({ selected }) => (
                <>
                  <FaCheck
                    className={clsx(
                      "h-3 w-3 shrink-0 text-primary",
                      selected ? "visible" : "invisible",
                    )}
                  />

                  <span className="min-w-0">{option.label}</span>
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

export default Select;
