import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../global/hooks/useAuth";
import DataTable from "../../global/components/dataTable";
import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import ProcessStatusFilterTabs, {
  countByProcessStatusTab,
  filterByProcessStatusTab,
  processStatusTabTitle,
  type ProcessStatusFilterTab,
} from "../../global/components/processStatusFilterTabs";

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
  const [activeTab, setActiveTab] = useState<ProcessStatusFilterTab>("all");

  const columns = useMemo(
    () => getCourseColumns(roleToColumnRole(currentRole)),
    [currentRole],
  );

  const tabCounts = useMemo(
    () => countByProcessStatusTab(courses, (course) => course.status),
    [courses],
  );

  const filteredCourses = useMemo(
    () =>
      filterByProcessStatusTab(courses, activeTab, (course) => course.status),
    [courses, activeTab],
  );

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  return (
    <div>
      <PageHeader
        title="Mis Cursos"
        description="Procesos asignados a su rol. La columna indica cuántos materiales están en su estado y cómo se reparte el resto."
        badge="Gestión académica"
      />

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          <ProcessStatusFilterTabs
            activeTab={activeTab}
            counts={tabCounts}
            onChange={setActiveTab}
          />

          <DataTable
            columns={columns}
            data={filteredCourses}
            pageSize={8}
            title={processStatusTabTitle(activeTab, "cursos")}
            subtitle={`${filteredCourses.length} curso${filteredCourses.length !== 1 ? "s" : ""}`}
            searchPlaceholder="Buscar por curso, proceso o estado..."
            searchKeys={[
              "processName",
              "courseName",
              "status",
              "authorName",
              "modifiedOn",
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default CourseList;
