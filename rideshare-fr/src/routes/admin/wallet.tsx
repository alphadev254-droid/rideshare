import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, Search, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  walletService,
  extractApiError,
  type AdminWalletTransaction,
  type AdminWalletWithdrawal,
} from "@/lib/api";
import { formatDateTime, formatMwk } from "@/lib/format";

export const Route = createFileRoute("/admin/wallet")({
  component: AdminWalletPage,
});

function AdminWalletPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "credit" | "withdrawal">("all");
  const [status, setStatus] = useState("all");
  const [jsonDialog, setJsonDialog] = useState<{ title: string; value: unknown } | null>(null);

  const transactions = useQuery({
    queryKey: ["wallet", "admin", "transactions", search, type, status],
    queryFn: () =>
      walletService.adminTransactions({
        limit: 100,
        search: search || undefined,
        type,
        status,
      }),
  });

  const withdrawals = useQuery({
    queryKey: ["wallet", "admin", "withdrawals", search, status],
    queryFn: () =>
      walletService.adminWithdrawals({
        limit: 100,
        search: search || undefined,
        status,
      }),
  });

  const reconcile = useMutation({
    mutationFn: (id: string) => walletService.reconcileWithdrawal(id),
    onSuccess: () => {
      toast.success("Reconciliation request completed");
      queryClient.invalidateQueries({ queryKey: ["wallet", "admin"] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Wallet"
        description="Driver wallet ledger, withdrawal gateway status and manual PayChangu reconciliation."
      />

      <div className="grid gap-3 rounded-md border border-border bg-card p-3 lg:grid-cols-[1fr_180px_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search driver, phone, reference or charge ID"
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="withdrawal">Withdrawal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Gateway pending</SelectItem>
            <SelectItem value="request_uncertain">Request uncertain</SelectItem>
            <SelectItem value="timeout_waiting_for_webhook">Timed out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Wallet transactions</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          {transactions.isLoading ? (
            <LoadingState />
          ) : (
            <WalletTransactionsTable
              rows={transactions.data?.items ?? []}
              onViewJson={(title, value) => setJsonDialog({ title, value })}
            />
          )}
        </TabsContent>

        <TabsContent value="withdrawals">
          {withdrawals.isLoading ? (
            <LoadingState />
          ) : (
            <WithdrawalsTable
              rows={withdrawals.data?.items ?? []}
              onReconcile={(id) => reconcile.mutate(id)}
              onViewJson={(title, value) => setJsonDialog({ title, value })}
              reconcilingId={reconcile.variables}
              isReconciling={reconcile.isPending}
            />
          )}
        </TabsContent>
      </Tabs>

      <JsonViewerDialog
        title={jsonDialog?.title}
        value={jsonDialog?.value}
        open={Boolean(jsonDialog)}
        onOpenChange={(open) => {
          if (!open) setJsonDialog(null);
        }}
      />
    </div>
  );
}

function WalletTransactionsTable({
  rows,
  onViewJson,
}: {
  rows: AdminWalletTransaction[];
  onViewJson: (title: string, value: unknown) => void;
}) {
  if (rows.length === 0) return <EmptyWalletState label="No wallet transactions found." />;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="overflow-x-auto">
        <Table className="min-w-[1750px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Charge ID</TableHead>
              <TableHead>Provider ref</TableHead>
              <TableHead>Provider tx</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Refund</TableHead>
              <TableHead>Withdrawal</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead>Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell>
                  <DriverCell row={row} />
                </TableCell>
                <TableCell>
                  <Badge variant={row.type === "credit" ? "default" : "outline"} className="capitalize">
                    {row.type}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{clean(row.kind)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{formatMwk(row.amountMwk)}</TableCell>
                <TableCell className="text-right font-mono">{formatMwk(row.balanceBeforeMwk)}</TableCell>
                <TableCell className="text-right font-mono">{formatMwk(row.balanceAfterMwk)}</TableCell>
                <TableCell>{walletStatus(row)}</TableCell>
                <TableCell className="max-w-[220px] truncate font-mono text-xs">{clean(row.reference)}</TableCell>
                <TableCell className="max-w-[260px] truncate font-mono text-xs">{clean(row.gatewayChargeId)}</TableCell>
                <TableCell className="max-w-[180px] truncate font-mono text-xs">{clean(row.providerReference)}</TableCell>
                <TableCell className="max-w-[180px] truncate font-mono text-xs">{clean(row.providerTransactionId)}</TableCell>
                <TableCell className="max-w-[160px] truncate font-mono text-xs">{clean(row.bookingId)}</TableCell>
                <TableCell className="max-w-[160px] truncate font-mono text-xs">{clean(row.paymentId)}</TableCell>
                <TableCell className="max-w-[160px] truncate font-mono text-xs">{clean(row.refundId)}</TableCell>
                <TableCell className="max-w-[160px] truncate font-mono text-xs">{clean(row.withdrawal?.id)}</TableCell>
                <TableCell>
                  <JsonCell label="View metadata" value={row.metadata} onView={() => onViewJson("Wallet transaction metadata", row.metadata)} />
                </TableCell>
                <TableCell>
                  <JsonCell label="View payload" value={row.providerPayload} onView={() => onViewJson("Wallet transaction provider payload", row.providerPayload)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function WithdrawalsTable({
  rows,
  onReconcile,
  onViewJson,
  reconcilingId,
  isReconciling,
}: {
  rows: AdminWalletWithdrawal[];
  onReconcile: (id: string) => void;
  onViewJson: (title: string, value: unknown) => void;
  reconcilingId?: string;
  isReconciling: boolean;
}) {
  if (rows.length === 0) return <EmptyWalletState label="No withdrawal requests found." />;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="overflow-x-auto">
        <Table className="min-w-[1550px]">
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gateway status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Charge ID</TableHead>
              <TableHead>Provider ref</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Responded</TableHead>
              <TableHead>Webhook</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead>Failure</TableHead>
              <TableHead>Payload</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const canReconcile = row.status === "processing" && Boolean(row.gatewayChargeId);
              const isCurrent = isReconciling && reconcilingId === row.id;
              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell>
                    <DriverCell row={row} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatMwk(row.amountMwk)}</TableCell>
                  <TableCell className="whitespace-nowrap capitalize">{row.provider.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono text-xs">{row.phone}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status as never} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{clean(row.providerStatus)}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">{clean(row.reference)}</TableCell>
                  <TableCell className="max-w-[260px] truncate font-mono text-xs">{clean(row.gatewayChargeId)}</TableCell>
                  <TableCell className="max-w-[180px] truncate font-mono text-xs">{clean(row.providerReference)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.gatewayRequestedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.gatewayRespondedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.webhookReceivedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.processedAt)}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-xs text-destructive">{clean(row.failureReason)}</TableCell>
                  <TableCell>
                    <JsonCell label="View payload" value={row.providerPayload} onView={() => onViewJson("Withdrawal provider payload", row.providerPayload)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={canReconcile ? "default" : "outline"}
                      disabled={!canReconcile || isReconciling}
                      onClick={() => onReconcile(row.id)}
                      className="whitespace-nowrap"
                    >
                      <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isCurrent ? "animate-spin" : ""}`} />
                      Reconcile
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DriverCell({ row }: { row: { driverName?: string | null; driverPhone?: string | null; driverEmail?: string | null } }) {
  return (
    <div className="min-w-[180px]">
      <div className="font-medium">{row.driverName ?? "Unknown driver"}</div>
      <div className="text-xs text-muted-foreground">{row.driverPhone ?? row.driverEmail ?? "-"}</div>
    </div>
  );
}

function EmptyWalletState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-card text-center">
      <WalletCards className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function walletStatus(row: AdminWalletTransaction) {
  const status = row.withdrawal?.status ?? row.providerStatus;
  if (!status) return <span className="text-muted-foreground">-</span>;
  return <StatusPill status={status as never} />;
}

function JsonCell({ label, value, onView }: { label: string; value: unknown; onView: () => void }) {
  const text = jsonCell(value);
  if (text === "-") return <span className="text-muted-foreground">-</span>;

  return (
    <Button type="button" variant="ghost" size="sm" className="h-8 max-w-[180px] justify-start px-2" onClick={onView}>
      <span className="truncate font-mono text-xs">{label}</span>
    </Button>
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

function clean(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function jsonCell(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
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
