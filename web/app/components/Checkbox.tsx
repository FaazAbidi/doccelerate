import React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="inline-flex items-center cursor-pointer select-none">
        <input
          type="checkbox"
          ref={ref}
          className="sr-only peer"
          {...props}
        />
        <span
          className={cn(
            "h-4 w-4 shrink-0 rounded-[4px] border border-neutral border-opacity-20 flex items-center justify-center transition-colors peer-disabled:opacity-50 peer-disabled:cursor-not-allowed peer-checked:bg-primary peer-checked:border-primary",
            className
          )}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
          >
            <path d="M4 8.5l3 3L12.5 6" />
          </svg>
        </span>
        {label && (
          <span className="ml-2 text-body-sm text-neutral select-none">
            {label}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox"; 