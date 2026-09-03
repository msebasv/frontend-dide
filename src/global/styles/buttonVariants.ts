export const buttonVariants = {
  /** Buttons · Color Base Acacia */
  primary: `
    bg-secondary
    text-white
    shadow-sm
    hover:bg-secondary-light
    hover:shadow-md
    active:scale-[0.98]
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-secondary/40
    focus-visible:ring-offset-2
  `,

  /** Botón sólido primario oscuro (#004040) */
  secondary: `
    bg-primary
    text-white
    shadow-sm
    hover:bg-primary-light
    hover:shadow-md
    active:scale-[0.98]
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-primary/30
    focus-visible:ring-offset-2
  `,

  /** Outline — borde primario */
  outline: `
    bg-white
    text-primary
    border
    border-primary
    shadow-sm
    hover:bg-acacia-10
    active:scale-[0.98]
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-primary/20
    focus-visible:ring-offset-2
  `,

  /** Sobre fondos oscuros (banner hero) */
  soft: `
    bg-white/12
    text-white
    border
    border-white/35
    shadow-sm
    hover:bg-white/20
    active:scale-[0.98]
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-white/40
    focus-visible:ring-offset-2
    focus-visible:ring-offset-primary
  `,

  danger: `
    bg-danger
    text-white
    shadow-sm
    hover:opacity-90
    active:scale-[0.98]
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-danger/40
    focus-visible:ring-offset-2
  `,

  ghost: `
    bg-transparent
    text-muted
    hover:bg-acacia-10
    hover:text-primary
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-primary/15
    focus-visible:ring-offset-1
  `,
};

export const buttonSizes = {
  sm: `
    px-3.5
    py-1.5
    text-xs
    rounded-full
  `,

  md: `
    px-5
    py-2.5
    text-sm
    rounded-full
  `,

  lg: `
    px-6
    py-3
    text-base
    rounded-full
  `,
};
