import { useEffect, useMemo } from "react";

import { useAuth } from "../../global/hooks/useAuth";
import DataTable from "../../global/components/dataTable";
import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";

import { useCourses } from "../hooks/useCourses";
import { getCourseColumns } from "../constants/courseColumns";

import {
  isAdvisorRole,
  isDideDesignerRole,
  isValidatorRole,
} from "../mappers/courseMappers";

const roleToColumnRole = (role: string) => {
  if (isValidatorRole(role)) return "validator" as const;
  if (isAdvisorRole(role)) return "advisor" as const;
  if (isDideDesignerRole(role)) return "designer" as const;
  return "author" as const;
};

const CourseList = () => {
  const { user, currentRole } = useAuth();
  const { courses, loading, loadCourses } = useCourses(
    user?.email ?? "",
    currentRole,
  );

  const columns = useMemo(
    () => getCourseColumns(roleToColumnRole(currentRole)),
    [currentRole],
  );

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  return (
    <div>
      <PageHeader
        title="Mis Cursos"
        description="Procesos asignados a tu rol. La columna muestra cuántos materiales te tocan atender."
        badge="Gestión académica"
      />

      {loading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={columns}
          data={courses}
          pageSize={8}
          title="Listado de cursos"
          subtitle={`${courses.length} curso${courses.length !== 1 ? "s" : ""} asignado${courses.length !== 1 ? "s" : ""}`}
          searchPlaceholder="Buscar por curso, proceso o estado..."
          searchKeys={[
            "processName",
            "courseName",
            "status",
            "authorName",
            "modifiedOn",
          ]}
        />
      )}
    </div>
  );
};

export default CourseList;
