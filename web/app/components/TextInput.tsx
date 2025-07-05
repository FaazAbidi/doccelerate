import React from "react";
import { cn } from "@/lib/utils";

export type TextInputVariant = "outline" | "ghost" | "filled";
export type TextInputSize = "sm" | "md" | "lg";

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: TextInputVariant;
  size?: TextInputSize;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  error?: boolean;
}

const baseInputClasses =
  "block w-full bg-transparent text-neutral placeholder-neutral placeholder-opacity-60 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<TextInputVariant, string> = {
  outline: "border border-neutral border-opacity-20 focus:ring-primary",
  ghost: "border-transparent focus:ring-primary",
  filled: "bg-neutral/5 border-transparent focus:ring-primary",
};

const sizeClasses: Record<TextInputSize, string> = {
  sm: "py-2 text-body-sm rounded-[20px]",
  md: "py-3 text-body-md rounded-[20px]",
  lg: "py-4 text-body-lg rounded-[20px]",
};

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      className,
      variant = "outline",
      size = "md",
      leadingIcon,
      trailingIcon,
      error,
      ...props
    },
    ref
  ) => {
    const paddingLeft = leadingIcon ? "pl-10" : "pl-3";
    const paddingRight = trailingIcon ? "pr-10" : "pr-3";

    return (
      <div className={cn("relative", className)}>
        {leadingIcon && (
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            baseInputClasses,
            variantClasses[variant],
            sizeClasses[size],
            paddingLeft,
            paddingRight,
            error && "border-red-500 focus:ring-red-500"
          )}
          {...props}
        />
        {trailingIcon && (
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput"; 