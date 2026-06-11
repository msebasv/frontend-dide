import { Button as HeadlessButton } from "@headlessui/react";

import clsx from "clsx";

import type { ReactNode } from "react";

import { buttonVariants, buttonSizes } from "../styles/buttonVariants";

interface ButtonProps {
  children: ReactNode;

  variant?: "primary" | "secondary" | "danger" | "ghost";

  size?: "sm" | "md" | "lg";

  onClick?: () => void;

  disabled?: boolean;
}

function Button({
  children,

  variant = "primary",

  size = "md",

  onClick,

  disabled,
}: ButtonProps) {
  const baseStyles = `
    inline-flex
    items-center
    justify-center
    gap-2
    rounded-lg
    font-medium
    transition
    focus:outline-none
    disabled:opacity-50
  `;

  return (
    <HeadlessButton
      onClick={onClick}
      disabled={disabled}
      className={clsx(baseStyles, buttonVariants[variant], buttonSizes[size])}
    >
      {children}
    </HeadlessButton>
  );
}

export default Button;
