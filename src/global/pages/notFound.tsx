import { Link } from "react-router-dom";
import { IoHomeOutline } from "react-icons/io5";
import Button from "../components/button";

/**
 * Ruta no registrada. Sustituye el regreso silencioso al inicio.
 */
function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface px-6 py-10 text-center shadow-[var(--shadow-card)] sm:px-10">
        <p className="text-sm font-semibold tracking-wide text-secondary">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold text-primary sm:text-2xl">
          Esta página no existe
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          La dirección no corresponde a una sección de AcademicPlus. Puede
          volver al inicio y continuar desde allí.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/">
            <Button>
              <IoHomeOutline size={16} />
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
