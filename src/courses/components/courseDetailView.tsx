import { useEffect, useState } from "react";
import {
  IoDocumentTextOutline,
  IoPersonOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { Link } from "react-router-dom";

import InfoCard from "../../global/components/infoCard";
import ProcessFilesPanel from "../../global/components/processFilesPanel";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { formatActivityStatus } from "../mappers/courseMappers";

import type { CourseDetail } from "../types/course.types";

interface CourseDetailViewProps {
  detail: CourseDetail;
  isValidationMode?: boolean;
  selectedMaterialId?: string;
  onSelectedMaterialChange?: (activityId: string) => void;
  historyLink?: string;
}

const materialStatusStyle = (statusLabel: string): string => {
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

const commentsLabel = (statusLabel: string, isAuthorUpload: boolean): string => {
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
  if (isAuthorUpload) return "Descripción del material";
  return "Descripción / comentarios";
};

const actorLabel = (statusLabel: string, isAuthorUpload: boolean): string => {
  const normalized = statusLabel.toLowerCase();
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "Devuelto por";
  }
  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "Aprobado por";
  }
  if (isAuthorUpload) return "Cargado por";
  return "Realizado por";
};

function CourseDetailView({
  detail,
  isValidationMode = false,
  selectedMaterialId: controlledMaterialId,
  onSelectedMaterialChange,
  historyLink,
}: CourseDetailViewProps) {
  const [internalMaterialId, setInternalMaterialId] = useState(
    detail.materials.find((item) => item.isAuthorUpload)?.activityId ??
      detail.materials[0]?.activityId ??
      "",
  );

  const selectedMaterialId = controlledMaterialId ?? internalMaterialId;

  useEffect(() => {
    if (controlledMaterialId) return;

    const latestAuthorId = detail.materials.find(
      (item) => item.isAuthorUpload,
    )?.activityId;
    setInternalMaterialId(
      latestAuthorId ?? detail.materials[0]?.activityId ?? "",
    );
  }, [controlledMaterialId, detail.materials]);

  const handleSelectMaterial = (activityId: string) => {
    if (onSelectedMaterialChange) {
      onSelectedMaterialChange(activityId);
      return;
    }

    setInternalMaterialId(activityId);
  };

  const selectedMaterial = detail.materials.find(
    (material) => material.activityId === selectedMaterialId,
  );

  const processInfoItems = [
    { label: "Proceso de virtualización", value: detail.processName },
    { label: "Curso", value: detail.courseName },
    { label: "Programa", value: detail.programName },
    { label: "Facultad", value: detail.facultyName },
    { label: "Estado", value: formatDomainLabel(detail.status) },
    { label: "Rol actual", value: formatDomainLabel(detail.currentRole) },
  ];

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InfoCard title="Información del proceso" items={processInfoItems} />

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <ProcessStatus status={detail.status} />
        {historyLink && (
          <Link
            to={historyLink}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary"
          >
            <IoTimeOutline size={14} />
            Ver historial del curso
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-1">
          <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
            <h3 className="text-sm font-semibold text-primary">
              Actividades del proceso
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                {detail.materials.length}
              </span>
            </h3>
            <p className="mt-1 text-xs text-muted">
              {isValidationMode
                ? "Selecciona una actividad para revisarla. Solo las cargas del autor tienen versión."
                : "Cargas del autor (con versión) y revisiones del proceso, de la más reciente a la más antigua."}
            </p>
          </div>
          {detail.materials.length > 0 ? (
            <ul className="max-h-[40dvh] divide-y divide-border-light overflow-y-auto lg:max-h-none">
              {detail.materials.map((material) => {
                const statusLabel = formatActivityStatus(material.status);
                const statusDate = formatDateTime(
                  material.modifiedOn || material.createdOn,
                );
                const latestAuthorVersion = detail.materials.find(
                  (item) => item.isAuthorUpload,
                )?.version;
                const isLatestAuthorUpload =
                  material.isAuthorUpload &&
                  material.version === latestAuthorVersion;

                return (
                  <li key={material.activityId}>
                    <button
                      type="button"
                      onClick={() => handleSelectMaterial(material.activityId)}
                      className={`flex w-full items-start gap-3 px-5 py-3.5 text-left text-sm transition-all ${
                        selectedMaterialId === material.activityId
                          ? "border-l-[3px] border-l-primary bg-primary/5"
                          : "hover:bg-gray-50/80"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          selectedMaterialId === material.activityId
                            ? "bg-primary/10 text-primary"
                            : "bg-gray-100 text-muted"
                        }`}
                      >
                        <IoDocumentTextOutline size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-primary">
                            {material.name}
                          </p>
                          {material.version != null && (
                            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                              V{material.version}
                            </span>
                          )}
                          {isLatestAuthorUpload && (
                            <span className="shrink-0 text-[10px] font-semibold text-primary/70">
                              Actual
                            </span>
                          )}
                        </div>
                        {(material.performedBy || material.performedByEmail) &&
                          material.performedBy !== "—" && (
                            <p className="mt-1 truncate text-[11px] text-muted">
                              <IoPersonOutline
                                className="mr-1 inline align-[-2px]"
                                size={11}
                              />
                              {material.performedBy || material.performedByEmail}
                              {material.performedBy &&
                                material.performedByEmail && (
                                  <span className="text-muted/80">
                                    {" "}
                                    · {material.performedByEmail}
                                  </span>
                                )}
                            </p>
                          )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${materialStatusStyle(statusLabel)}`}
                          >
                            {statusLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                            <IoTimeOutline size={12} />
                            {statusDate}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-muted">
              No hay material cargado aún
            </p>
          )}
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-2">
          <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
            <h3 className="text-sm font-semibold text-primary">
              Detalle del material
            </h3>
          </div>
          <div className="p-3 sm:p-5">
            {selectedMaterial ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50/80 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-primary">
                      {selectedMaterial.name}
                    </h4>
                    {selectedMaterial.version != null && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        Versión {selectedMaterial.version}
                      </span>
                    )}
                    {selectedMaterial.isAuthorUpload &&
                      selectedMaterial.version ===
                        detail.materials.find((item) => item.isAuthorUpload)
                          ?.version && (
                        <span className="text-xs font-semibold text-primary/70">
                          Actual
                        </span>
                      )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${materialStatusStyle(formatActivityStatus(selectedMaterial.status))}`}
                    >
                      {formatActivityStatus(selectedMaterial.status)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <IoTimeOutline size={13} />
                      {formatDateTime(
                        selectedMaterial.modifiedOn ||
                          selectedMaterial.createdOn,
                      )}
                    </span>
                  </div>

                  <div className="mt-3 rounded-lg border border-border/70 bg-white/70 px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      {actorLabel(
                        formatActivityStatus(selectedMaterial.status),
                        selectedMaterial.isAuthorUpload,
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-start gap-x-2 gap-y-1.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                          <IoPersonOutline size={14} className="shrink-0" />
                          {selectedMaterial.performedBy ||
                            selectedMaterial.performedByEmail ||
                            "—"}
                        </p>
                        {selectedMaterial.performedByEmail &&
                          selectedMaterial.performedBy &&
                          selectedMaterial.performedBy !==
                            selectedMaterial.performedByEmail && (
                            <p className="mt-0.5 pl-[22px] text-xs text-muted">
                              {selectedMaterial.performedByEmail}
                            </p>
                          )}
                      </div>
                      {selectedMaterial.performedByRole &&
                        selectedMaterial.performedByRole !== "—" && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {formatDomainLabel(selectedMaterial.performedByRole)}
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      {commentsLabel(
                        formatActivityStatus(selectedMaterial.status),
                        selectedMaterial.isAuthorUpload,
                      )}
                    </p>
                    {selectedMaterial.description?.trim() ? (
                      <p className="mt-1 whitespace-pre-line text-sm text-muted">
                        {selectedMaterial.description}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted/80">
                        Sin comentarios registrados.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2">
                <IoDocumentTextOutline className="text-gray-300" size={32} />
                <p className="text-sm text-muted">
                  Selecciona un material para revisarlo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProcessFilesPanel
        folderBase={detail.folderBase}
        processId={detail.processId}
        activityId={selectedMaterial?.activityId}
      />
    </div>
  );
}

export default CourseDetailView;
