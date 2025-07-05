import React from "react";
import { cn } from "@/lib/utils";

export type LoaderVariant = "spinner" | "dots";

export interface CircularLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LoaderVariant;
  size?: number; // pixel size
  colorClass?: string;
}

export const CircularLoader: React.FC<CircularLoaderProps> = ({
  variant = "spinner",
  size = 24,
  colorClass = "text-primary",
  className,
  ...props
}) => {
  if (variant === "dots") {
    const dotStyle = { width: size / 4, height: size / 4 } as React.CSSProperties;
    return (
      <div className={cn("flex items-center space-x-1", className)} {...props}>
        <span
          style={dotStyle}
          className={cn(
            "rounded-full bg-current animate-bounce",
            colorClass,
            "[animation-delay:-0.3s]"
          )}
        />
        <span
          style={dotStyle}
          className={cn(
            "rounded-full bg-current animate-bounce",
            colorClass,
            "[animation-delay:-0.15s]"
          )}
        />
        <span
          style={dotStyle}
          className={cn("rounded-full bg-current animate-bounce", colorClass)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("inline-block animate-spin", colorClass, className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="10" className="opacity-25" />
        <path d="M22 12a10 10 0 0 1-10 10" className="opacity-75" />
      </svg>
    </div>
  );
};

CircularLoader.displayName = "CircularLoader"; 