import React from "react";

import { cn } from "@/lib/utils";
import { CircularLoader } from "./CircularLoader";

// Button variants matching the project theme
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "link";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon displayed before the button label */
  leadingIcon?: React.ReactNode;
  /** Icon displayed after the button label */
  trailingIcon?: React.ReactNode;
  /** Whether the button is in a loading state */
  loading?: boolean;
}

// Base styles shared by all buttons
const baseClasses =
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none";

// Variant-specific classes
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary/90",
  secondary: "bg-accent text-white hover:bg-accent/90",
  outline: "border border-primary text-primary hover:bg-primary hover:text-white",
  ghost: "bg-transparent text-primary hover:bg-primary/10",
  link: "bg-transparent text-primary underline-offset-4 hover:underline",
};

// Size-specific classes
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-body-sm rounded-[20px]",
  md: "h-10 px-4 text-body-md rounded-[20px]",
  lg: "h-11 px-8 text-body-lg rounded-[20px]",
};

// Map button size to a reasonable loader size
const loaderSizeMap: Record<ButtonSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      children,
      leadingIcon,
      trailingIcon,
      loading = false,
      disabled,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className,
          "gap-2"
        )}
        {...rest}
      >
        {loading ? (
          <span className="flex items-center">
            <CircularLoader
              size={loaderSizeMap[size]}
              colorClass={
                variant === "primary" || variant === "secondary"
                  ? "text-white"
                  : "text-primary"
              }
            />
          </span>
        ) : (
          leadingIcon && <span className="flex items-center">{leadingIcon}</span>
        )}
        {children}
        {!loading && trailingIcon && (
          <span className="flex items-center">{trailingIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
