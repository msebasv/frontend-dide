/**
 * Exporta a PDF el historial de movimiento de un entregable
 * (cargues, aprobaciones, devoluciones, etc.).
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { movementElapsedDays } from "../../global/utils/colombiaBusinessDays";
import { formatDateTime } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { formatActivityStatus } from "../mappers/courseMappers";
import type { CourseDetail, CourseMaterial } from "../types/course.types";
import type { ProcessDeliverableItem } from "../services/deliverableService";

interface ExportDeliverableHistoryPdfOptions {
  detail: CourseDetail;
  deliverable: ProcessDeliverableItem;
  deliverableLocation: string;
  materials: CourseMaterial[];
}

const formatStamp = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

const sanitizeFilePart = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "entregable";

const movementLabel = (material: CourseMaterial): string => {
  const statusLabel = formatActivityStatus(material.status);
  const normalized = statusLabel.toLowerCase();

  if (material.isAuthorUpload) {
    return material.version != null
      ? `Cargue de material (V${material.version})`
      : "Cargue de material";
  }

  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "Devolución / rechazo";
  }

  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "Aprobación";
  }

  return statusLabel;
};

export const exportDeliverableHistoryPdf = ({
  detail,
  deliverable,
  deliverableLocation,
  materials,
}: ExportDeliverableHistoryPdfOptions): void => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  const ensureSpace = (needed: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 64, 64);
  doc.text("AcademicPlus — Historial del entregable", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 90, 100);
  doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, margin, y);
  y += 8;

  doc.setDrawColor(200, 210, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 64, 64);
  doc.text("Información del proceso", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 50, 60);

  const infoLines = [
    `Proceso: ${detail.processName || "—"}`,
    `Curso: ${detail.courseName || "—"}`,
    `Programa: ${detail.programName || "—"}`,
    `Facultad: ${detail.facultyName || "—"}`,
  ];

  for (const line of infoLines) {
    ensureSpace(6);
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }

  y += 4;
  ensureSpace(20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 64, 64);
  doc.text("Entregable", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 50, 60);

  const deliverableLines = [
    `Nombre: ${deliverable.name || "—"}`,
    `Ubicación: ${deliverableLocation || "—"}`,
    `Estado actual: ${formatDomainLabel(deliverable.stateLabel) || "—"}`,
  ];

  for (const line of deliverableLines) {
    ensureSpace(6);
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }

  y += 6;
  ensureSpace(16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 64, 64);
  doc.text("Movimientos registrados", margin, y);
  y += 4;

  const chronological = [...materials].sort((a, b) => {
    const aTime = new Date(a.createdOn || a.modifiedOn || 0).getTime();
    const bTime = new Date(b.createdOn || b.modifiedOn || 0).getTime();
    return aTime - bTime;
  });

  if (chronological.length === 0) {
    ensureSpace(10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 110, 120);
    doc.text("No hay movimientos registrados para este entregable.", margin, y);
  } else {
    const elapsedById = movementElapsedDays(
      chronological.map((material) => ({
        id: material.activityId,
        at: material.createdOn || material.modifiedOn,
      })),
    );
    const newestId = chronological[chronological.length - 1]?.activityId;
    const body = chronological.map((material) => {
      const statusLabel = formatActivityStatus(material.status);
      const actor =
        material.performedBy || material.performedByEmail || "—";
      const role = material.performedByRole
        ? formatDomainLabel(material.performedByRole)
        : "—";
      const comments = material.description?.trim() || "—";
      const days = elapsedById.get(material.activityId) ?? 0;
      const daysLabel =
        material.activityId === newestId ? `${days} (curso)` : String(days);

      return [
        formatDateTime(material.createdOn || material.modifiedOn),
        daysLabel,
        movementLabel(material),
        statusLabel,
        `${actor}${role !== "—" ? ` (${role})` : ""}`,
        comments,
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
      head: [
        [
          "Fecha",
          "Días",
          "Movimiento",
          "Estado",
          "Realizado por",
          "Comentarios",
        ],
      ],
      body,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fillColor: [0, 64, 64],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 16, halign: "center" },
        2: { cellWidth: 32 },
        3: { cellWidth: 28 },
        4: { cellWidth: 34 },
        5: { cellWidth: "auto" },
      },
    });
  }

  const fileName = `historial-${sanitizeFilePart(deliverable.name)}-${formatStamp()}.pdf`;
  doc.save(fileName);
};
