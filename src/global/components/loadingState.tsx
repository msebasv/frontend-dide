function LoadingState({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-acacia-5" />
          <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-secondary border-r-secondary/40" />
        </div>
        <p className="text-sm font-medium text-muted">{message}</p>
      </div>
    </div>
  );
}

export default LoadingState;
