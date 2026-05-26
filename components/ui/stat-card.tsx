import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type StatColor = "orange" | "blue" | "green" | "purple";
type ChangeType = "up" | "down" | "neutral";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: ChangeType;
  icon?: React.ReactNode;
  color?: StatColor;
  className?: string;
}

const colorMap: Record<StatColor, { bg: string; iconBg: string; iconText: string }> = {
  orange: {
    bg: "from-orange-50 to-amber-50 border-orange-100",
    iconBg: "bg-orange-100",
    iconText: "text-orange-600",
  },
  blue: {
    bg: "from-blue-50 to-indigo-50 border-blue-100",
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
  },
  green: {
    bg: "from-green-50 to-emerald-50 border-green-100",
    iconBg: "bg-green-100",
    iconText: "text-green-600",
  },
  purple: {
    bg: "from-purple-50 to-violet-50 border-purple-100",
    iconBg: "bg-purple-100",
    iconText: "text-purple-600",
  },
};

const changeConfig: Record<
  ChangeType,
  { icon: React.ElementType; textClass: string; bgClass: string }
> = {
  up: { icon: TrendingUp, textClass: "text-green-700", bgClass: "bg-green-100" },
  down: { icon: TrendingDown, textClass: "text-red-700", bgClass: "bg-red-100" },
  neutral: { icon: Minus, textClass: "text-gray-600", bgClass: "bg-gray-100" },
};

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  color = "orange",
  className,
}: StatCardProps) {
  const colors = colorMap[color];
  const changeCfg = changeConfig[changeType];
  const ChangeIcon = changeCfg.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-5 shadow-sm flex flex-col gap-4",
        colors.bg,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-medium text-gray-500 truncate">{title}</span>
          <span className="text-2xl font-bold text-gray-900 tabular-nums tracking-tight">
            {value}
          </span>
        </div>
        {icon && (
          <div className={cn("flex items-center justify-center rounded-xl w-11 h-11 shrink-0", colors.iconBg)}>
            <span className={cn("w-5 h-5", colors.iconText)}>{icon}</span>
          </div>
        )}
      </div>

      {change && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              changeCfg.bgClass,
              changeCfg.textClass
            )}
          >
            <ChangeIcon className="w-3 h-3" />
            {change}
          </span>
          <span className="text-xs text-gray-400">vs last period</span>
        </div>
      )}
    </div>
  );
}

export type { StatCardProps, StatColor, ChangeType };
