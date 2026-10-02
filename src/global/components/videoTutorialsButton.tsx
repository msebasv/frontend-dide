import { IoPlayCircleOutline } from "react-icons/io5";

import Button from "./button";

interface VideoTutorialsButtonProps {
  variant?: "primary" | "secondary" | "outline" | "soft" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const VIDEO_TUTORIALS_URL =
  "https://unbosqueeduco.sharepoint.com/:f:/s/pre-academicplus-dide/IgBEH8bOLSSgTbShHz6HPLDvAY3POMOUlfRTGKNtaf5YmDQ?e=lvsCAw";

/**
 * Abre en SharePoint la carpeta de videotutoriales.
 */
function VideoTutorialsButton({
  variant = "soft",
  size = "sm",
}: VideoTutorialsButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        window.open(VIDEO_TUTORIALS_URL, "_blank", "noopener,noreferrer");
      }}
    >
      <IoPlayCircleOutline size={16} />
      Videotutoriales
    </Button>
  );
}

export default VideoTutorialsButton;
