import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { IoCreateOutline, IoTimeOutline } from "react-icons/io5";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import Button from "../../global/components/button";

import { useCourseDetail } from "../../courses/hooks/useCourseDetail";
import CourseDetailView from "../../courses/components/courseDetailView";

const ViewProcess = () => {
  const { processId } = useParams<{ processId: string }>();
  const { detail, loading, loadDetail } = useCourseDetail();

  useEffect(() => {
    if (processId) void loadDetail(processId);
  }, [processId, loadDetail]);

  if (loading || !detail) {
    return <LoadingState message="Cargando detalle del proceso..." />;
  }

  return (
    <div>
      <PageHeader
        title="Ver Proceso"
        description={detail.processName}
        backTo="/virtualization-processes"
        actions={
          <>
            <Link to={`/virtualization-processes/${processId}/edit`}>
              <Button variant="secondary" size="sm">
                <IoCreateOutline size={16} />
                Editar proceso
              </Button>
            </Link>
            <Link to={`/history/${processId}`}>
              <Button variant="secondary" size="sm">
                <IoTimeOutline size={16} />
                Ver historial
              </Button>
            </Link>
          </>
        }
      />

      <CourseDetailView
        detail={detail}
        historyLink={`/history/${processId}`}
      />
    </div>
  );
};

export default ViewProcess;
