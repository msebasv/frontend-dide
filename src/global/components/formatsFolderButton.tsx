import { IoFolderOpenOutline } from "react-icons/io5";

import Button from "./button";

interface FormatsFolderButtonProps {
  variant?: "primary" | "secondary" | "outline" | "soft" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const FORMATS_FOLDER_URL =
  "https://unbosqueeduco.sharepoint.com/:f:/s/pre-academicplus-dide/IgAx74VBIHtsSoyPjnRDFNhOAUzOwJZ8hXcEubSUqPw0dyk?e=aGrw4i";

/**
 * Abre en SharePoint la carpeta de formatos de Pre.
 */
function FormatsFolderButton({
  variant = "soft",
  size = "sm",
}: FormatsFolderButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        window.open(FORMATS_FOLDER_URL, "_blank", "noopener,noreferrer");
      }}
    >
      <IoFolderOpenOutline size={16} />
      Ver formatos
    </Button>
  );
}

export default FormatsFolderButton;
