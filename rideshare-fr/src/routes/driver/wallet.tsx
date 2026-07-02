import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { walletService, type PaymentMethod, type WalletWithdrawal } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMwk, formatDateTime } from "@/lib/format";
import { API_CONFIG } from "@/lib/api/config";
import { ArrowUpCircle, Eye, Loader2, Mail, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/wallet")({
  component: WalletPage,
});

const PAYCHANGU_MIN_PAYOUT_MWK = 50;

function WalletPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("airtel_money");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [activeWithdrawalId, setActiveWithdrawalId] = useState<string | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WalletWithdrawal | null>(null);

  const { data: balance, isLoading } = useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: () => walletService.balance(),
  });
  const { data: withdrawals, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["wallet", "withdrawals"],
    queryFn: () => walletService.withdrawals(),
  });

  const amountNumber = Number(amount);
  const balanceNumber = Number(balance?.balanceMwk ?? 0);
  const withdrawalFee =
    Number.isFinite(amountNumber) && amountNumber > 0
      ? Math.round(amountNumber * API_CONFIG.withdrawalFees.mobileMoneyRate)
      : 0;
  const netPayout = Math.max(0, Math.round(amountNumber || 0) - withdrawalFee);

  const { data: activeWithdrawal } = useQuery({
    queryKey: ["wallet", "withdrawal", activeWithdrawalId],
    queryFn: () => walletService.withdrawalById(activeWithdrawalId!),
    enabled: !!activeWithdrawalId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" || status === "queued" ? 5_000 : false;
    },
  });

  if (activeWithdrawal?.status === "completed" || activeWithdrawal?.status === "failed") {
    if (activeWithdrawalId) {
      setTimeout(() => {
        setActiveWithdrawalId(null);
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["wallet", "withdrawals"] });
      }, 3000);
    }
  }

  const requestOtp = useMutation({
    mutationFn: () => walletService.requestWithdrawalOtp(),
    onSuccess: (res: { sent: boolean; email: string; expiresAt: string; message: string }) => {
      setOtpSentTo(res.email);
      toast.success("Withdrawal code sent to your email");
    },
    onError: (error: Error) => toast.error(error.message || "Could not send withdrawal code"),
  });

  const withdraw = useMutation({
    mutationFn: () => walletService.withdraw({ amountMwk: Number(amount), phone, method, otp }),
    onSuccess: (res: { message: string; amountMwk: string; status: string; reference: string; id: string }) => {
      toast.success("Withdrawal submitted - waiting for processing");
      setAmount("");
      setPhone("");
      setOtp("");
      setOtpSentTo(null);
      setActiveWithdrawalId(res.id);
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet", "withdrawals"] });
    },
    onError: (error: Error) => toast.error(error.message || "Withdrawal failed"),
  });

  function validateWithdrawalBasics() {
    if (!amount.trim() || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Enter the amount you want to withdraw");
      return false;
    }
    if (amountNumber > balanceNumber) {
      toast.error("Withdrawal amount cannot be higher than your available balance");
      return false;
    }
    if (!phone.trim()) {
      toast.error("Enter the mobile money phone number for this withdrawal");
      return false;
    }
    if (!/^(?:\+?265|0)?(?:88|98|99)\d{7}$/.test(phone.replace(/\s/g, ""))) {
      toast.error("Enter a valid Malawi mobile money number, for example 0991234567");
      return false;
    }
    if (netPayout < PAYCHANGU_MIN_PAYOUT_MWK) {
      toast.error(
        `After the withdrawal fee, PayChangu payout must be at least ${formatMwk(PAYCHANGU_MIN_PAYOUT_MWK)}`,
      );
      return false;
    }
    return true;
  }

  function handleRequestOtp() {
    if (!validateWithdrawalBasics()) return;
    requestOtp.mutate();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validateWithdrawalBasics()) return;
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit verification code sent to your email");
      return;
    }
    withdraw.mutate();
  }

  return (
    <div className="max-w-full space-y-5 overflow-x-hidden">
      <PageHeader eyebrow="Money" title="Wallet" description="Earnings, balance and withdrawals." />

      {isLoading ? (
        <LoadingState />
      ) : (
        balance && (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <CompactWalletStat
              label="Available"
              value={formatMwk(balance.balanceMwk)}
              icon={<Wallet className="h-4 w-4" />}
              accent
            />
            <CompactWalletStat
              label="Total earned"
              value={formatMwk(balance.totalEarnedMwk)}
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>
        )
      )}

      {activeWithdrawal && (
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                Withdrawal in progress - {formatMwk(activeWithdrawal.amountMwk)} via{" "}
                {activeWithdrawal.provider.replace("_", " ")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Status: <span className="font-semibold capitalize">{activeWithdrawal.status.replace("_", " ")}</span>
                {activeWithdrawal.failureReason ? (
                  <span className="ml-2 text-destructive">- {activeWithdrawal.failureReason}</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="withdraw" className="max-w-full overflow-hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="withdraw">
          <form
            onSubmit={submit}
            className="mx-auto max-w-xl space-y-3 rounded-md border border-border bg-card p-3 text-sm sm:p-4"
          >
            <h3 className="label-eyebrow">Withdraw to mobile money</h3>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label className="label-eyebrow">Amount</Label>
                <Input
                  type="number"
                  required
                  min={PAYCHANGU_MIN_PAYOUT_MWK}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setOtp("");
                    setOtpSentTo(null);
                  }}
                  placeholder="5000"
                  disabled={withdraw.isPending}
                  className="h-9 min-w-0 text-sm"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="label-eyebrow">Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={withdraw.isPending}>
                  <SelectTrigger className="h-9 min-w-0 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="airtel_money">Airtel Money</SelectItem>
                    <SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Minimum payout after fees: {formatMwk(PAYCHANGU_MIN_PAYOUT_MWK)}.
            </p>

            <div className="min-w-0 space-y-1.5">
              <Label className="label-eyebrow">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setOtp("");
                  setOtpSentTo(null);
                }}
                required
                disabled={withdraw.isPending}
                placeholder="0991234567 or +265991234567"
                inputMode="tel"
                className="h-9 min-w-0 text-sm"
              />
            </div>

            {amountNumber > 0 && (
              <div className="rounded-md border border-border bg-surface-2 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Withdrawal fee</span>
                  <span className="font-medium tabular">{formatMwk(withdrawalFee)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Recipient receives</span>
                  <span
                    className={
                      netPayout >= PAYCHANGU_MIN_PAYOUT_MWK
                        ? "font-semibold tabular text-primary"
                        : "font-semibold tabular text-destructive"
                    }
                  >
                    {formatMwk(netPayout)}
                  </span>
                </div>
              </div>
            )}

            {!otpSentTo ? (
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={handleRequestOtp}
                disabled={requestOtp.isPending || withdraw.isPending}
                size="sm"
              >
                {requestOtp.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {requestOtp.isPending ? "Sending code..." : "Request verification code"}
              </Button>
            ) : (
              <div className="space-y-2 rounded-md border border-border bg-surface p-2.5">
                <div className="flex min-w-0 items-center gap-2 text-xs text-primary">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 truncate">Code sent to {otpSentTo}</span>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    required
                    disabled={withdraw.isPending}
                    className="h-9 min-w-0 text-center text-base tracking-widest"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRequestOtp}
                    disabled={requestOtp.isPending || withdraw.isPending}
                    className="shrink-0 px-3"
                  >
                    Resend
                  </Button>
                </div>

                <Button type="submit" className="w-full" disabled={withdraw.isPending} size="sm">
                  {withdraw.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Verify code & withdraw"
                  )}
                </Button>
              </div>
            )}
          </form>
        </TabsContent>

        <TabsContent value="withdrawals">
          <WithdrawalsPanel
            withdrawals={withdrawals ?? []}
            isLoading={withdrawalsLoading}
            onView={setSelectedWithdrawal}
          />
        </TabsContent>
      </Tabs>

      <WithdrawalDetailsDialog
        withdrawal={selectedWithdrawal}
        open={Boolean(selectedWithdrawal)}
        onOpenChange={(open) => {
          if (!open) setSelectedWithdrawal(null);
        }}
      />
    </div>
  );
}

function WithdrawalsPanel({
  withdrawals,
  isLoading,
  onView,
}: {
  withdrawals: WalletWithdrawal[];
  isLoading: boolean;
  onView: (withdrawal: WalletWithdrawal) => void;
}) {
  if (isLoading) return <LoadingState />;
  if (withdrawals.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No withdrawals yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2 sm:p-3">
      {withdrawals.map((withdrawal) => {
        const isActive = withdrawal.status === "queued" || withdrawal.status === "processing";
        return (
          <div
            key={withdrawal.id}
            className="grid min-w-0 gap-2 rounded-md border border-border bg-surface p-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-md ${statusTone(withdrawal.status)}`}>
              {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
            </span>

            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold tabular">-{formatMwk(withdrawal.amountMwk)}</span>
                <StatusPill status={withdrawal.status} />
              </div>
              <div className="grid gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                <span className="min-w-0 truncate capitalize">
                  To: {withdrawal.provider.replace("_", " ")} - {withdrawal.phone}
                </span>
                <span className="min-w-0 truncate">Date: {formatDateTime(withdrawal.createdAt)}</span>
                <span className="min-w-0 truncate">Reference: {withdrawal.reference}</span>
                <span className="min-w-0 truncate">
                  Completed: {formatDateTime(withdrawal.processedAt)}
                </span>
              </div>
              {withdrawal.failureReason ? (
                <p className="truncate text-xs text-destructive">{withdrawal.failureReason}</p>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 sm:w-auto"
              onClick={() => onView(withdrawal)}
            >
              <Eye className="h-4 w-4" />
              View more
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function WithdrawalDetailsDialog({
  withdrawal,
  open,
  onOpenChange,
}: {
  withdrawal: WalletWithdrawal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Withdrawal details</DialogTitle>
        </DialogHeader>
        {withdrawal ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2 p-3">
              <div>
                <p className="label-eyebrow">Amount</p>
                <p className="font-mono text-xl font-semibold tabular">{formatMwk(withdrawal.amountMwk)}</p>
              </div>
              <StatusPill status={withdrawal.status} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Detail label="Account" value={`${withdrawal.provider.replace("_", " ")} - ${withdrawal.phone}`} />
              <Detail label="Requested" value={formatDateTime(withdrawal.createdAt)} />
              <Detail label="Processed" value={formatDateTime(withdrawal.processedAt)} />
              <Detail label="Gateway requested" value={formatDateTime(withdrawal.gatewayRequestedAt)} />
              <Detail label="Gateway responded" value={formatDateTime(withdrawal.gatewayRespondedAt)} />
              <Detail label="Webhook received" value={formatDateTime(withdrawal.webhookReceivedAt)} />
              <Detail label="Reference" value={withdrawal.reference} wide />
              <Detail label="Charge ID" value={withdrawal.gatewayChargeId ?? "-"} wide />
              <Detail label="Provider reference" value={withdrawal.providerReference ?? "-"} />
              <Detail label="Provider transaction" value={withdrawal.providerTransactionId ?? "-"} />
              <Detail label="Provider status" value={withdrawal.providerStatus ?? "-"} />
              <Detail label="Wallet transaction" value={withdrawal.walletTransactionId ?? "-"} />
              <Detail label="Balance before" value={formatMwk(withdrawal.balanceBeforeMwk)} />
              <Detail label="Balance after" value={formatMwk(withdrawal.balanceAfterMwk)} />
              {withdrawal.failureReason ? (
                <Detail label="Failure reason" value={withdrawal.failureReason} wide tone="destructive" />
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label,
  value,
  wide = false,
  tone,
}: {
  label: string;
  value: string;
  wide?: boolean;
  tone?: "destructive";
}) {
  return (
    <div className={`min-w-0 rounded-md border border-border bg-surface p-2 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="label-eyebrow">{label}</p>
      <p className={`mt-1 break-words text-sm ${tone === "destructive" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function statusTone(status: WalletWithdrawal["status"]) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-600";
  if (status === "failed") return "bg-destructive/10 text-destructive";
  if (status === "queued" || status === "processing") return "bg-primary/10 text-primary";
  return "bg-gold/10 text-gold";
}

function CompactWalletStat({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5 sm:p-3">
      <div className="min-w-0">
        <p className="label-eyebrow truncate text-[10px]">{label}</p>
        <p className={`mt-0.5 truncate text-base font-semibold tabular sm:text-xl ${accent ? "text-primary" : ""}`}>
          {value}
        </p>
      </div>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-9 sm:w-9 ${
          accent ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground"
        }`}
      >
        {icon}
      </span>
    </div>
  );
}
