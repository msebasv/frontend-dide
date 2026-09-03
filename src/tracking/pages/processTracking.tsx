/**
 * Tablero de seguimiento: avance de autor / validador / asesor por proceso.
 * Asesor → solo asignados. Líder / Coordinador / Admin → todos.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import clsx from "clsx";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import DataTable from "../../global/components/dataTable";
import StatCard from "../../global/components/statCard";
import { useAuth } from "../../global/hooks/useAuth";
import {
  isLeaderRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import { isAdvisorRole } from "../../courses/mappers/courseMappers";
import {
  IoBookOutline,
  IoCheckmarkDoneOutline,
  IoCloudUploadOutline,
  IoPersonOutline,
  IoWarningOutline,
} from "react-icons/io5";

import { useProcessTracking } from "../hooks/useProcessTracking";
import { getTrackingColumns } from "../constants/trackingColumns";

type FocusFilter =
  | "all"
  | "author_pending"
  | "author_returned"
  | "validator_pending"
  | "advisor_pending"
  | "completed";

function ProcessTrackingPage() {
  const { user, currentRole } = useAuth();
  const canAccess =
    isLeaderRole(currentRole) || isAdvisorRole(currentRole);

  const { rows, summary, loading, loadTracking } = useProcessTracking(
    user?.email ?? "",
    currentRole,
  );
  const [focus, setFocus] = useState<FocusFilter>("all");

  useEffect(() => {
    if (canAccess) void loadTracking();
  }, [canAccess, loadTracking]);

  const columns = useMemo(() => getTrackingColumns(), []);

  const filteredRows = useMemo(() => {
    switch (focus) {
      case "author_pending":
        return rows.filter((row) => row.authorStatus === "pending");
      case "author_returned":
        return rows.filter((row) => row.authorStatus === "returned");
      case "validator_pending":
        return rows.filter((row) => row.validatorStatus === "pending");
      case "advisor_pending":
        return rows.filter((row) => row.advisorStatus === "pending");
      case "completed":
        return rows.filter((row) =>
          row.phase.toLowerCase().includes("completado"),
        );
      default:
        return rows;
    }
  }, [rows, focus]);

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando seguimiento de procesos..." />;
  }

  const isAdvisor = currentRole === USER_ROLES.ADVISOR;
  const description = isAdvisor
    ? "Seguimiento de cargas y validaciones en los procesos donde estás asignado"
    : "Seguimiento de cargas del autor y revisiones del validador/asesor en todos los procesos";

  const focusOptions: { id: FocusFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "author_pending", label: "Autor pendiente" },
    { id: "author_returned", label: "Autor devuelto" },
    { id: "validator_pending", label: "Validador pendiente" },
    { id: "advisor_pending", label: "Asesor pendiente" },
    { id: "completed", label: "Completados" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguimiento"
        description={description}
        badge={isAdvisor ? "Asesoría" : "Gestión"}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Procesos"
          value={summary.total}
          icon={<IoBookOutline size={22} />}
          color="primary"
          subtitle={isAdvisor ? "Asignados a ti" : "En el sistema"}
        />
        <StatCard
          label="Autor pendiente"
          value={summary.authorPending}
          icon={<IoCloudUploadOutline size={22} />}
          color="warning"
          subtitle="Sin cargar o por recargar"
        />
        <StatCard
          label="Validador pendiente"
          value={summary.validatorPending}
          icon={<IoPersonOutline size={22} />}
          color="accent"
          subtitle="En revisión disciplinar"
        />
        <StatCard
          label="Asesor pendiente"
          value={summary.advisorPending}
          icon={<IoWarningOutline size={22} />}
          color="secondary"
          subtitle="En asesoría pedagógica"
        />
        <StatCard
          label="Completados"
          value={summary.completed}
          icon={<IoCheckmarkDoneOutline size={22} />}
          color="success"
          subtitle="Syllabus aprobado"
        />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-gray-50 p-1 sm:inline-flex">
        {focusOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFocus(option.id)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              focus === option.id
                ? "bg-white text-primary shadow-sm"
                : "text-muted hover:text-primary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <DataTable
        title="Avance por proceso"
        subtitle={`${filteredRows.length} proceso${filteredRows.length === 1 ? "" : "s"}`}
        columns={columns}
        data={filteredRows}
        pageSize={10}
        searchPlaceholder="Buscar proceso, curso, facultad o persona..."
        searchKeys={[
          "processName",
          "courseName",
          "facultyName",
          "authorLabel",
          "validatorLabel",
          "advisorLabel",
          "authorStatusLabel",
          "validatorStatusLabel",
          "advisorStatusLabel",
          "phaseShort",
        ]}
        getRowLink={(row) => row.detailPath}
        emptyMessage="No hay procesos con ese filtro"
      />
    </div>
  );
}

export default ProcessTrackingPage;
