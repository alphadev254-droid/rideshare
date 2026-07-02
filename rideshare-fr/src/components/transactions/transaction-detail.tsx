import { useState, type ReactNode } from "react";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatMwk } from "@/lib/format";
import type { Payment } from "@/lib/api";

export function TransactionDetail({
  transaction,
  variant = "passenger",
}: {
  transaction: Payment;
  variant?: "passenger" | "driver" | "admin";
}) {
  const [jsonDialog, setJsonDialog] = useState<{ title: string; value: unknown } | null>(null);
  const isAdmin = variant === "admin";
  const showOperationalDetails = variant === "driver" || isAdmin;

  return (
    <>
      <div className="space-y-4">
        <section className="rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-eyebrow">Payment</p>
              <h2 className="mt-1 font-display text-xl font-semibold">{transaction.route ?? "Ride payment"}</h2>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{transaction.gatewayRef ?? transaction.id}</p>
            </div>
            <StatusPill status={transaction.status} />
          </div>
        </section>

        <DetailSection title="Amounts">
          <DetailItem label="Customer paid" value={formatMwk(transaction.customerAmountMwk)} strong />
          <DetailItem label="Ride fare" value={formatMwk(transaction.fareAmountMwk)} />
          <DetailItem label="Transaction cost" value={`${formatMwk(transaction.providerFeeMwk)} (${rate(transaction.providerFeeRate)})`} />
          <DetailItem label="System fee" value={`${formatMwk(transaction.systemFeeMwk)} (${rate(transaction.systemFeeRate)})`} />
          <DetailItem label="Driver receives" value={formatMwk(transaction.driverAmountMwk)} strong />
          <DetailItem label="Gross amount" value={formatMwk(transaction.grossAmountMwk)} />
          <DetailItem label="Commission" value={`${formatMwk(transaction.commissionMwk)} (${rate(transaction.commissionRate)})`} />
          <DetailItem label="Net amount" value={formatMwk(transaction.netAmountMwk)} />
        </DetailSection>

        <DetailSection title="People">
          <DetailItem label="Passenger" value={transaction.passengerName} />
          <DetailItem label="Passenger phone" value={transaction.passengerPhone} />
          <DetailItem label="Passenger email" value={transaction.passengerEmail} />
          <DetailItem label="Passenger ID" value={showOperationalDetails ? transaction.passengerId : null} wide />
          <DetailItem label="Driver" value={transaction.driverName} />
          <DetailItem label="Driver ID" value={showOperationalDetails ? transaction.driverId : null} wide />
        </DetailSection>

        <DetailSection title="Trip and booking">
          <DetailItem label="Route" value={transaction.route} wide />
          <DetailItem label="From" value={transaction.originName} />
          <DetailItem label="To" value={transaction.destinationName} />
          <DetailItem label="Departure" value={formatDateTime(transaction.departureTime)} />
          <DetailItem label="Booking ID" value={showOperationalDetails ? transaction.bookingId : null} wide />
        </DetailSection>

        <DetailSection title="Gateway">
          <DetailItem label="Payment method" value={transaction.paymentMethod?.replaceAll("_", " ")} />
          <DetailItem label="Status" value={transaction.status} />
          <DetailItem label="Payment ID" value={transaction.id} wide />
          <DetailItem label="Gateway ref" value={transaction.gatewayRef} wide />
          <DetailItem label="Provider ref" value={transaction.providerReference} wide />
        </DetailSection>

        <DetailSection title="Timeline">
          <DetailItem label="Created" value={formatDateTime(transaction.createdAt)} />
          <DetailItem label="Verified" value={formatDateTime(transaction.verifiedAt)} />
          <DetailItem label="Held in escrow" value={formatDateTime(transaction.escrowHeldAt)} />
          <DetailItem label="Released" value={formatDateTime(transaction.releasedAt)} />
          <DetailItem label="Refunded" value={formatDateTime(transaction.refundedAt)} />
        </DetailSection>

        {isAdmin && jsonCell(transaction.providerPayload) !== "-" ? (
          <section className="rounded-md border border-border bg-card p-4">
            <h3 className="label-eyebrow mb-3">Raw gateway data</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJsonDialog({ title: "Payment provider payload", value: transaction.providerPayload })}
            >
              View payload JSON
            </Button>
          </section>
        ) : null}
      </div>

      <JsonViewerDialog
        title={jsonDialog?.title}
        value={jsonDialog?.value}
        open={Boolean(jsonDialog)}
        onOpenChange={(open) => {
          if (!open) setJsonDialog(null);
        }}
      />
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h3 className="label-eyebrow mb-3">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  strong = false,
  wide = false,
}: {
  label: string;
  value?: string | null;
  strong?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border border-border bg-surface p-2 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <p className="label-eyebrow">{label}</p>
      <p className={`mt-1 break-words text-sm ${strong ? "font-display text-lg font-semibold" : ""}`}>{value || "-"}</p>
    </div>
  );
}

function JsonViewerDialog({
  title,
  value,
  open,
  onOpenChange,
}: {
  title?: string;
  value: unknown;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Payload"}</DialogTitle>
        </DialogHeader>
        <pre className="max-h-[65vh] overflow-auto rounded-md border border-border bg-surface-2 p-3 text-xs leading-relaxed text-foreground">
          {prettyJson(value)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function rate(value?: string | null) {
  const num = Number(value ?? 0) * 100;
  if (!Number.isFinite(num) || num === 0) return "-";
  return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
}

function jsonCell(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" && value.length === 0) return "-";
  if (typeof value === "object" && Object.keys(value as Record<string, unknown>).length === 0) return "-";
  return "value";
}

function prettyJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
