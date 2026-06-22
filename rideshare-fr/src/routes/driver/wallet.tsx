import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { walletService, type PaymentMethod } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: balance, isLoading } = useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: () => walletService.balance(),
  });
  const { data: withdrawals, isLoading: wLoading } = useQuery({
    queryKey: ["wallet", "withdrawals"],
    queryFn: () => walletService.withdrawals(),
  });

  // ─── Withdraw form state ───────────────────────────────
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("airtel_money");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [otp, setOtp] = useState("");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [activeWithdrawalId, setActiveWithdrawalId] = useState<string | null>(null);

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
      toast.success("Withdrawal submitted — waiting for processing");
      setAmount("");
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
    if (otp.length !== 6) return;
    withdraw.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Money" title="Wallet" description="Earnings, balance and withdrawals." />

      {isLoading ? (
        <LoadingState />
      ) : (
        balance && (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Available"
              value={formatMwk(balance.balanceMwk)}
              icon={<Wallet className="h-4 w-4" />}
              accent="primary"
            />
            <StatCard
              label="Total earned"
              value={formatMwk(balance.totalEarnedMwk)}
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>
        )
      )}

      {/* ─── Active withdrawal banner ────────────────────────── */}
      {activeWithdrawal && (
        <div className="rounded-md border border-border bg-surface-2 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">
                Withdrawal in progress – {formatMwk(activeWithdrawal.amountMwk)} via{" "}
                {activeWithdrawal.provider.replace("_", " ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: <span className="font-semibold capitalize">{activeWithdrawal.status.replace("_", " ")}</span>
                {activeWithdrawal.failureReason ? (
                  <span className="ml-2 text-destructive">— {activeWithdrawal.failureReason}</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-6 lg:col-span-1"
        >
          <h3 className="label-eyebrow">Withdraw to mobile money</h3>

          {/* Step 1 — Amount, method, phone */}
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Amount (MWK)</Label>
            <Input
              type="number"
              required
              min={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={withdraw.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={withdraw.isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="airtel_money">Airtel Money</SelectItem>
                <SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={withdraw.isPending} />
          </div>

          {/* Step 2 — Request code button (only shown before code is sent, or to resend) */}
          {!otpSentTo ? (
            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => requestOtp.mutate()}
              disabled={requestOtp.isPending || !amount || Number(amount) < 100}
            >
              {requestOtp.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {requestOtp.isPending ? "Sending code..." : "Request verification code"}
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-border bg-surface p-3">
              <div className="flex items-center gap-2 text-xs text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Code sent to {otpSentTo}
              </div>

              {/* Step 3 — Enter code + Verify & Withdraw */}
              <div className="flex gap-2">
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  required
                  disabled={withdraw.isPending}
                  className="text-center text-lg tracking-widest"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestOtp.mutate()}
                  disabled={requestOtp.isPending}
                  className="shrink-0"
                >
                  Resend
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={withdraw.isPending || otp.length !== 6 || !amount}
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

        <div className="rounded-md border border-border bg-card p-4 sm:p-5 lg:col-span-2">
          <h3 className="label-eyebrow">Withdrawal history</h3>
          {wLoading ? (
            <LoadingState />
          ) : (withdrawals ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No withdrawals yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {withdrawals!.map((w) => {
                const isActive = w.status === "queued" || w.status === "processing";
                return (
                  <li key={w.id} className="flex items-center justify-between gap-4 py-3 text-sm">
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
                          {isActive && "⏳ "}{w.status.replace("_", " ")}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {w.provider.replace("_", " ")} · {w.reference}
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
