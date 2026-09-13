import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  IoCloudUploadOutline,
  IoCreateOutline,
} from "react-icons/io5";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";

import { useAuth } from "../../global/hooks/useAuth";
import { useCourseDetail } from "../../courses/hooks/useCourseDetail";
import CourseDetailView from "../../courses/components/courseDetailView";
import {
  canUserUploadStatus,
  isLeaderSyllabusStatus,
} from "../../courses/mappers/courseMappers";
import { isLeaderRole } from "../../global/constants/domainConstants";

const ViewProcess = () => {
  const { processId } = useParams<{ processId: string }>();
  const { currentRole } = useAuth();
  const { detail, loading, loadDetail } = useCourseDetail();

  useEffect(() => {
    if (processId) void loadDetail(processId);
  }, [processId, loadDetail]);

  const canUpload = useMemo(() => {
    if (!detail) return false;
    if (canUserUploadStatus(currentRole, detail.status)) return true;
    // Gestión (líder / coordinador / admin) en fase de syllabus
    return isLeaderRole(currentRole) && isLeaderSyllabusStatus(detail.status);
  }, [currentRole, detail]);

  if (loading || !detail) {
    return <LoadingState message="Cargando detalle del proceso..." />;
  }

  return (
    <div>
      <PageHeader
        title="Ver Proceso"
        description={
          canUpload
            ? `${detail.processName} — Carga el syllabus para pasar el proceso al autor`
            : detail.processName
        }
        backTo="/virtualization-processes"
        badge={canUpload ? "Syllabus pendiente" : undefined}
        actions={
          <>
            {canUpload && processId && (
              <Link to={`/courses/${processId}/upload`}>
                <Button size="sm">
                  <IoCloudUploadOutline size={16} />
                  Cargar syllabus
                </Button>
              </Link>
            )}
            <Link to={`/virtualization-processes/${processId}/edit`}>
              <Button variant="secondary" size="sm">
                <IoCreateOutline size={16} />
                Editar proceso
              </Button>
            </Link>
          </>
        }
      />

      <CourseDetailView detail={detail} />
    </div>
  );
};

export default ViewProcess;
