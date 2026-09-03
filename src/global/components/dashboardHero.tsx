import type { ReactNode } from "react";

interface DashboardHeroProps {
  userName: string;
  role: string;
  description: string;
  children?: ReactNode;
}

/**
 * Decoración abstracta a la derecha: arcos y planos geométricos.
 * Sin hojas; presencia suave para dar profundidad al banner.
 */
function HeroDecor({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 300"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMaxYMid meet"
    >
      <defs>
        <linearGradient id="heroArcFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#86C127" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="heroGlow" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#86C127" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#86C127" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Planos diagonales */}
      <path
        d="M180 0 L420 0 L420 300 L260 300 Z"
        fill="#001f1f"
        fillOpacity="0.35"
      />
      <path
        d="M240 0 L420 0 L420 300 L310 300 Z"
        fill="url(#heroArcFill)"
      />

      {/* Arcos concéntricos */}
      <path
        d="M140 300 A180 180 0 0 1 420 120"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1.25"
      />
      <path
        d="M180 300 A150 150 0 0 1 420 160"
        stroke="rgba(134,193,39,0.18)"
        strokeWidth="1.5"
      />
      <path
        d="M220 300 A120 120 0 0 1 420 195"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />

      {/* Círculos suaves */}
      <circle cx="340" cy="70" r="52" fill="url(#heroGlow)" />
      <circle
        cx="340"
        cy="70"
        r="52"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />
      <circle
        cx="340"
        cy="70"
        r="28"
        stroke="rgba(134,193,39,0.22)"
        strokeWidth="1"
      />
      <circle cx="300" cy="210" r="8" fill="rgba(134,193,39,0.35)" />
      <circle cx="325" cy="235" r="4" fill="rgba(255,255,255,0.25)" />
      <circle cx="355" cy="200" r="3" fill="rgba(255,255,255,0.18)" />

      {/* Líneas guía */}
      <line
        x1="280"
        y1="40"
        x2="400"
        y2="40"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />
      <line
        x1="300"
        y1="52"
        x2="390"
        y2="52"
        stroke="rgba(134,193,39,0.2)"
        strokeWidth="1"
      />
    </svg>
  );
}

function DashboardHero({
  userName,
  role,
  description,
  children,
}: DashboardHeroProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[#004848] to-[#002828] p-5 text-white shadow-[0_16px_40px_-18px_rgba(0,64,64,0.55)] sm:p-6 md:p-8">
      {/* Luz ambiental */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55% 70% at 0% 100%, rgba(134,193,39,0.16), transparent 55%), radial-gradient(ellipse 45% 50% at 100% 0%, rgba(255,255,255,0.08), transparent 50%)",
        }}
      />

      {/* Acento lateral izquierdo */}
      <div className="pointer-events-none absolute inset-y-5 left-0 w-1 rounded-r-full bg-gradient-to-b from-secondary via-secondary/70 to-transparent sm:inset-y-6 md:inset-y-8" />

      <HeroDecor className="pointer-events-none absolute -right-6 top-1/2 hidden h-[135%] w-auto -translate-y-1/2 opacity-90 sm:right-0 md:block" />

      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 max-w-xl pl-3 sm:pl-4 md:pr-8">
          <p className="text-sm font-medium tracking-wide text-white/65">
            {greeting},{" "}
            <span className="text-white/90">{userName}</span>
          </p>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
            Panel de {role}
          </h1>
          <div className="mt-2.5 h-0.5 w-14 rounded-full bg-secondary/80" />
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 line-clamp-3 sm:line-clamp-none">
            {description}
          </p>
        </div>

        {children && (
          <div className="relative z-10 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end [&_a]:w-full sm:[&_a]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardHero;
