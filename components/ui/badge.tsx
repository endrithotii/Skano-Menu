import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "secondary";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-orange-100 text-orange-700 ring-orange-200/60",
  success: "bg-green-100 text-green-700 ring-green-200/60",
  warning: "bg-yellow-100 text-yellow-700 ring-yellow-200/60",
  danger: "bg-red-100 text-red-700 ring-red-200/60",
  secondary: "bg-gray-100 text-gray-600 ring-gray-200/60",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);

Badge.displayName = "Badge";

export { Badge };
export type { BadgeProps, BadgeVariant };
