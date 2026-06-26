import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus, BookingPaymentStatus, TripStatus } from "@/lib/api";

type AnyStatus = BookingStatus | TripStatus | PaymentStatus | BookingPaymentStatus | string;

const tone: Record<string, string> = {
  scheduled:      "text-muted-foreground border-border bg-surface-2",
  boarding:       "text-gold border-gold/30 bg-gold/10",
  in_transit:     "text-info border-info/30 bg-info/10",
  completed:      "text-foreground border-border-strong bg-surface-3",
  cancelled:      "text-destructive border-destructive/30 bg-destructive/10",
  pending:        "text-gold border-gold/30 bg-gold/10",
  confirmed:      "text-primary border-primary/30 bg-primary/10",
  authenticated:  "text-info border-info/30 bg-info/10",
  no_show:        "text-destructive border-destructive/30 bg-destructive/10",
  unpaid:         "text-gold border-gold/30 bg-gold/10",
  held_in_escrow: "text-info border-info/30 bg-info/10",
  released:       "text-foreground border-border-strong bg-surface-3",
  refunded:       "text-muted-foreground border-border bg-surface-2",
  escrow_held:    "text-info border-info/30 bg-info/10",
  initiated:      "text-gold border-gold/30 bg-gold/10",
  failed:         "text-destructive border-destructive/30 bg-destructive/10",
  // driver-role statuses
  approved:       "text-primary border-primary/30 bg-primary/10",
  disapproved:    "text-destructive border-destructive/30 bg-destructive/10",
  under_review:   "text-violet border-violet/30 bg-violet/10",
  onboarding:     "text-violet border-violet/30 bg-violet/10",
};

export function StatusPill({ status, className }: { status: AnyStatus; className?: string }) {
  const cls = tone[status] ?? "text-muted-foreground border-border bg-surface-2";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {String(status).replace(/_/g, " ")}
    </span>
  );
}

export function ComfortBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet",
        className,
      )}
    >
      {value}
    </span>
  );
}
