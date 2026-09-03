import { useCallback, useEffect, useRef, useState } from "react";
import {
  IoAddOutline,
  IoRemoveOutline,
  IoRefreshOutline,
} from "react-icons/io5";

const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;

interface MediaPreviewViewerProps {
  url: string;
  fileName: string;
  mimeType?: string;
}

const isImageFile = (fileName: string, mimeType?: string): boolean => {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
};

const isPdfFile = (fileName: string, mimeType?: string): boolean => {
  if (mimeType === "application/pdf") return true;
  return fileName.toLowerCase().endsWith(".pdf");
};

function MediaPreviewViewer({
  url,
  fileName,
  mimeType,
}: MediaPreviewViewerProps) {
  const [zoom, setZoom] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const isImage = isImageFile(fileName, mimeType);
  const isDocument = isPdfFile(fileName, mimeType) || !isImage;
  const scale = zoom / 100;

  useEffect(() => {
    setZoom(100);
  }, [url, fileName]);

  const clampZoom = (value: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const zoomIn = () => setZoom((current) => clampZoom(current + ZOOM_STEP));
  const zoomOut = () => setZoom((current) => clampZoom(current - ZOOM_STEP));
  const resetZoom = () => setZoom(100);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((current) => clampZoom(current + delta));
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gray-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-3 py-2">
        <p className="text-xs text-muted">
          <span className="sm:hidden">Usa + / − para acercar o alejar</span>
          <span className="hidden sm:inline">
            Usa los botones o{" "}
            <kbd className="rounded border border-border px-1 font-mono text-[10px]">
              Ctrl
            </kbd>{" "}
            + rueda del mouse para zoom
          </span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-primary transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
            aria-label="Alejar"
            title="Alejar"
          >
            <IoRemoveOutline size={16} />
          </button>
          <span className="min-w-[3.5rem] text-center text-xs font-medium text-primary">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-primary transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
            aria-label="Acercar"
            title="Acercar"
          >
            <IoAddOutline size={16} />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-medium text-primary transition hover:bg-gray-50 sm:h-8"
            aria-label="Restablecer zoom"
            title="Restablecer zoom"
          >
            <IoRefreshOutline size={14} />
            100%
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="max-h-[min(50dvh,28rem)] overflow-auto bg-[#525659] p-2 sm:max-h-[32rem] sm:p-3"
      >
        <div
          className="mx-auto origin-top transition-transform duration-150"
          style={{
            transform: `scale(${scale})`,
            width: isDocument ? `${100 / scale}%` : "fit-content",
            maxWidth: isImage ? "none" : `${100 / scale}%`,
          }}
        >
          {isImage ? (
            <img
              src={url}
              alt={fileName}
              className="block max-w-none rounded shadow-md"
              draggable={false}
            />
          ) : (
            <iframe
              src={url}
              title={fileName}
              className="h-[min(45dvh,22rem)] w-full rounded bg-white shadow-md sm:h-[640px]"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default MediaPreviewViewer;
