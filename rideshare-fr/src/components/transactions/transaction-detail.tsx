import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatMwk } from "@/lib/format";
import type { Payment } from "@/lib/api";

export function TransactionDetail({
  transaction,
  variant = "passenger",
}: {
  transaction: Payment;
  variant?: "passenger" | "driver" | "admin";
}) {
  const showOperationalDetails = variant === "driver" || variant === "admin";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-md border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{transaction.route ?? "Ride payment"}</h2>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{transaction.gatewayRef ?? transaction.id}</p>
          </div>
          <StatusPill status={transaction.status} />
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Customer paid" value={formatMwk(transaction.customerAmountMwk)} strong />
          <Field label="Ride fare" value={formatMwk(transaction.fareAmountMwk)} />
          {transaction.providerFeeMwk && (
            <Field label="Transaction cost" value={`${formatMwk(transaction.providerFeeMwk)} (${rate(transaction.providerFeeRate)})`} />
          )}
          {transaction.systemFeeMwk && (
            <Field label="System fee" value={`${formatMwk(transaction.systemFeeMwk)} (${rate(transaction.systemFeeRate)})`} />
          )}
          {transaction.driverAmountMwk && (
            <Field label="Driver receives" value={formatMwk(transaction.driverAmountMwk)} strong />
          )}
          <Field label="Payment method" value={transaction.paymentMethod.replaceAll("_", " ")} />
          {transaction.passengerName && <Field label="Passenger" value={transaction.passengerName} />}
          {transaction.passengerEmail && <Field label="Passenger email" value={transaction.passengerEmail} />}
          {transaction.passengerPhone && <Field label="Passenger phone" value={transaction.passengerPhone} />}
          {transaction.driverName && <Field label="Driver" value={transaction.driverName} />}
          {transaction.originName && <Field label="From" value={transaction.originName} />}
          {transaction.destinationName && <Field label="To" value={transaction.destinationName} />}
          <Field label="Departure" value={formatDateTime(transaction.departureTime)} />
          <Field label="Created" value={formatDateTime(transaction.createdAt)} />
          <Field label="Verified" value={formatDateTime(transaction.verifiedAt)} />
          {showOperationalDetails && transaction.bookingId && <Field label="Booking ID" value={transaction.bookingId} />}
          {showOperationalDetails && <Field label="Transaction ID" value={transaction.id} />}
          {showOperationalDetails && transaction.gatewayRef && <Field label="Gateway ref" value={transaction.gatewayRef} />}
          {showOperationalDetails && transaction.providerReference && <Field label="Provider ref" value={transaction.providerReference} />}
        </dl>
      </section>

      <aside className="rounded-md border border-border bg-card p-5">
        <h3 className="label-eyebrow">Timeline</h3>
        <div className="mt-4 space-y-3 text-sm">
          <Timeline label="Created" value={transaction.createdAt} />
          <Timeline label="Verified" value={transaction.verifiedAt} />
          {showOperationalDetails && <Timeline label="Held in escrow" value={transaction.escrowHeldAt} />}
          {showOperationalDetails && <Timeline label="Released" value={transaction.releasedAt} />}
          {showOperationalDetails && <Timeline label="Refunded" value={transaction.refundedAt} />}
        </div>
      </aside>
    </div>
  );
}

function rate(value?: string | null) {
  const num = Number(value ?? 0) * 100;
  if (!Number.isFinite(num) || num === 0) return "-";
  return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
}

function Field({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words ${strong ? "font-display text-lg font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

function Timeline({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatDateTime(value)}</span>
    </div>
  );
}
