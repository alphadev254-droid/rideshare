import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: "primary" | "gold" | "default";
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "default",
  className,
  ...rest
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-md border bg-card p-5 transition-colors hover:border-border-strong",
        className,
      )}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-eyebrow">{label}</span>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              accent === "primary" && "bg-primary/10 text-primary",
              accent === "gold" && "bg-gold/10 text-gold",
              accent === "default" && "bg-surface-3 text-muted-foreground",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tabular tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
