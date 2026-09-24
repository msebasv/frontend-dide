import {
  IoDocumentTextOutline,
  IoPersonOutline,
  IoTimeOutline,
} from "react-icons/io5";
import clsx from "clsx";

import { formatDateTime } from "../../global/utils/dateUtils";
import { formatActivityStatus } from "../mappers/courseMappers";
import type { CourseMaterial } from "../types/course.types";
import { materialStatusStyle } from "./courseDetailViewHelpers";

export interface CourseDetailActivityListProps {
  materials: CourseMaterial[];
  hasDeliverables: boolean;
  selectedMaterialId: string;
  onSelectMaterial: (activityId: string) => void;
}

export function CourseDetailActivityList({
  materials,
  hasDeliverables,
  selectedMaterialId,
  onSelectMaterial,
}: CourseDetailActivityListProps) {
  if (materials.length === 0) {
    return (
      <p className="px-5 py-12 text-center text-sm text-muted">
        {hasDeliverables
          ? "Este entregable no tiene actividades registradas"
          : "No hay material registrado"}
      </p>
    );
  }

  const latestAuthorVersion = materials.find(
    (item) => item.isAuthorUpload,
  )?.version;

  return (
    <ul className="divide-y divide-border-light">
      {materials.map((material) => {
        const statusLabel = formatActivityStatus(material.status);
        const statusDate = formatDateTime(
          material.modifiedOn || material.createdOn,
        );
        const isLatestAuthorUpload =
          material.isAuthorUpload && material.version === latestAuthorVersion;
        const isSelected = selectedMaterialId === material.activityId;

        return (
          <li key={material.activityId}>
            <button
              type="button"
              onClick={() => onSelectMaterial(material.activityId)}
              className={clsx(
                "flex w-full items-start gap-3 px-5 py-3.5 text-left text-sm transition-all",
                isSelected
                  ? "border-l-[3px] border-l-primary bg-primary/5"
                  : "hover:bg-gray-50/80",
              )}
            >
              <div
                className={clsx(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-gray-100 text-muted",
                )}
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
                    </p>
                  )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-xl px-2 py-0.5 text-[11px] font-semibold ${materialStatusStyle(statusLabel)}`}
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
  );
}
