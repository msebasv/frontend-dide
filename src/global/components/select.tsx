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
}

function Select({ options, value, onChange, placeholder }: SelectProps) {
  return (
    <Listbox value={value} onChange={onChange} by="value">
      <div className="relative">
        {/* BUTTON */}

        <ListboxButton
          className={clsx(
            "flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-primary",
          )}
        >
          <span>{value?.label || placeholder}</span>

          <FaAngleDown className="h-4 w-4 text-gray-400" />
        </ListboxButton>

        {/* OPTIONS */}

        <ListboxOptions
          anchor="bottom"
          className="
            mt-1
            max-h-60
            w-(--button-width)
            overflow-auto
            rounded-lg
            border
            border-gray-200
            bg-white
            shadow-lg
          "
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option}
              className="
                group
                flex
                text-sm
                cursor-pointer
                items-center
                gap-2
                px-3
                py-2
                data-focus:bg-primary/10
              "
            >
              {({ selected }) => (
                <>
                  <FaCheck
                    className={clsx(
                      "h-3 w-3 text-primary",
                      selected ? "visible" : "invisible",
                    )}
                  />

                  <span>{option.label}</span>
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
