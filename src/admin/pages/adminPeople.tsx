/**
 * Directorio “quién es quién”: roles globales y por proceso (solo Administrador).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoFilterOutline,
  IoPeopleOutline,
  IoSearchOutline,
} from "react-icons/io5";
import clsx from "clsx";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";
import Select from "../../global/components/select";
import { useAuth } from "../../global/hooks/useAuth";
import { isAdminRole } from "../../global/constants/domainConstants";
import {
  collectPeopleFilterOptions,
  getPeopleDirectory,
  type PersonDirectoryEntry,
} from "../services/peopleDirectoryService";

type SelectOption = { label: string; value: string };

const ALL_OPTION: SelectOption = { label: "Todos", value: "all" };

function PersonCard({ person }: { person: PersonDirectoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const title = person.displayName || person.email;
  const processCount = person.processRoles.length;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-primary">{title}</h3>
          {person.displayName ? (
            <p className="truncate text-xs text-muted">{person.email}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {person.globalRoles.length === 0 &&
            person.processRoles.length === 0 ? (
              <span className="text-xs text-muted">Sin roles</span>
            ) : null}

            {person.globalRoles.map((role) => (
              <span
                key={`${role.leaderUserId}-${role.roleName}`}
                className="inline-flex items-center rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white"
                title={
                  role.facultyName !== "—"
                    ? `Global · ${role.facultyName}`
                    : "Rol global (Leaders Users)"
                }
              >
                {role.roleName}
                {role.facultyName !== "—" ? ` · ${role.facultyName}` : ""}
              </span>
            ))}

            {!expanded &&
              person.processRoles.slice(0, 4).map((role) => (
                <span
                  key={role.assignRoleId}
                  className="inline-flex max-w-full items-center truncate rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-primary"
                  title={`${role.roleName} · ${role.processName}`}
                >
                  {role.roleName}
                </span>
              ))}

            {!expanded && processCount > 4 ? (
              <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-muted">
                +{processCount - 4} en procesos
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted">
            {person.globalRoles.length} global
            {person.globalRoles.length === 1 ? "" : "es"} · {processCount}{" "}
            proceso{processCount === 1 ? "" : "s"}
          </span>
          {processCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <>
                  <IoChevronUpOutline size={16} />
                  Ocultar
                </>
              ) : (
                <>
                  <IoChevronDownOutline size={16} />
                  Detalle
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {expanded && processCount > 0 ? (
        <div className="border-t border-border bg-gray-50/80 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Asignaciones por proceso
          </p>
          <ul className="space-y-2">
            {person.processRoles.map((role) => (
              <li
                key={role.assignRoleId}
                className="flex flex-col gap-1 rounded-lg border border-border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {role.roleName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {role.processName} · {role.courseName} · {role.facultyName}
                  </p>
                </div>
                <Link
                  to={`/virtualization-processes/${role.processId}`}
                  className="shrink-0 text-xs font-semibold text-secondary hover:underline"
                >
                  Ver proceso
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function AdminPeoplePage() {
  const { currentRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<PersonDirectoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<SelectOption | null>(ALL_OPTION);
  const [facultyFilter, setFacultyFilter] = useState<SelectOption | null>(
    ALL_OPTION,
  );
  const [processFilter, setProcessFilter] = useState<SelectOption | null>(
    ALL_OPTION,
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPeopleDirectory();
      setPeople(data);
    } catch (error) {
      console.error("Error cargando directorio de personas", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filterOptions = useMemo(
    () => collectPeopleFilterOptions(people),
    [people],
  );

  const roleOptions = useMemo(
    () => [
      ALL_OPTION,
      ...filterOptions.roles.map((role) => ({ label: role, value: role })),
    ],
    [filterOptions.roles],
  );

  const facultyOptions = useMemo(
    () => [
      ALL_OPTION,
      ...filterOptions.faculties.map((faculty) => ({
        label: faculty.name,
        value: faculty.id,
      })),
    ],
    [filterOptions.faculties],
  );

  const processOptions = useMemo(
    () => [
      ALL_OPTION,
      ...filterOptions.processes.map((process) => ({
        label: process.name,
        value: process.id,
      })),
    ],
    [filterOptions.processes],
  );

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    const roleValue = roleFilter?.value ?? "all";
    const facultyValue = facultyFilter?.value ?? "all";
    const processValue = processFilter?.value ?? "all";

    return people.filter((person) => {
      if (query) {
        const haystack = `${person.displayName} ${person.email}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (roleValue !== "all") {
        const hasGlobal = person.globalRoles.some(
          (role) => role.roleName === roleValue,
        );
        const hasProcess = person.processRoles.some(
          (role) => role.roleName === roleValue,
        );
        if (!hasGlobal && !hasProcess) return false;
      }

      if (facultyValue !== "all") {
        const hasGlobal = person.globalRoles.some(
          (role) => role.facultyId === facultyValue,
        );
        const hasProcess = person.processRoles.some(
          (role) => role.facultyId === facultyValue,
        );
        if (!hasGlobal && !hasProcess) return false;
      }

      if (processValue !== "all") {
        const hasProcess = person.processRoles.some(
          (role) => role.processId === processValue,
        );
        if (!hasProcess) return false;
      }

      return true;
    });
  }, [people, search, roleFilter, facultyFilter, processFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    (roleFilter?.value ?? "all") !== "all" ||
    (facultyFilter?.value ?? "all") !== "all" ||
    (processFilter?.value ?? "all") !== "all";

  const clearFilters = () => {
    setSearch("");
    setRoleFilter(ALL_OPTION);
    setFacultyFilter(ALL_OPTION);
    setProcessFilter(ALL_OPTION);
  };

  if (!isAdminRole(currentRole)) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingState message="Cargando personas y roles..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personas y roles"
        description="Quién es quién: roles globales (Leaders Users) y asignaciones por proceso"
        badge="Administración"
        actions={
          <Link to="/admin/leader-users">
            <Button variant="secondary" size="sm">
              <IoPeopleOutline size={16} />
              Usuarios líderes
            </Button>
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <IoFilterOutline size={16} />
          Filtros
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 lg:col-span-1">
            <span className="text-xs font-medium text-muted">Buscar</span>
            <div className="relative">
              <IoSearchOutline
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre o correo"
                className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-primary focus:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Rol</span>
            <Select
              options={roleOptions}
              value={roleFilter}
              onChange={setRoleFilter}
              placeholder="Todos"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Facultad</span>
            <Select
              options={facultyOptions}
              value={facultyFilter}
              onChange={setFacultyFilter}
              placeholder="Todas"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Proceso</span>
            <Select
              options={processOptions}
              value={processFilter}
              onChange={setProcessFilter}
              placeholder="Todos"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            Mostrando{" "}
            <span className="font-semibold text-primary">
              {filteredPeople.length}
            </span>{" "}
            de {people.length} persona{people.length === 1 ? "" : "s"}
          </p>
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {filteredPeople.length === 0 ? (
        <div
          className={clsx(
            "rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center",
          )}
        >
          <p className="text-sm font-semibold text-primary">
            No hay personas con esos filtros
          </p>
          <p className="mt-1 text-xs text-muted">
            Prueba otra búsqueda o limpia los filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPeople.map((person) => (
            <PersonCard key={person.email} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminPeoplePage;
