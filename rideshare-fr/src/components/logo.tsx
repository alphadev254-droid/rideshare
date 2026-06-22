import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary">
        <span className="absolute inset-1 rounded-sm border border-primary-foreground/40" />
        <span className="relative font-display text-xs font-bold text-primary-foreground">RS</span>
      </span>
      <span className="font-display text-base font-semibold tracking-tight">
        RideShare<span className="text-primary">·</span>Malawi
      </span>
    </div>
  );
}
