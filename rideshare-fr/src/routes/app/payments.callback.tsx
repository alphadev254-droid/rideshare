import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paymentService } from "@/lib/api";

export const Route = createFileRoute("/app/payments/callback")({
  component: PaymentCallback,
});

function PaymentCallback() {
  const search = Route.useSearch() as { tx_ref?: string; status?: string };
  const txRef = search.tx_ref ?? "";
  const query = useQuery({
    queryKey: ["payments", "callback", txRef],
    queryFn: () => paymentService.callback(txRef),
    enabled: !!txRef,
    refetchInterval: (query) => (query.state.data?.state === "pending" ? 3000 : false),
  });

  const state = query.data?.state ?? (query.isLoading ? "pending" : "failed");
  const isFinal = state === "finalized";
  const isFailed = state === "failed" || search.status === "failed";
  const bookingId = query.data?.transaction?.bookingId;
  const failureReason =
    query.data?.transaction && "failureReason" in query.data.transaction
      ? query.data.transaction.failureReason
      : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-md ${isFinal ? "bg-primary/10 text-primary" : isFailed ? "bg-destructive/10 text-destructive" : "bg-gold/10 text-gold"}`}>
        {isFinal ? <CheckCircle2 className="h-6 w-6" /> : isFailed ? <XCircle className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
      </div>
      <h1 className="mt-4 font-display text-xl font-semibold">
        {isFinal ? "Payment confirmed" : isFailed ? "Payment not completed" : "Confirming payment"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isFinal
          ? "Your payment has been verified and your booking has been created."
          : isFailed
            ? (failureReason ?? "Payment was not completed. No booking was created. Please try booking again.")
            : "We are checking PayChangu. Your booking will be created only after payment is confirmed."}
      </p>
      <Button className="mt-5" asChild>
        {bookingId ? (
          <Link to="/app/bookings/$id" params={{ id: bookingId }}>
            Back to booking
          </Link>
        ) : (
          <Link to="/app">Find a ride</Link>
        )}
      </Button>
    </div>
  );
}
