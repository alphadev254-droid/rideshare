import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Eye, RefreshCw, Search, WalletCards } from "lucide-react";
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
  type AdminPayoutRefund,
  type AdminWalletTransaction,
  type AdminWalletWithdrawal,
} from "@/lib/api";
import { formatDateTime, formatMwk } from "@/lib/format";

const DEFAULT_PAYOUT_PAGE_SIZE = 70;
const PAYOUT_PAGE_SIZE_OPTIONS = [25, 50, 70, 100];

export const Route = createFileRoute("/admin/wallet")({
  component: AdminWalletPage,
});

function AdminWalletPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("transactions");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerType, setLedgerType] = useState<"all" | "credit" | "withdrawal">("all");
  const [ledgerStatus, setLedgerStatus] = useState("all");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(DEFAULT_PAYOUT_PAGE_SIZE);
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [withdrawalStatus, setWithdrawalStatus] = useState("all");
  const [withdrawalMethod, setWithdrawalMethod] = useState("all");
  const [withdrawalNeedsReconcile, setWithdrawalNeedsReconcile] = useState("all");
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [withdrawalLimit, setWithdrawalLimit] = useState(DEFAULT_PAYOUT_PAGE_SIZE);
  const [refundSearch, setRefundSearch] = useState("");
  const [refundStatus, setRefundStatus] = useState("all");
  const [refundMethod, setRefundMethod] = useState("all");
  const [refundNeedsReconcile, setRefundNeedsReconcile] = useState("all");
  const [refundPage, setRefundPage] = useState(1);
  const [refundLimit, setRefundLimit] = useState(DEFAULT_PAYOUT_PAGE_SIZE);
  const [jsonDialog, setJsonDialog] = useState<{ title: string; value: unknown } | null>(null);
  const [rowDialog, setRowDialog] = useState<
    | { title: string; kind: "transaction"; row: AdminWalletTransaction }
    | { title: string; kind: "withdrawal"; row: AdminWalletWithdrawal }
    | { title: string; kind: "refund"; row: AdminPayoutRefund }
    | null
  >(null);

  const transactions = useQuery({
    queryKey: ["wallet", "admin", "transactions", ledgerSearch, ledgerType, ledgerStatus, ledgerPage, ledgerLimit],
    queryFn: () =>
      walletService.adminTransactions({
        page: ledgerPage,
        limit: ledgerLimit,
        search: ledgerSearch || undefined,
        type: ledgerType,
        status: ledgerStatus,
      }),
    enabled: activeTab === "transactions",
  });

  const withdrawals = useQuery({
    queryKey: [
      "wallet",
      "admin",
      "withdrawals",
      withdrawalSearch,
      withdrawalStatus,
      withdrawalMethod,
      withdrawalNeedsReconcile,
      withdrawalPage,
      withdrawalLimit,
    ],
    queryFn: () =>
      walletService.adminWithdrawals({
        page: withdrawalPage,
        limit: withdrawalLimit,
        search: withdrawalSearch || undefined,
        status: withdrawalStatus,
        method: withdrawalMethod,
        needsReconcile: withdrawalNeedsReconcile === "needs",
      }),
    enabled: activeTab === "withdrawals",
  });

  const refunds = useQuery({
    queryKey: [
      "payouts",
      "admin",
      "refunds",
      refundSearch,
      refundStatus,
      refundMethod,
      refundNeedsReconcile,
      refundPage,
      refundLimit,
    ],
    queryFn: () =>
      walletService.adminRefunds({
        page: refundPage,
        limit: refundLimit,
        search: refundSearch || undefined,
        status: refundStatus,
        method: refundMethod,
        needsReconcile: refundNeedsReconcile === "needs",
      }),
    enabled: activeTab === "refunds",
  });

  const reconcile = useMutation({
    mutationFn: (id: string) => walletService.reconcileWithdrawal(id),
    onSuccess: () => {
      toast.success("Reconciliation request completed");
      queryClient.invalidateQueries({ queryKey: ["wallet", "admin"] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const reconcileRefund = useMutation({
    mutationFn: (id: string) => walletService.reconcileRefund(id),
    onSuccess: () => {
      toast.success("Refund reconciliation completed");
      queryClient.invalidateQueries({ queryKey: ["payouts", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "admin"] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Payouts"
        description="Driver withdrawals, passenger refund payouts, gateway status and manual PayChangu reconciliation."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Wallet transactions</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="refunds">Refund payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <LedgerFilters
            search={ledgerSearch}
            type={ledgerType}
            status={ledgerStatus}
            onSearchChange={(value) => {
              setLedgerSearch(value);
              setLedgerPage(1);
            }}
            onTypeChange={(value) => {
              setLedgerType(value);
              setLedgerPage(1);
            }}
            onStatusChange={(value) => {
              setLedgerStatus(value);
              setLedgerPage(1);
            }}
          />
          {transactions.isLoading ? (
            <LoadingState />
          ) : (
            <>
              <WalletTransactionsTable
                rows={transactions.data?.items ?? []}
                onViewJson={(title, value) => setJsonDialog({ title, value })}
                onViewRow={(row) => setRowDialog({ title: "Wallet transaction details", kind: "transaction", row })}
              />
              <PayoutPagination
                page={ledgerPage}
                limit={ledgerLimit}
                total={transactions.data?.total ?? 0}
                isFetching={transactions.isFetching}
                onPageChange={setLedgerPage}
                onLimitChange={(value) => {
                  setLedgerLimit(value);
                  setLedgerPage(1);
                }}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="withdrawals">
          <WithdrawalFilters
            search={withdrawalSearch}
            status={withdrawalStatus}
            method={withdrawalMethod}
            needsReconcile={withdrawalNeedsReconcile}
            onSearchChange={(value) => {
              setWithdrawalSearch(value);
              setWithdrawalPage(1);
            }}
            onStatusChange={(value) => {
              setWithdrawalStatus(value);
              setWithdrawalPage(1);
            }}
            onMethodChange={(value) => {
              setWithdrawalMethod(value);
              setWithdrawalPage(1);
            }}
            onNeedsReconcileChange={(value) => {
              setWithdrawalNeedsReconcile(value);
              setWithdrawalPage(1);
            }}
          />
          {withdrawals.isLoading ? (
            <LoadingState />
          ) : (
            <>
              <WithdrawalsTable
                rows={withdrawals.data?.items ?? []}
                onReconcile={(id) => reconcile.mutate(id)}
                onViewJson={(title, value) => setJsonDialog({ title, value })}
                onViewRow={(row) => setRowDialog({ title: "Withdrawal details", kind: "withdrawal", row })}
                reconcilingId={reconcile.variables}
                isReconciling={reconcile.isPending}
              />
              <PayoutPagination
                page={withdrawalPage}
                limit={withdrawalLimit}
                total={withdrawals.data?.total ?? 0}
                isFetching={withdrawals.isFetching}
                onPageChange={setWithdrawalPage}
                onLimitChange={(value) => {
                  setWithdrawalLimit(value);
                  setWithdrawalPage(1);
                }}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="refunds">
          <RefundFilters
            search={refundSearch}
            status={refundStatus}
            method={refundMethod}
            needsReconcile={refundNeedsReconcile}
            onSearchChange={(value) => {
              setRefundSearch(value);
              setRefundPage(1);
            }}
            onStatusChange={(value) => {
              setRefundStatus(value);
              setRefundPage(1);
            }}
            onMethodChange={(value) => {
              setRefundMethod(value);
              setRefundPage(1);
            }}
            onNeedsReconcileChange={(value) => {
              setRefundNeedsReconcile(value);
              setRefundPage(1);
            }}
          />
          {refunds.isLoading ? (
            <LoadingState />
          ) : (
            <>
              <RefundsTable
                rows={refunds.data?.items ?? []}
                onReconcile={(id) => reconcileRefund.mutate(id)}
                onViewJson={(title, value) => setJsonDialog({ title, value })}
                onViewRow={(row) => setRowDialog({ title: "Refund payout details", kind: "refund", row })}
                reconcilingId={reconcileRefund.variables}
                isReconciling={reconcileRefund.isPending}
              />
              <PayoutPagination
                page={refundPage}
                limit={refundLimit}
                total={refunds.data?.total ?? 0}
                isFetching={refunds.isFetching}
                onPageChange={setRefundPage}
                onLimitChange={(value) => {
                  setRefundLimit(value);
                  setRefundPage(1);
                }}
              />
            </>
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
      <WalletRowDetailsDialog
        data={rowDialog}
        open={Boolean(rowDialog)}
        onOpenChange={(open) => {
          if (!open) setRowDialog(null);
        }}
        onViewJson={(title, value) => setJsonDialog({ title, value })}
      />
    </div>
  );
}

function LedgerFilters({
  search,
  type,
  status,
  onSearchChange,
  onTypeChange,
  onStatusChange,
}: {
  search: string;
  type: "all" | "credit" | "withdrawal";
  status: string;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: "all" | "credit" | "withdrawal") => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="mb-3 grid gap-3 rounded-md border border-border bg-card p-3 lg:grid-cols-[1fr_180px_220px]">
      <SearchInput value={search} onChange={onSearchChange} placeholder="Search driver, reference, booking or refund ID" />
      <Select value={type} onValueChange={(value) => onTypeChange(value as typeof type)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ledger types</SelectItem>
          <SelectItem value="credit">Credit</SelectItem>
          <SelectItem value="withdrawal">Withdrawal</SelectItem>
        </SelectContent>
      </Select>
      <StatusFilter value={status} onChange={onStatusChange} includeQueued={false} />
    </div>
  );
}

function WithdrawalFilters({
  search,
  status,
  method,
  needsReconcile,
  onSearchChange,
  onStatusChange,
  onMethodChange,
  onNeedsReconcileChange,
}: {
  search: string;
  status: string;
  method: string;
  needsReconcile: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onNeedsReconcileChange: (value: string) => void;
}) {
  return (
    <div className="mb-3 grid gap-3 rounded-md border border-border bg-card p-3 xl:grid-cols-[1fr_180px_190px_210px]">
      <SearchInput value={search} onChange={onSearchChange} placeholder="Search driver, phone, reference or charge ID" />
      <StatusFilter value={status} onChange={onStatusChange} includeQueued />
      <PayoutMethodFilter value={method} onChange={onMethodChange} />
      <ReconcileFilter value={needsReconcile} onChange={onNeedsReconcileChange} />
    </div>
  );
}

function RefundFilters({
  search,
  status,
  method,
  needsReconcile,
  onSearchChange,
  onStatusChange,
  onMethodChange,
  onNeedsReconcileChange,
}: {
  search: string;
  status: string;
  method: string;
  needsReconcile: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onNeedsReconcileChange: (value: string) => void;
}) {
  return (
    <div className="mb-3 grid gap-3 rounded-md border border-border bg-card p-3 xl:grid-cols-[1fr_180px_190px_210px]">
      <SearchInput value={search} onChange={onSearchChange} placeholder="Search passenger, driver, route, phone or charge ID" />
      <StatusFilter value={status} onChange={onStatusChange} includeQueued={false} />
      <PayoutMethodFilter value={method} onChange={onMethodChange} />
      <ReconcileFilter value={needsReconcile} onChange={onNeedsReconcileChange} />
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

function StatusFilter({
  value,
  onChange,
  includeQueued,
}: {
  value: string;
  onChange: (value: string) => void;
  includeQueued: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {includeQueued ? <SelectItem value="queued">Queued</SelectItem> : null}
        <SelectItem value="processing">Processing</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="failed">Failed</SelectItem>
        <SelectItem value="pending">Gateway pending</SelectItem>
        <SelectItem value="request_uncertain">Request uncertain</SelectItem>
        <SelectItem value="timeout_waiting_for_webhook">Timed out</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PayoutMethodFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All methods</SelectItem>
        <SelectItem value="airtel_money">Airtel Money</SelectItem>
        <SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem>
        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ReconcileFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All records</SelectItem>
        <SelectItem value="needs">Needs reconciliation</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PayoutPagination({
  page,
  limit,
  total,
  isFetching,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  total: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div>
        Showing {start}-{end} of {total} records · Page {page} of {totalPages}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYOUT_PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function WalletTransactionsTable({
  rows,
  onViewJson,
  onViewRow,
}: {
  rows: AdminWalletTransaction[];
  onViewJson: (title: string, value: unknown) => void;
  onViewRow: (row: AdminWalletTransaction) => void;
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
              <TableHead className="text-right">Action</TableHead>
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
                <TableCell className="text-right">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onViewRow(row)}>
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
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
  onViewRow,
  reconcilingId,
  isReconciling,
}: {
  rows: AdminWalletWithdrawal[];
  onReconcile: (id: string) => void;
  onViewJson: (title: string, value: unknown) => void;
  onViewRow: (row: AdminWalletWithdrawal) => void;
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
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onViewRow(row)}>
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
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
                    </div>
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

function RefundsTable({
  rows,
  onReconcile,
  onViewJson,
  onViewRow,
  reconcilingId,
  isReconciling,
}: {
  rows: AdminPayoutRefund[];
  onReconcile: (id: string) => void;
  onViewJson: (title: string, value: unknown) => void;
  onViewRow: (row: AdminPayoutRefund) => void;
  reconcilingId?: string;
  isReconciling: boolean;
}) {
  if (rows.length === 0) return <EmptyWalletState label="No refund payouts found." />;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="overflow-x-auto">
        <Table className="min-w-[1700px]">
          <TableHeader>
            <TableRow>
              <TableHead>Requested</TableHead>
              <TableHead>Passenger</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">Refund</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Gateway status</TableHead>
              <TableHead>Charge ID</TableHead>
              <TableHead>Provider ref</TableHead>
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
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.requestedAt)}</TableCell>
                  <TableCell>
                    <PersonCell name={row.passengerName} phone={row.passengerPhone} email={row.passengerEmail} />
                  </TableCell>
                  <TableCell>
                    <DriverCell row={row} />
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">{clean(row.route)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatMwk(row.refundAmountMwk)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMwk(row.convenienceFeeMwk)}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status as never} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap capitalize">{clean(row.paymentMethod)?.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono text-xs">{clean(row.recipientPhone)}</TableCell>
                  <TableCell className="whitespace-nowrap">{clean(row.providerStatus)}</TableCell>
                  <TableCell className="max-w-[260px] truncate font-mono text-xs">{clean(row.gatewayChargeId)}</TableCell>
                  <TableCell className="max-w-[180px] truncate font-mono text-xs">{clean(row.providerReference)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.webhookReceivedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.processedAt)}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-xs text-destructive">{clean(row.failureReason)}</TableCell>
                  <TableCell>
                    <JsonCell label="View payload" value={row.providerPayload} onView={() => onViewJson("Refund provider payload", row.providerPayload)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onViewRow(row)}>
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
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
                    </div>
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

function PersonCell({ name, phone, email }: { name?: string | null; phone?: string | null; email?: string | null }) {
  return (
    <div className="min-w-[180px]">
      <div className="font-medium">{name ?? "Unknown passenger"}</div>
      <div className="text-xs text-muted-foreground">{phone ?? email ?? "-"}</div>
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

function WalletRowDetailsDialog({
  data,
  open,
  onOpenChange,
  onViewJson,
}: {
  data:
    | { title: string; kind: "transaction"; row: AdminWalletTransaction }
    | { title: string; kind: "withdrawal"; row: AdminWalletWithdrawal }
    | { title: string; kind: "refund"; row: AdminPayoutRefund }
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewJson: (title: string, value: unknown) => void;
}) {
  const row = data?.row;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{data?.title ?? "Payout details"}</DialogTitle>
        </DialogHeader>
        {data?.kind === "transaction" ? (
          <div className="max-h-[72vh] overflow-auto pr-1">
            <DetailSection title="Driver">
              <DetailItem label="Driver name" value={data.row.driverName} />
              <DetailItem label="Driver phone" value={data.row.driverPhone} />
              <DetailItem label="Driver email" value={data.row.driverEmail} />
              <DetailItem label="Driver ID" value={data.row.driverId} wide />
            </DetailSection>

            <DetailSection title="Wallet transaction">
              <DetailItem label="Transaction ID" value={data.row.id} wide />
              <DetailItem label="Date" value={formatDateTime(data.row.createdAt)} />
              <DetailItem label="Type" value={data.row.type} />
              <DetailItem label="Kind" value={clean(data.row.kind)} />
              <DetailItem label="Description" value={data.row.description} />
              <DetailItem label="Amount" value={formatMwk(data.row.amountMwk)} />
              <DetailItem label="Balance before" value={formatMwk(data.row.balanceBeforeMwk)} />
              <DetailItem label="Balance after" value={formatMwk(data.row.balanceAfterMwk)} />
              <DetailItem label="Status" value={data.row.withdrawal?.status ?? data.row.providerStatus ?? "-"} />
              <DetailItem label="Reference" value={data.row.reference} wide />
            </DetailSection>

            <DetailSection title="Related records">
              <DetailItem label="Booking ID" value={data.row.bookingId} />
              <DetailItem label="Payment ID" value={data.row.paymentId} />
              <DetailItem label="Refund ID" value={data.row.refundId} />
              <DetailItem label="Withdrawal ID" value={data.row.withdrawal?.id} />
            </DetailSection>

            <DetailSection title="Gateway">
              <DetailItem label="Charge ID" value={data.row.gatewayChargeId} wide />
              <DetailItem label="Provider reference" value={data.row.providerReference} />
              <DetailItem label="Provider transaction" value={data.row.providerTransactionId} />
              <DetailItem label="Provider status" value={data.row.providerStatus} />
              <DetailItem label="Withdrawal provider" value={data.row.withdrawal?.provider} />
              <DetailItem label="Withdrawal phone" value={data.row.withdrawal?.phone} />
              <DetailItem label="Gateway requested" value={formatDateTime(data.row.withdrawal?.gatewayRequestedAt)} />
              <DetailItem label="Gateway responded" value={formatDateTime(data.row.withdrawal?.gatewayRespondedAt)} />
              <DetailItem label="Webhook received" value={formatDateTime(data.row.withdrawal?.webhookReceivedAt)} />
              <DetailItem label="Processed" value={formatDateTime(data.row.withdrawal?.processedAt)} />
              <DetailItem label="Failure reason" value={data.row.withdrawal?.failureReason} wide tone="destructive" />
            </DetailSection>

            <DetailJsonActions
              metadata={data.row.metadata}
              payload={data.row.providerPayload}
              onViewJson={onViewJson}
            />
          </div>
        ) : data?.kind === "withdrawal" ? (
          <div className="max-h-[72vh] overflow-auto pr-1">
            <DetailSection title="Driver">
              <DetailItem label="Driver name" value={data.row.driverName} />
              <DetailItem label="Driver phone" value={data.row.driverPhone} />
              <DetailItem label="Driver email" value={data.row.driverEmail} />
              <DetailItem label="Driver ID" value={data.row.driverId} wide />
            </DetailSection>

            <DetailSection title="Withdrawal">
              <DetailItem label="Withdrawal ID" value={data.row.id} wide />
              <DetailItem label="Amount" value={formatMwk(data.row.amountMwk)} />
              <DetailItem label="Status" value={data.row.status} />
              <DetailItem label="Method" value={data.row.provider.replace("_", " ")} />
              <DetailItem label="Phone/account" value={data.row.phone} />
              <DetailItem label="Reference" value={data.row.reference} wide />
              <DetailItem label="Wallet transaction" value={data.row.walletTransactionId} wide />
            </DetailSection>

            <DetailSection title="Gateway">
              <DetailItem label="Charge ID" value={data.row.gatewayChargeId} wide />
              <DetailItem label="Provider reference" value={data.row.providerReference} />
              <DetailItem label="Provider transaction" value={data.row.providerTransactionId} />
              <DetailItem label="Provider status" value={data.row.providerStatus} />
              <DetailItem label="Created" value={formatDateTime(data.row.createdAt)} />
              <DetailItem label="Gateway requested" value={formatDateTime(data.row.gatewayRequestedAt)} />
              <DetailItem label="Gateway responded" value={formatDateTime(data.row.gatewayRespondedAt)} />
              <DetailItem label="Webhook received" value={formatDateTime(data.row.webhookReceivedAt)} />
              <DetailItem label="Processed" value={formatDateTime(data.row.processedAt)} />
              <DetailItem label="Failure reason" value={data.row.failureReason} wide tone="destructive" />
            </DetailSection>

            <DetailJsonActions
              payload={data.row.providerPayload}
              onViewJson={onViewJson}
            />
          </div>
        ) : data?.kind === "refund" ? (
          <div className="max-h-[72vh] overflow-auto pr-1">
            <DetailSection title="Passenger">
              <DetailItem label="Passenger name" value={data.row.passengerName} />
              <DetailItem label="Passenger phone" value={data.row.passengerPhone} />
              <DetailItem label="Passenger email" value={data.row.passengerEmail} />
            </DetailSection>

            <DetailSection title="Refund payout">
              <DetailItem label="Refund ID" value={data.row.id} wide />
              <DetailItem label="Booking ID" value={data.row.bookingId} />
              <DetailItem label="Payment ID" value={data.row.paymentId} />
              <DetailItem label="Route" value={data.row.route} wide />
              <DetailItem label="Status" value={data.row.status} />
              <DetailItem label="Amount paid" value={formatMwk(data.row.originalCustomerAmountMwk)} />
              <DetailItem label="Refund amount" value={formatMwk(data.row.refundAmountMwk)} />
              <DetailItem label="Convenience fee" value={formatMwk(data.row.convenienceFeeMwk)} />
              <DetailItem label="Driver fee share" value={formatMwk(data.row.driverConvenienceShareMwk)} />
              <DetailItem label="Platform fee share" value={formatMwk(data.row.platformConvenienceFeeMwk)} />
              <DetailItem label="Reason" value={data.row.reason} wide />
            </DetailSection>

            <DetailSection title="Recipient and gateway">
              <DetailItem label="Method" value={clean(data.row.paymentMethod)} />
              <DetailItem label="Recipient phone" value={data.row.recipientPhone} />
              <DetailItem label="Charge ID" value={data.row.gatewayChargeId} wide />
              <DetailItem label="Provider reference" value={data.row.providerReference} />
              <DetailItem label="Provider transaction" value={data.row.providerTransactionId} />
              <DetailItem label="Provider status" value={data.row.providerStatus} />
              <DetailItem label="Requested" value={formatDateTime(data.row.gatewayRequestedAt ?? data.row.requestedAt)} />
              <DetailItem label="Responded" value={formatDateTime(data.row.gatewayRespondedAt)} />
              <DetailItem label="Webhook received" value={formatDateTime(data.row.webhookReceivedAt)} />
              <DetailItem label="Processed" value={formatDateTime(data.row.processedAt)} />
              <DetailItem label="Failure reason" value={data.row.failureReason} wide tone="destructive" />
            </DetailSection>

            <DetailSection title="Driver">
              <DetailItem label="Driver name" value={data.row.driverName} />
              <DetailItem label="Driver phone" value={data.row.driverPhone} />
              <DetailItem label="Driver email" value={data.row.driverEmail} />
              <DetailItem label="Driver ID" value={data.row.driverId} wide />
            </DetailSection>

            <DetailJsonActions
              payload={data.row.providerPayload}
              onViewJson={onViewJson}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="label-eyebrow mb-2">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  wide = false,
  tone,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
  tone?: "destructive";
}) {
  return (
    <div className={`min-w-0 rounded-md border border-border bg-surface p-2 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <p className="label-eyebrow">{label}</p>
      <p className={`mt-1 break-words text-sm ${tone === "destructive" ? "text-destructive" : "text-foreground"}`}>
        {value || "-"}
      </p>
    </div>
  );
}

function DetailJsonActions({
  metadata,
  payload,
  onViewJson,
}: {
  metadata?: unknown;
  payload?: unknown;
  onViewJson: (title: string, value: unknown) => void;
}) {
  const hasMetadata = jsonCell(metadata) !== "-";
  const hasPayload = jsonCell(payload) !== "-";
  if (!hasMetadata && !hasPayload) return null;

  return (
    <section>
      <h3 className="label-eyebrow mb-2">Raw data</h3>
      <div className="flex flex-wrap gap-2">
        {hasMetadata ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onViewJson("Wallet transaction metadata", metadata)}>
            View metadata JSON
          </Button>
        ) : null}
        {hasPayload ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onViewJson("Provider payload", payload)}>
            View payload JSON
          </Button>
        ) : null}
      </div>
    </section>
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
