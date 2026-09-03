import { useRef, useState } from "react";
import { IoCloudUploadOutline } from "react-icons/io5";
import clsx from "clsx";

import {
  ACCEPTED_FILE_TYPES,
  validateFiles,
} from "../utils/inputValidation";

interface FileUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  helperText?: string;
  maxFiles?: number;
  allowedExtensions?: Set<string>;
}

function FileUpload({
  files,
  onChange,
  multiple = true,
  accept = ACCEPTED_FILE_TYPES,
  required = false,
  error,
  disabled = false,
  helperText = "PDF, Word, PowerPoint, Excel o imágenes · máx. 25 MB c/u",
  maxFiles,
  allowedExtensions,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const next = multiple ? [...files, ...selected] : selected;
    const result = validateFiles(next, {
      required,
      maxFiles,
      allowedExtensions,
    });

    if (!result.ok) {
      setLocalError(result.message ?? "Archivo no válido.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setLocalError("");
    onChange(result.files);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setLocalError("");
    onChange(next);
  };

  const displayError = error || localError;

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed",
          "bg-gray-50 px-6 py-8 transition",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-secondary hover:bg-secondary/5",
          displayError ? "border-danger" : "border-gray-300",
        )}
      >
        <IoCloudUploadOutline size={32} className="text-gray-400" />
        <span className="text-sm text-gray-600">
          Haz clic para seleccionar archivos
        </span>
        <span className="text-xs text-gray-400">{helperText}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />

      {displayError && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {displayError}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <span className="truncate text-gray-700">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="ml-2 text-xs text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FileUpload;
