import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CheckCircle2, Loader2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paymentService } from "@/lib/api";
import { formatMwk } from "@/lib/format";

export const Route = createFileRoute("/app/payments/callback")({
  component: PaymentCallback,
});

function PaymentCallback() {
  const search = Route.useSearch() as { tx_ref?: string; status?: string };
  const navigate = useNavigate();
  const txRef = search.tx_ref ?? "";

  const query = useQuery({
    queryKey: ["payments", "callback", txRef],
    queryFn: () => paymentService.callback(txRef),
    enabled: !!txRef,
    // Poll every 3 s while pending, stop once final
    refetchInterval: (q) => (q.state.data?.state === "pending" ? 3000 : false),
  });

  const state = query.data?.state ?? (query.isLoading ? "pending" : "failed");
  const isFinal = state === "finalized";
  const isFailed = state === "failed" || search.status === "failed";
  const transaction = query.data?.transaction;
  const bookingId = transaction?.bookingId;
  const fareAmount =
    transaction && "fareAmountMwk" in transaction
      ? (transaction as { fareAmountMwk: string }).fareAmountMwk
      : null;

  // Auto-redirect to booking page 2 s after success
  useEffect(() => {
    if (isFinal && bookingId) {
      const timer = setTimeout(() => {
        navigate({ to: "/app/bookings/$id", params: { id: bookingId } });
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [isFinal, bookingId, navigate]);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 text-center">
      {/* Status icon */}
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full ${
          isFinal
            ? "bg-primary/10 text-primary"
            : isFailed
              ? "bg-destructive/10 text-destructive"
              : "bg-gold/10 text-gold"
        }`}
      >
        {isFinal ? (
          <CheckCircle2 className="h-10 w-10" />
        ) : isFailed ? (
          <XCircle className="h-10 w-10" />
        ) : (
          <Loader2 className="h-10 w-10 animate-spin" />
        )}
      </div>

      {/* Heading */}
      <h1 className="mt-6 font-display text-2xl font-semibold">
        {isFinal
          ? "Booking confirmed!"
          : isFailed
            ? "Payment not completed"
            : "Confirming payment…"}
      </h1>

      {/* Sub-text */}
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
        {isFinal
          ? "Your seat is reserved. Your boarding code has been sent by SMS — share it only with the driver when you board."
          : isFailed
            ? "Your payment was not completed and no booking was created. You can try again."
            : "We are checking with PayChangu. This usually takes a few seconds."}
      </p>

      {/* Fare summary on success */}
      {isFinal && fareAmount && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 px-6 py-3 text-sm">
          <span className="text-muted-foreground">Amount paid: </span>
          <span className="font-semibold">{formatMwk(fareAmount)}</span>
        </div>
      )}

      {/* Auto-redirect notice */}
      {isFinal && bookingId && (
        <p className="mt-4 text-xs text-muted-foreground">
          Taking you to your booking in a moment…
        </p>
      )}

      {/* CTA */}
      <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
        {isFinal && bookingId ? (
          <Button asChild>
            <Link to="/app/bookings/$id" params={{ id: bookingId }}>
              View booking <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : isFailed ? (
          <>
            <Button asChild>
              <Link to="/app">Find a ride</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/bookings">My bookings</Link>
            </Button>
          </>
        ) : (
          /* Still pending — show a subtle spinner message, no button yet */
          <p className="text-xs text-muted-foreground">Please wait, do not close this page.</p>
        )}
      </div>
    </div>
  );
}
