import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

import {
  FIELD_LIMITS,
  normalizeInput,
} from "../utils/inputValidation";
import {
  ORGANIZATION_EMAIL_DOMAIN,
  searchOrganizationUsers,
} from "../../courses/services/userService";

interface EmailAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

function EmailAutocomplete({
  value,
  onChange,
  placeholder = `correo@${ORGANIZATION_EMAIL_DOMAIN}`,
  disabled = false,
  invalid = false,
}: EmailAutocompleteProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<
    { email: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen || value.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchOrganizationUsers(value);
        if (!cancelled) {
          setSuggestions(results);
          setActiveIndex(results.length > 0 ? 0 : -1);
        }
      } catch (error) {
        console.error("Error buscando usuarios", error);
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (email: string) => {
    onChange(email);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex].email);
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="email"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={FIELD_LIMITS.email}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-invalid={invalid || undefined}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          onChange(normalizeInput(event.target.value));
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={clsx(
          "w-full rounded-lg border bg-white px-3 py-2.5 text-base text-gray-900 sm:py-2 sm:text-sm",
          "focus:outline-none focus:ring-2",
          "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
          invalid
            ? "border-danger focus:ring-danger/40"
            : "border-gray-300 focus:ring-primary",
        )}
      />

      {isOpen && (loading || suggestions.length > 0 || value.trim().length >= 2) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-[120] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-muted">Buscando usuarios...</li>
          )}

          {!loading && suggestions.length === 0 && value.trim().length >= 2 && (
            <li className="px-3 py-2 text-sm text-muted">
              No se encontraron usuarios @{ORGANIZATION_EMAIL_DOMAIN}
            </li>
          )}

          {!loading &&
            suggestions.map((suggestion, index) => (
              <li key={suggestion.email} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(suggestion.email)}
                  className={clsx(
                    "flex w-full flex-col items-start px-3 py-2 text-left text-sm transition",
                    index === activeIndex
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <span className="font-medium">{suggestion.name}</span>
                  <span className="text-xs text-muted">{suggestion.email}</span>
                </button>
              </li>
            ))}
        </ul>
      )}

      <p className="mt-1 text-xs text-muted">
        Escribe el correo o busca por nombre. Solo usuarios @{ORGANIZATION_EMAIL_DOMAIN}
      </p>
    </div>
  );
}

export default EmailAutocomplete;
