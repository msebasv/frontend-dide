/**
 * Genera un PDF con el resumen de estadísticas del líder.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { LeaderStatistics } from "../types/statistics.types";

interface ExportStatisticsPdfOptions {
  statistics: LeaderStatistics;
  periodLabel: string;
  filtersLabel?: string;
}

const formatStamp = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

export const exportStatisticsPdf = ({
  statistics,
  periodLabel,
  filtersLabel,
}: ExportStatisticsPdfOptions): void => {
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
  doc.setTextColor(15, 45, 75);
  doc.text("AcademicPlus — Estadísticas", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 90, 100);
  const filterText = filtersLabel?.trim() || `Periodo: ${periodLabel}`;
  const filterLines = doc.splitTextToSize(filterText, pageWidth - margin * 2);
  doc.text(filterLines, margin, y);
  y += filterLines.length * 5;
  doc.text(
    `Generado: ${new Date().toLocaleString("es-CO")}`,
    margin,
    y,
  );
  y += 8;

  doc.setDrawColor(200, 210, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const { metrics } = statistics;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 45, 75);
  doc.text("Indicadores clave", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Indicador", "Valor"]],
    body: [
      ["Total procesos", String(metrics.totalProcesses)],
      ["En progreso", String(metrics.inProgress)],
      ["Por aprobar", String(metrics.pendingApproval)],
      ["Completados", String(metrics.completed)],
      ["Tasa de completitud", `${metrics.completionRate}%`],
      ["Actividades totales", String(metrics.totalActivities)],
      ["Promedio actividades / proceso", String(metrics.avgActivitiesPerProcess)],
      ["Procesos este mes", String(metrics.processesThisMonth)],
      ["Actividad este mes", String(metrics.activitiesThisMonth)],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 45, 75], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 10;

  const addSection = (
    title: string,
    head: string[],
    body: (string | number)[][],
  ) => {
    if (body.length === 0) return;
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 45, 75);
    doc.text(title, margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [head],
      body: body.map((row) => row.map(String)),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 45, 75], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;
  };

  addSection(
    "Distribución por fase",
    ["Fase", "Cantidad"],
    statistics.phaseDistribution.map((item) => [item.name, item.value]),
  );

  addSection(
    "Distribución por facultad",
    ["Facultad", "Total", "En progreso", "Completados"],
    statistics.facultyDistribution.map((item) => [
      item.name,
      item.total,
      item.inProgress,
      item.completed,
    ]),
  );

  addSection(
    "Distribución por programa",
    ["Programa", "Procesos"],
    statistics.programDistribution.map((item) => [item.name, item.value]),
  );

  addSection(
    "Tendencia mensual",
    ["Mes", "Procesos", "Actividades"],
    statistics.monthlyTrend.map((item) => [
      item.month,
      item.processes,
      item.activities,
    ]),
  );

  addSection(
    "Actividades por rol",
    ["Rol", "Cantidad"],
    statistics.activitiesByRole.map((item) => [item.role, item.count]),
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 160);
    doc.text(
      `AcademicPlus · Página ${page} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  doc.save(`estadisticas-academicplus-${formatStamp()}.pdf`);
};
