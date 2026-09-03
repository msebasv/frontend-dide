import { IoDocumentTextOutline, IoTimeOutline } from "react-icons/io5";

import Modal from "../../global/components/modal";
import ProcessFilesPanel from "../../global/components/processFilesPanel";
import { formatDateTime } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { formatActivityStatus } from "../../courses/mappers/courseMappers";
import type { HistoryEntry } from "../types/history.types";

interface HistoryActivityDetailModalProps {
  entry: HistoryEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusStyle = (statusLabel: string): string => {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "bg-success/10 text-success";
  }
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "bg-danger/10 text-danger";
  }
  if (normalized.includes("por aprobar") || normalized.includes("proceso")) {
    return "bg-warning/10 text-warning";
  }

  return "bg-gray-100 text-muted";
};

const commentsLabel = (statusLabel: string): string => {
  const normalized = statusLabel.toLowerCase();
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "Comentarios de devolución";
  }
  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "Observaciones";
  }
  return "Descripción / comentarios";
};

function HistoryActivityDetailModal({
  entry,
  isOpen,
  onClose,
}: HistoryActivityDetailModalProps) {
  if (!entry) return null;

  const statusLabel = formatActivityStatus(entry.status);
  const hasComments = Boolean(entry.comments?.trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de la actividad"
      icon={<IoDocumentTextOutline size={18} />}
      size="xl"
    >
      <div className="space-y-5">
        <div className="rounded-lg bg-gray-50/80 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-primary">
                  {formatDomainLabel(entry.action)}
                </h3>
                {entry.version != null && (
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    V{entry.version}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {formatDomainLabel(entry.role)}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(statusLabel)}`}
            >
              {statusLabel}
            </span>
          </div>

          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Usuario
              </dt>
              <dd className="mt-0.5 text-primary">{entry.user || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Curso
              </dt>
              <dd className="mt-0.5 text-primary">{entry.courseName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Creado
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 text-primary">
                <IoTimeOutline size={13} className="text-muted" />
                {formatDateTime(entry.date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Última modificación
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 text-primary">
                <IoTimeOutline size={13} className="text-muted" />
                {formatDateTime(entry.modifiedOn || entry.date)}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-primary">
            {commentsLabel(statusLabel)}
          </h4>
          {hasComments ? (
            <p className="whitespace-pre-line rounded-lg border border-border bg-surface px-4 py-3 text-sm text-primary">
              {entry.comments}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">
              Sin comentarios registrados en esta actividad.
            </p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-primary">
            Material / archivos
          </h4>
          {entry.folderBase || entry.processId ? (
            <ProcessFilesPanel
              folderBase={entry.folderBase}
              processId={entry.processId}
              activityId={entry.id}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">
              No hay carpeta de archivos asociada a esta actividad.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default HistoryActivityDetailModal;
