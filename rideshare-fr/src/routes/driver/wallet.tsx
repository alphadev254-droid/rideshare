import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { walletService, type PaymentMethod } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMwk, formatDateTime } from "@/lib/format";
import { Wallet, ArrowUpCircle, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { API_CONFIG } from "@/lib/api/config";

export const Route = createFileRoute("/driver/wallet")({
  component: WalletPage,
});

const PAYCHANGU_MIN_PAYOUT_MWK = 50;

function WalletPage() {
  const qc = useQueryClient();
  const { data: balance, isLoading } = useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: () => walletService.balance(),
  });
  const { data: withdrawals, isLoading: wLoading } = useQuery({
    queryKey: ["wallet", "withdrawals"],
    queryFn: () => walletService.withdrawals(),
  });

  // â”€â”€â”€ Withdraw form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("airtel_money");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [activeWithdrawalId, setActiveWithdrawalId] = useState<string | null>(null);
  const amountNumber = Number(amount);
  const balanceNumber = Number(balance?.balanceMwk ?? 0);
  const withdrawalFee =
    Number.isFinite(amountNumber) && amountNumber > 0
      ? Math.round(amountNumber * API_CONFIG.withdrawalFees.mobileMoneyRate)
      : 0;
  const netPayout = Math.max(0, Math.round(amountNumber || 0) - withdrawalFee);

  // Poll only the specific active withdrawal until it completes/fails
  const { data: activeWithdrawal } = useQuery({
    queryKey: ["wallet", "withdrawal", activeWithdrawalId],
    queryFn: () => walletService.withdrawalById(activeWithdrawalId!),
    enabled: !!activeWithdrawalId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" || status === "queued" ? 5_000 : false;
    },
  });
  // Stop polling when reached terminal state
  if (activeWithdrawal?.status === "completed" || activeWithdrawal?.status === "failed") {
    // scheduled: clear active id after next render to let banner stay briefly
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
      toast.success("Withdrawal submitted â€” waiting for processing");
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validateWithdrawalBasics()) return;
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit verification code sent to your email");
      return;
    }
    withdraw.mutate();
  }

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

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Money" title="Wallet" description="Earnings, balance and withdrawals." />

      {isLoading ? (
        <LoadingState />
      ) : (
        balance && (
          <div className="grid grid-cols-2 gap-3">
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

      {/* â”€â”€â”€ Active withdrawal banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeWithdrawal && (
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">
                Withdrawal in progress â€“ {formatMwk(activeWithdrawal.amountMwk)} via{" "}
                {activeWithdrawal.provider.replace("_", " ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: <span className="font-semibold capitalize">{activeWithdrawal.status.replace("_", " ")}</span>
                {activeWithdrawal.failureReason ? (
                  <span className="ml-2 text-destructive">â€” {activeWithdrawal.failureReason}</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <form
          onSubmit={submit}
          className="space-y-3 rounded-md border border-border bg-card p-3 sm:p-4"
        >
          <h3 className="label-eyebrow">Withdraw to mobile money</h3>

          {/* Step 1 â€” Amount, method, phone */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
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
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={withdraw.isPending}>
                <SelectTrigger className="h-9">
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
          <div className="space-y-1.5">
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
              className="h-9"
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

          {/* Step 2 â€” Request code button (only shown before code is sent, or to resend) */}
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
              <div className="flex items-center gap-2 text-xs text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Code sent to {otpSentTo}
              </div>

              {/* Step 3 â€” Enter code + Verify & Withdraw */}
              <div className="flex gap-2">
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  required
                  disabled={withdraw.isPending}
                  className="h-9 text-center text-base tracking-widest"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRequestOtp}
                  disabled={requestOtp.isPending || withdraw.isPending}
                  className="shrink-0"
                >
                  Resend
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={withdraw.isPending}
                size="sm"
              >
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

        <div className="rounded-md border border-border bg-card p-3 sm:p-4">
          <h3 className="label-eyebrow">Withdrawal history</h3>
          {wLoading ? (
            <LoadingState />
          ) : (withdrawals ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No withdrawals yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {withdrawals!.map((w) => {
                const isActive = w.status === "queued" || w.status === "processing";
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : w.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : w.status === "failed"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-gold/10 text-gold"
                        }`}
                      >
                        {isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium capitalize">
                          {isActive && "â³ "}{w.status.replace("_", " ")}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {w.provider.replace("_", " ")} Â· {w.reference}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(w.processedAt ?? w.createdAt)}
                        </div>
                        {w.failureReason ? (
                          <div className="text-xs text-destructive">{w.failureReason}</div>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-right font-mono tabular font-semibold ${
                        w.status === "completed" ? "text-emerald-600" : w.status === "failed" ? "text-destructive" : "text-gold"
                      }`}
                    >
                      -{formatMwk(w.amountMwk)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="label-eyebrow truncate">{label}</p>
        <p className={`mt-1 truncate text-xl font-semibold tabular ${accent ? "text-primary" : ""}`}>{value}</p>
      </div>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
          accent ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground"
        }`}
      >
        {icon}
      </span>
    </div>
  );
}
