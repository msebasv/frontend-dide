import { IoFolderOpenOutline } from "react-icons/io5";

import Button from "./button";
import { buildSharePointFormatsFolderUrl } from "../config/sharepointConfig";

interface FormatsFolderButtonProps {
  variant?: "primary" | "secondary" | "outline" | "soft" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

/**
 * Abre en SharePoint la carpeta Documents/Formats con plantillas y formatos.
 */
function FormatsFolderButton({
  variant = "soft",
  size = "sm",
}: FormatsFolderButtonProps) {
  const formatsUrl = buildSharePointFormatsFolderUrl();
  if (!formatsUrl) return null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        window.open(formatsUrl, "_blank", "noopener,noreferrer");
      }}
    >
      <IoFolderOpenOutline size={16} />
      Ver formatos
    </Button>
  );
}

export default FormatsFolderButton;
