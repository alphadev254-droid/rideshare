import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatMwk } from "@/lib/format";
import type { Payment } from "@/lib/api";
import { TransactionDetail } from "./transaction-detail";

export function TransactionList({
  transactions,
  detailBase,
  emptyText = "No transactions yet.",
  viewMode = "link",
  variant = "passenger",
}: {
  transactions: Payment[];
  detailBase: "/app/transactions/$id" | "/driver/transactions/$id" | "/admin/payments/$id";
  emptyText?: string;
  viewMode?: "link" | "dialog";
  variant?: "passenger" | "driver" | "admin";
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  if (variant === "admin") {
    return (
      <>
        <TransactionCards transactions={transactions} detailBase={detailBase} viewMode={viewMode} variant={variant} />
        <div className="hidden overflow-x-auto rounded-md border border-border bg-card lg:block">
          <Table className="min-w-[1500px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Passenger</TableHead>
              <TableHead className="whitespace-nowrap">Email</TableHead>
              <TableHead className="whitespace-nowrap">Phone</TableHead>
              <TableHead className="whitespace-nowrap">Driver</TableHead>
              <TableHead className="whitespace-nowrap">Trip</TableHead>
              <TableHead className="whitespace-nowrap text-right">Paid</TableHead>
              <TableHead className="whitespace-nowrap text-right">Tx Cost</TableHead>
              <TableHead className="whitespace-nowrap text-right">Tx Rate</TableHead>
              <TableHead className="whitespace-nowrap text-right">System Fee</TableHead>
              <TableHead className="whitespace-nowrap text-right">System Rate</TableHead>
              <TableHead className="whitespace-nowrap text-right">Driver Gets</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Paid At</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap">{tx.passengerName ?? "Passenger"}</TableCell>
                <TableCell className="max-w-56 truncate whitespace-nowrap">{tx.passengerEmail ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{tx.passengerPhone ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{tx.driverName ?? "Driver"}</TableCell>
                <TableCell className="max-w-72 truncate whitespace-nowrap">{tx.route ?? "Ride payment"}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{formatMwk(tx.customerAmountMwk)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{tx.providerFeeMwk ? formatMwk(tx.providerFeeMwk) : "-"}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{rate(tx.providerFeeRate)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{tx.systemFeeMwk ? formatMwk(tx.systemFeeMwk) : "-"}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{rate(tx.systemFeeRate)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{tx.driverAmountMwk ? formatMwk(tx.driverAmountMwk) : "-"}</TableCell>
                <TableCell className="whitespace-nowrap"><StatusPill status={tx.status} /></TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(tx.createdAt)}</TableCell>
                <TableCell className="text-right">{renderView(tx, detailBase, viewMode, variant)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </>
    );
  }

  if (variant === "driver") {
    return (
      <>
        <TransactionCards transactions={transactions} detailBase={detailBase} viewMode={viewMode} variant={variant} />
        <div className="hidden overflow-x-auto rounded-md border border-border bg-card lg:block">
          <Table className="min-w-[1120px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Passenger</TableHead>
              <TableHead className="whitespace-nowrap">Phone</TableHead>
              <TableHead className="whitespace-nowrap">Trip</TableHead>
              <TableHead className="whitespace-nowrap text-right">Fare</TableHead>
              <TableHead className="whitespace-nowrap text-right">System Fee</TableHead>
              <TableHead className="whitespace-nowrap text-right">System Rate</TableHead>
              <TableHead className="whitespace-nowrap text-right">You Get</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Paid At</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap">{tx.passengerName ?? "Passenger"}</TableCell>
                <TableCell className="whitespace-nowrap">{tx.passengerPhone ?? "-"}</TableCell>
                <TableCell className="max-w-80 truncate whitespace-nowrap">{tx.route ?? "Ride payment"}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{formatMwk(tx.fareAmountMwk)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{tx.systemFeeMwk ? formatMwk(tx.systemFeeMwk) : "-"}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{rate(tx.systemFeeRate)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{tx.driverAmountMwk ? formatMwk(tx.driverAmountMwk) : "-"}</TableCell>
                <TableCell className="whitespace-nowrap"><StatusPill status={tx.status} /></TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(tx.createdAt)}</TableCell>
                <TableCell className="text-right">{renderView(tx, detailBase, viewMode, variant)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <>
      <TransactionCards transactions={transactions} detailBase={detailBase} viewMode={viewMode} variant={variant} />
      <div className="hidden overflow-hidden rounded-md border border-border bg-card lg:block">
        <div className="divide-y divide-border">
        {transactions.map((tx) => (
          <div key={tx.id} className="grid gap-3 p-4 text-sm sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="font-medium">{tx.route ?? "Ride payment"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</div>
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{tx.gatewayRef ?? tx.id}</div>
              {tx.passengerName && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {tx.passengerName}
                  {tx.passengerPhone ? ` - ${tx.passengerPhone}` : ""}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Amount paid</div>
              <div className="font-semibold tabular">{formatMwk(tx.customerAmountMwk)}</div>
            </div>
            {tx.driverAmountMwk ? (
              <div>
                <div className="text-xs text-muted-foreground">Driver amount</div>
                <div className="font-semibold tabular">{formatMwk(tx.driverAmountMwk)}</div>
              </div>
            ) : (
              <div>
                <div className="text-xs text-muted-foreground">Transaction cost</div>
                <div className="font-semibold tabular">{tx.providerFeeMwk ? formatMwk(tx.providerFeeMwk) : "-"}</div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <StatusPill status={tx.status} />
              {renderView(tx, detailBase, viewMode, variant)}
            </div>
          </div>
        ))}
        </div>
      </div>
    </>
  );
}

function TransactionCards({
  transactions,
  detailBase,
  viewMode,
  variant,
}: {
  transactions: Payment[];
  detailBase: "/app/transactions/$id" | "/driver/transactions/$id" | "/admin/payments/$id";
  viewMode: "link" | "dialog";
  variant: "passenger" | "driver" | "admin";
}) {
  return (
    <div className="space-y-3 lg:hidden">
      {transactions.map((tx) => {
        const primaryAmount = (variant === "driver" ? tx.driverAmountMwk : tx.customerAmountMwk) ?? tx.customerAmountMwk;
        const primaryLabel = variant === "driver" ? "You get" : variant === "admin" ? "Paid" : "Amount paid";
        const person =
          variant === "passenger"
            ? tx.driverName
            : tx.passengerName;

        return (
          <article key={tx.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base font-semibold">
                  {tx.route ?? "Ride payment"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(tx.createdAt)}
                </div>
                <div className="mt-1.5">
                  <StatusPill status={tx.status} />
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                <div className="label-eyebrow">{primaryLabel}</div>
                <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-gold">
                  {formatMwk(primaryAmount)}
                </div>
                {renderView(tx, detailBase, viewMode, variant)}
              </div>
            </div>

            <div className="-mx-3 mt-3 space-y-1.5 border-t border-border px-3 pt-3 text-xs">
              {person && (
                <MobileField
                  label={variant === "passenger" ? "Driver" : "Passenger"}
                  value={person}
                />
              )}
              {variant === "driver" ? (
                <>
                  <MobileField label="Fare" value={formatMwk(tx.fareAmountMwk)} />
                  <MobileField label="System fee" value={tx.systemFeeMwk ? formatMwk(tx.systemFeeMwk) : "-"} />
                </>
              ) : (
                <>
                  <MobileField label="Tx cost" value={tx.providerFeeMwk ? formatMwk(tx.providerFeeMwk) : "-"} />
                  {tx.driverAmountMwk && <MobileField label="Driver gets" value={formatMwk(tx.driverAmountMwk)} />}
                </>
              )}
              <MobileField label="Reference" value={tx.gatewayRef ?? tx.id} mono />
            </div>

          </article>
        );
      })}
    </div>
  );
}

function MobileField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`min-w-0 truncate text-right font-medium ${mono ? "font-mono text-[11px]" : ""}`}>{value}</div>
    </div>
  );
}

function renderView(
  tx: Payment,
  detailBase: "/app/transactions/$id" | "/driver/transactions/$id" | "/admin/payments/$id",
  viewMode: "link" | "dialog",
  variant: "passenger" | "driver" | "admin",
) {
  if (viewMode === "dialog") {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">View</Button>
        </DialogTrigger>
          <DialogContent className="max-h-[88vh] max-w-[min(1100px,calc(100vw-2rem))] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction details</DialogTitle>
            </DialogHeader>
                    <TransactionDetail transaction={tx} variant={variant} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <a href={detailBase.replace("$id", tx.id)}>View</a>
    </Button>
  );
}

function rate(value?: string | null) {
  const num = Number(value ?? 0) * 100;
  if (!Number.isFinite(num) || num === 0) return "-";
  return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
}
