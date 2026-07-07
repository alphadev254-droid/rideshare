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
import { useI18n } from "@/lib/i18n";

export function TransactionDetail({
  transaction,
  variant = "passenger",
}: {
  transaction: Payment;
  variant?: "passenger" | "driver" | "admin";
}) {
  const { t } = useI18n();
  const [jsonDialog, setJsonDialog] = useState<{ title: string; value: unknown } | null>(null);
  const isAdmin = variant === "admin";
  const showOperationalDetails = variant === "driver" || isAdmin;

  return (
    <>
      <div className="space-y-4">
        <section className="rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-eyebrow">{t("transactions.payment")}</p>
              <h2 className="mt-1 font-display text-xl font-semibold">{transaction.route ?? t("transactions.ridePayment")}</h2>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{transaction.gatewayRef ?? transaction.id}</p>
            </div>
            <StatusPill status={transaction.status} />
          </div>
        </section>

        <DetailSection title={t("transactions.amounts")}>
          <DetailItem label={t("transactions.customerPaid")} value={formatMwk(transaction.customerAmountMwk)} strong />
          <DetailItem label={t("transactions.rideFare")} value={formatMwk(transaction.fareAmountMwk)} />
          <DetailItem label={t("transactions.transactionCost")} value={`${formatMwk(transaction.providerFeeMwk)} (${rate(transaction.providerFeeRate)})`} />
          <DetailItem label={t("transactions.systemFee")} value={`${formatMwk(transaction.systemFeeMwk)} (${rate(transaction.systemFeeRate)})`} />
          <DetailItem label={t("transactions.driverReceives")} value={formatMwk(transaction.driverAmountMwk)} strong />
          <DetailItem label={t("transactions.grossAmount")} value={formatMwk(transaction.grossAmountMwk)} />
          <DetailItem label={t("transactions.commission")} value={`${formatMwk(transaction.commissionMwk)} (${rate(transaction.commissionRate)})`} />
          <DetailItem label={t("transactions.netAmount")} value={formatMwk(transaction.netAmountMwk)} />
        </DetailSection>

        <DetailSection title={t("transactions.people")}>
          <DetailItem label={t("transactions.passenger")} value={transaction.passengerName} />
          <DetailItem label={t("transactions.passengerPhone")} value={transaction.passengerPhone} />
          <DetailItem label={t("transactions.passengerEmail")} value={transaction.passengerEmail} />
          <DetailItem label={t("transactions.passengerId")} value={showOperationalDetails ? transaction.passengerId : null} wide />
          <DetailItem label={t("transactions.driver")} value={transaction.driverName} />
          <DetailItem label={t("transactions.driverId")} value={showOperationalDetails ? transaction.driverId : null} wide />
        </DetailSection>

        <DetailSection title={t("transactions.tripBooking")}>
          <DetailItem label={t("transactions.route")} value={transaction.route} wide />
          <DetailItem label={t("transactions.from")} value={transaction.originName} />
          <DetailItem label={t("transactions.to")} value={transaction.destinationName} />
          <DetailItem label={t("transactions.departure")} value={formatDateTime(transaction.departureTime)} />
          <DetailItem label={t("transactions.bookingId")} value={showOperationalDetails ? transaction.bookingId : null} wide />
        </DetailSection>

        <DetailSection title={t("transactions.gateway")}>
          <DetailItem label={t("transactions.paymentMethod")} value={transaction.paymentMethod?.replaceAll("_", " ")} />
          <DetailItem label={t("transactions.status")} value={transaction.status} />
          <DetailItem label={t("transactions.paymentId")} value={transaction.id} wide />
          <DetailItem label={t("transactions.gatewayRef")} value={transaction.gatewayRef} wide />
          <DetailItem label={t("transactions.providerRef")} value={transaction.providerReference} wide />
        </DetailSection>

        <DetailSection title={t("transactions.timeline")}>
          <DetailItem label={t("transactions.created")} value={formatDateTime(transaction.createdAt)} />
          <DetailItem label={t("transactions.verified")} value={formatDateTime(transaction.verifiedAt)} />
          <DetailItem label={t("transactions.heldEscrow")} value={formatDateTime(transaction.escrowHeldAt)} />
          <DetailItem label={t("transactions.released")} value={formatDateTime(transaction.releasedAt)} />
          <DetailItem label={t("transactions.refunded")} value={formatDateTime(transaction.refundedAt)} />
        </DetailSection>

        {isAdmin && jsonCell(transaction.providerPayload) !== "-" ? (
          <section className="rounded-md border border-border bg-card p-4">
            <h3 className="label-eyebrow mb-3">{t("transactions.rawGatewayData")}</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJsonDialog({ title: t("transactions.providerPayload"), value: transaction.providerPayload })}
            >
              {t("transactions.viewPayloadJson")}
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
