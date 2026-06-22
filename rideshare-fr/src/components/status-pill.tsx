import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus, BookingPaymentStatus, TripStatus } from "@/lib/api";

type AnyStatus = BookingStatus | TripStatus | PaymentStatus | BookingPaymentStatus | string;

const tone: Record<string, string> = {
  scheduled: "text-muted-foreground border-border bg-surface-2",
  boarding: "text-gold border-gold/30 bg-gold/10",
  in_transit: "text-primary border-primary/30 bg-primary/10",
  completed: "text-foreground border-border-strong bg-surface-3",
  cancelled: "text-destructive border-destructive/30 bg-destructive/10",
  pending: "text-muted-foreground border-border bg-surface-2",
  confirmed: "text-primary border-primary/30 bg-primary/10",
  authenticated: "text-primary border-primary/30 bg-primary/10",
  no_show: "text-destructive border-destructive/30 bg-destructive/10",
  unpaid: "text-gold border-gold/30 bg-gold/10",
  held_in_escrow: "text-primary border-primary/30 bg-primary/10",
  released: "text-foreground border-border-strong bg-surface-3",
  refunded: "text-muted-foreground border-border bg-surface-2",
  escrow_held: "text-primary border-primary/30 bg-primary/10",
  initiated: "text-gold border-gold/30 bg-gold/10",
  failed: "text-destructive border-destructive/30 bg-destructive/10",
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
