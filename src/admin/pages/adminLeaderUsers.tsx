/**
 * Gestión de Leaders Users (roles globales). Solo Administrador.
 * Incluye Diseñador DIDE, Coordinador DIDE, Líder y Administrador.
 * Soft-delete: inactivar / reactivar (no borra el registro).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  IoAddOutline,
  IoBanOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import clsx from "clsx";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import DataTable from "../../global/components/dataTable";
import Button from "../../global/components/button";
import Modal from "../../global/components/modal";
import FormField from "../../global/components/formField";
import EmailAutocomplete from "../../global/components/emailAutocomplete";
import Select from "../../global/components/select";
import FeedbackModal from "../../global/components/feedbackModal";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useAuth } from "../../global/hooks/useAuth";
import {
  isAdminRole,
  USER_ROLES,
} from "../../global/constants/domainConstants";
import { validateOrganizationEmail } from "../../global/utils/inputValidation";
import { getFaculties } from "../../courses/services/courseService";
import type { Dev_table_faculties } from "../../generated/models/Dev_table_facultiesModel";
import {
  activateLeaderUser,
  createLeaderUser,
  deactivateLeaderUser,
  LEADER_USERS_MANAGEABLE_ROLES,
  listLeaderUsers,
  type LeaderUserRow,
} from "../services/adminService";

type SelectOption = { label: string; value: string };
type StatusFilter = "active" | "inactive" | "all";

function AdminLeaderUsersPage() {
  const { currentRole } = useAuth();
  const { feedback, closeFeedback, runAction } = useActionFeedback();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeaderUserRow[]>([]);
  const [faculties, setFaculties] = useState<Dev_table_faculties[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SelectOption | null>({
    label: USER_ROLES.DIDE_DESIGNER,
    value: USER_ROLES.DIDE_DESIGNER,
  });
  const [faculty, setFaculty] = useState<SelectOption | null>(null);

  const emailCheck = validateOrganizationEmail(email);
  const formIsValid = emailCheck.ok && Boolean(role);

  const roleOptions = useMemo(
    () =>
      LEADER_USERS_MANAGEABLE_ROLES.map((item) => ({
        label: item,
        value: item,
      })),
    [],
  );

  const facultyOptions = useMemo(
    () =>
      [...faculties]
        .map((item) => ({
          label: item.dev_namefaculty?.trim() || "Sin nombre",
          value: item.dev_table_facultyid,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [faculties],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [userRows, facultyRows] = await Promise.all([
        listLeaderUsers(),
        getFaculties(),
      ]);
      setRows(userRows);
      setFaculties(facultyRows);
    } catch (error) {
      console.error("Error cargando usuarios líderes", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "active") return rows.filter((row) => row.isActive);
    if (statusFilter === "inactive") return rows.filter((row) => !row.isActive);
    return rows;
  }, [rows, statusFilter]);

  const activeCount = rows.filter((row) => row.isActive).length;
  const inactiveCount = rows.length - activeCount;

  if (!isAdminRole(currentRole)) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando usuarios líderes..." />;
  }

  const resetForm = () => {
    setEmail("");
    setRole({
      label: USER_ROLES.DIDE_DESIGNER,
      value: USER_ROLES.DIDE_DESIGNER,
    });
    setFaculty(null);
  };

  const handleCreate = async () => {
    if (!formIsValid || !role) return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          createLeaderUser({
            email: emailCheck.value,
            roleName: role.value,
            facultyId: faculty?.value,
          }),
        {
          successTitle: "Usuario registrado",
          successMessage:
            "El rol global quedó activo en Leaders Users. Si estaba inactivo, se reactivó.",
          errorTitle: "No se pudo registrar",
          errorMessage:
            "Verifica el correo, el rol en Dataverse y los permisos de la tabla.",
          onSuccess: async () => {
            setModalOpen(false);
            resetForm();
            setStatusFilter("active");
            await loadData();
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (row: LeaderUserRow) => {
    const confirmed = window.confirm(
      `¿Inactivar a ${row.email} con el rol "${row.roleName}"?\n\nEl usuario dejará de tener ese rol global. Puedes reactivarlo después.`,
    );
    if (!confirmed) return;

    await runAction(() => deactivateLeaderUser(row.id), {
      successTitle: "Usuario inactivado",
      successMessage:
        "El registro sigue en Leaders Users, pero ya no otorga el rol.",
      errorTitle: "No se pudo inactivar",
      errorMessage: "Intenta de nuevo o revisa permisos en Dataverse.",
      onSuccess: async () => {
        await loadData();
      },
    });
  };

  const handleActivate = async (row: LeaderUserRow) => {
    await runAction(() => activateLeaderUser(row.id), {
      successTitle: "Usuario reactivado",
      successMessage: "El rol global vuelve a estar activo para ese correo.",
      errorTitle: "No se pudo reactivar",
      errorMessage: "Intenta de nuevo o revisa permisos en Dataverse.",
      onSuccess: async () => {
        await loadData();
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios líderes"
        description="Asigna roles globales. Inactivar quita el acceso sin borrar el registro."
        badge="Administración"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <IoAddOutline size={16} />
            Agregar usuario
          </Button>
        }
      />

      <div className="inline-flex gap-1 rounded-xl border border-border bg-gray-50 p-1">
        {(
          [
            { id: "active", label: `Activos (${activeCount})` },
            { id: "inactive", label: `Inactivos (${inactiveCount})` },
            { id: "all", label: `Todos (${rows.length})` },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setStatusFilter(option.id)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              statusFilter === option.id
                ? "bg-white text-primary shadow-sm"
                : "text-muted hover:text-primary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <DataTable
        title="Registros en Leaders Users"
        subtitle={`${filteredRows.length} registro${filteredRows.length === 1 ? "" : "s"}`}
        columns={[
          { key: "email", header: "Correo" },
          { key: "roleName", header: "Rol" },
          { key: "facultyName", header: "Facultad" },
          {
            key: "isActive",
            header: "Estado",
            render: (row) => (
              <span
                className={clsx(
                  "inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                  row.isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-muted",
                )}
              >
                {row.isActive ? "Activo" : "Inactivo"}
              </span>
            ),
          },
          {
            key: "id",
            header: "Acciones",
            render: (row) =>
              row.isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDeactivate(row)}
                >
                  <IoBanOutline size={16} />
                  Inactivar
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleActivate(row)}
                >
                  <IoRefreshOutline size={16} />
                  Reactivar
                </Button>
              ),
          },
        ]}
        data={filteredRows}
        searchKeys={["email", "roleName", "facultyName"]}
        emptyMessage={
          statusFilter === "inactive"
            ? "No hay usuarios inactivos"
            : statusFilter === "active"
              ? "No hay usuarios activos"
              : "No hay usuarios registrados en Leaders Users"
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          if (submitting) return;
          setModalOpen(false);
          resetForm();
        }}
        title="Agregar usuario líder"
        size="md"
        preventClose={submitting}
      >
        <div className="space-y-4">
          <FormField
            label="Correo institucional"
            required
            error={email.trim() ? emailCheck.message : undefined}
            hint="Si el mismo correo+rol estaba inactivo, se reactivará automáticamente."
          >
            <EmailAutocomplete
              value={email}
              onChange={setEmail}
              placeholder="Buscar correo"
              invalid={Boolean(email.trim() && !emailCheck.ok)}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Rol" required>
            <Select
              options={roleOptions}
              value={role}
              onChange={setRole}
              placeholder="Selecciona rol"
              disabled={submitting}
            />
          </FormField>

          <FormField
            label="Facultad (opcional)"
            hint="Útil para acotar líderes o coordinadores a una facultad."
          >
            <Select
              options={facultyOptions}
              value={faculty}
              onChange={setFaculty}
              placeholder="Sin facultad"
              disabled={submitting}
            />
          </FormField>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={submitting || !formIsValid}
              onClick={() => void handleCreate()}
            >
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
        confirmLabel={feedback.type === "success" ? "Continuar" : "Entendido"}
      />
    </div>
  );
}

export default AdminLeaderUsersPage;
