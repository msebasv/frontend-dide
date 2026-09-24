import {
  IoDocumentTextOutline,
  IoLinkOutline,
  IoOpenOutline,
  IoPersonOutline,
  IoTimeOutline,
} from "react-icons/io5";
import clsx from "clsx";

import { formatDateTime } from "../../global/utils/dateUtils";
import { stripHttpLinksFromText } from "../../global/utils/inputValidation";
import type { ProcessDeliverableItem } from "../services/deliverableService";
import type { CourseMaterial } from "../types/course.types";
import { collectMaterialLinks } from "./courseDetailViewHelpers";

export interface CourseDetailFinalDocumentsProps {
  embedded?: boolean;
  selectedDeliverable: ProcessDeliverableItem | null;
  selectedMaterialId: string;
  onSelectMaterial: (activityId: string) => void;
  finalDocuments: {
    latestAuthor: CourseMaterial | null;
    advisorGuide: CourseMaterial | null;
    dideLinks: CourseMaterial | null;
  };
}

export function CourseDetailFinalDocuments({
  embedded = false,
  selectedDeliverable,
  selectedMaterialId,
  onSelectMaterial,
  finalDocuments,
}: CourseDetailFinalDocumentsProps) {
  const cards = [
    {
      key: "author",
      material: finalDocuments.latestAuthor,
      title: "Última versión del autor",
      caption: "Material académico definitivo cargado por el autor.",
      kind: "file" as const,
    },
    {
      key: "advisor",
      material: finalDocuments.advisorGuide,
      title: "Guión instruccional",
      caption: "Documento cargado por el asesor pedagógico.",
      kind: "file" as const,
    },
    {
      key: "dide",
      material: finalDocuments.dideLinks,
      title: "Enlaces audiovisuales",
      caption: "Links registrados por el Diseñador DIDE.",
      kind: "links" as const,
    },
  ];

  const body = (
    <>
      {!embedded && (
        <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
          <h3 className="truncate text-sm font-semibold text-primary">
            Versión final
            {selectedDeliverable ? ` · ${selectedDeliverable.name}` : ""}
          </h3>
          <p className="mt-1 truncate text-xs text-muted">
            Seleccione un documento para consultar sus archivos, enlaces y la
            vista previa abajo.
          </p>
        </div>
      )}

      {embedded && (
        <p className="mb-3 text-xs text-muted">
          Seleccione un documento para consultar sus archivos, enlaces y la
          vista previa.
        </p>
      )}

      <div
        className={clsx(
          "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
          embedded ? "" : "p-3 sm:p-4",
        )}
      >
        {cards.map((card) => {
          const material = card.material;

          if (!material) {
            return (
              <div
                key={card.key}
                className="rounded-xl border border-dashed border-border bg-gray-50/60 px-4 py-3"
              >
                <p className="text-sm font-semibold text-muted">
                  {card.title}
                </p>
                <p className="mt-1 text-xs text-muted/80">
                  Todavía no se ha registrado en este entregable.
                </p>
              </div>
            );
          }

          const isSelected = selectedMaterialId === material.activityId;
          const links =
            card.kind === "links" ? collectMaterialLinks(material) : [];
          const linkNotes =
            card.kind === "links"
              ? stripHttpLinksFromText(material.description)
              : "";

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onSelectMaterial(material.activityId)}
              className={clsx(
                "rounded-xl border px-4 py-3 text-left transition",
                isSelected
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-acacia-5/70",
              )}
            >
              <div className="flex items-center gap-2">
                {card.kind === "links" ? (
                  <IoLinkOutline
                    className="shrink-0 text-primary"
                    size={16}
                  />
                ) : (
                  <IoDocumentTextOutline
                    className="shrink-0 text-primary"
                    size={16}
                  />
                )}
                <p className="min-w-0 truncate text-sm font-semibold text-primary">
                  {card.title}
                </p>
                {material.version != null && (
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    V{material.version}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {card.kind === "links" && links.length > 0
                  ? `${links.length} enlace${links.length === 1 ? "" : "s"}`
                  : material.name}
              </p>
              {card.kind === "links" && links.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {links.map((link, index) => (
                    <li key={`${link}-${index}`}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="flex items-start gap-1.5 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                      >
                        <IoOpenOutline
                          size={12}
                          className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0 break-all">{link}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <IoPersonOutline size={11} />
                    {material.performedBy || material.performedByEmail || "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IoTimeOutline size={11} />
                    {formatDateTime(
                      material.modifiedOn || material.createdOn,
                    )}
                  </span>
                </div>
              )}
              {card.kind === "links" && linkNotes ? (
                <div className="mt-2 rounded-lg border border-border/70 bg-white/80 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Comentarios
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11px] text-primary">
                    {linkNotes}
                  </p>
                </div>
              ) : null}
              <p className="mt-2 text-[11px] text-muted/80">
                {card.caption}
              </p>
            </button>
          );
        })}
      </div>
    </>
  );

  if (embedded) return body;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
      {body}
    </div>
  );
}
