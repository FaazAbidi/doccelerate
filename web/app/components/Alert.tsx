import React from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "error" | "success" | "warning" | "info";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: React.ReactNode;
}

const variantStyles: Record<AlertVariant, string> = {
  error: "bg-accent/10 border-accent border-opacity-20 text-accent",
  success: "bg-success/10 border-success border-opacity-20 text-success",
  warning: "bg-primary/10 border-primary border-opacity-20 text-primary",
  info: "bg-info/10 border-info border-opacity-20 text-info",
};

const variantIcons: Record<AlertVariant, React.ReactNode> = {
  error: <AlertCircle className="h-5 w-5" />,
  success: <CheckCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>((
  { variant = "info", className, icon, children, ...props },
  ref
) => {
  return (
    <div
      ref={ref}
      className={cn(
        "border rounded-lg p-4 flex items-center space-x-2",
        variantStyles[variant],
        className
      )}
      role="alert"
      {...props}
    >
      <span className="shrink-0">{icon ?? variantIcons[variant]}</span>
      <div className="text-body-sm">{children}</div>
    </div>
  );
});

Alert.displayName = "Alert"; 