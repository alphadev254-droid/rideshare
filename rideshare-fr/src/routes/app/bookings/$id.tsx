import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  bookingService,
  paymentService,
  type PaymentMethod,
  ApiError,
  reviewService,
  userService,
  type PendingPayment,
  type User,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { formatMwk, formatDateTime } from "@/lib/format";
import { ArrowLeft, Car, KeyRound, RefreshCw, RotateCcw, Star, User as UserIcon, Navigation, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/bookings/$id")({
  component: BookingDetail,
});

function BookingDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => bookingService.byId(id),
  });

  const [method, setMethod] = useState<PaymentMethod>("airtel_money");
  const [payPhone, setPayPhone] = useState(user?.phone ?? "");
  const [emergencyName, setEmergencyName] = useState(user?.emergencyContactName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyContactPhone ?? "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const needsEmergencyContact = !user?.emergencyContactPhone;

  const refundPreview = useQuery({
    queryKey: ["booking", id, "refund-preview"],
    queryFn: () => bookingService.refundPreview(id),
    enabled: refundOpen,
    retry: false,
  });

  useEffect(() => {
    setPayPhone(user?.phone ?? "");
    setEmergencyName(user?.emergencyContactName ?? "");
    setEmergencyPhone(user?.emergencyContactPhone ?? "");
  }, [user]);

  const saveEmergencyContact = useMutation({
    mutationFn: () =>
      userService.updateMe({
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      }),
    onSuccess: (updatedUser: User) => {
      setUser(updatedUser);
      toast.success("Emergency contact saved");
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not save emergency contact"),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (needsEmergencyContact) {
        if (!emergencyPhone.trim()) throw new Error("Emergency phone number is required before payment");
        await saveEmergencyContact.mutateAsync();
      }
      return paymentService.initiate({ bookingId: id, method, phone: payPhone });
    },
    onSuccess: (res: PendingPayment & { checkoutUrl?: string | null }) => {
      toast.success("Payment initiated");
      if (res.checkoutUrl) window.open(res.checkoutUrl, "_blank", "noopener,noreferrer");
      qc.invalidateQueries({ queryKey: ["booking", id] });
    },
    onError: (e: Error) => toast.error(e.message || "Payment failed"),
  });

  const resend = useMutation({
    mutationFn: () => bookingService.resendCode(id),
    onSuccess: () => toast.success("Code re-sent via SMS"),
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not resend"),
  });

  const review = useMutation({
    mutationFn: () =>
      reviewService.create({ bookingId: id, rating, comment: comment || undefined }),
    onSuccess: () => {
      toast.success("Thanks for the review!");
      setReviewed(true);
      setComment("");
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not submit"),
  });

  const refund = useMutation({
    mutationFn: () => bookingService.requestRefund(id, { reason: refundReason.trim() || undefined }),
    onSuccess: () => {
      toast.success("Refund requested");
      setRefundOpen(false);
      setRefundReason("");
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not request refund"),
  });

  if (isLoading) return <LoadingState />;
  if (!booking)
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Booking not found.
      </div>
    );

  const needsPayment = booking.paymentStatus === "unpaid";
  const canResendCode = !!booking.codeAvailable && booking.status !== "cancelled";
  const canReview = booking.status === "completed" && !booking.ratedDriver && !reviewed;
  const canRequestRefund =
    booking.paymentStatus === "held_in_escrow" &&
    booking.payment?.status === "escrow_held" &&
    !booking.codeUsed &&
    booking.status !== "authenticated" &&
    booking.trip?.status !== "in_transit" &&
    booking.trip?.status !== "completed" &&
    booking.trip?.status !== "cancelled";

  return (
    <div className="space-y-6">
      <Link
        to="/app/bookings"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All bookings
      </Link>

      <PageHeader
        eyebrow="Booking"
        title={booking.boardingPoint}
        description={booking.dropOffPoint ? `→ ${booking.dropOffPoint}` : undefined}
        actions={
          <div className="flex gap-2">
            <StatusPill status={booking.status} />
            <StatusPill status={booking.paymentStatus} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="label-eyebrow">Summary</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Fare</dt>
                <dd className="mt-0.5 font-display text-lg font-semibold tabular">
                  {formatMwk(booking.fareMwk)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Booked</dt>
                <dd className="mt-0.5">{formatDateTime(booking.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Boarding</dt>
                <dd className="mt-0.5">{booking.boardingPoint}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Drop-off</dt>
                <dd className="mt-0.5">{booking.dropOffPoint ?? "—"}</dd>
              </div>
            </dl>
          </div>

          {/* Trip info */}
          {booking.trip && (
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="label-eyebrow mb-3 flex items-center gap-2">
                <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                Trip details
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Route</dt>
                  <dd className="mt-0.5 font-medium">
                    {booking.trip.originName} → {booking.trip.destinationName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Departure
                  </dt>
                  <dd className="mt-0.5">{formatDateTime(booking.trip.departureTime)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Trip status</dt>
                  <dd className="mt-0.5">
                    <StatusPill status={booking.trip.status} />
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Driver info */}
          {booking.trip?.driver && (
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="label-eyebrow mb-3 flex items-center gap-2">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Driver
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd className="mt-0.5 font-medium">{booking.trip.driver.user.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd className="mt-0.5">
                    <a href={`tel:${booking.trip.driver.user.phone}`} className="text-primary hover:underline">
                      {booking.trip.driver.user.phone}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Vehicle info */}
          {booking.trip?.vehicle && (
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="label-eyebrow mb-3 flex items-center gap-2">
                <Car className="h-3.5 w-3.5 text-muted-foreground" />
                Vehicle
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Make & model</dt>
                  <dd className="mt-0.5 font-medium">
                    {booking.trip.vehicle.make} {booking.trip.vehicle.model}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Plate number</dt>
                  <dd className="mt-0.5 font-mono">{booking.trip.vehicle.plateNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Class</dt>
                  <dd className="mt-0.5 capitalize">{booking.trip.vehicle.comfortClass}</dd>
                </div>
                {booking.trip.vehicle.color && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Color</dt>
                    <dd className="mt-0.5 capitalize">{booking.trip.vehicle.color}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {canResendCode && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-6">
              <div className="flex items-center gap-2 text-primary">
                <KeyRound className="h-4 w-4" />
                <span className="label-eyebrow">Boarding code</span>
              </div>
              {booking.boardingCode ? (
                <div className="mt-3 font-mono text-4xl font-bold tracking-[0.35em] text-primary">
                  {booking.boardingCode}
                </div>
              ) : null}
              <p className="mt-3 text-sm text-muted-foreground">
                Show this code to the driver at boarding only.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => resend.mutate()}
                disabled={resend.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Resend by SMS
              </Button>
            </div>
          )}

          {(canReview || booking.ratedDriver) && (
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="label-eyebrow">Rate your trip</h3>
              {booking.ratedDriver || reviewed ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  Thank you for your review!
                </div>
              ) : (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">How was your ride?</p>
                  <div className="mt-3 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className="ring-focus rounded"
                      >
                        <Star
                          className={`h-6 w-6 ${n <= rating ? "fill-gold text-gold" : "text-muted-foreground"}`}
                        />
                      </button>
                    ))}
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Optional comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button className="mt-3" onClick={() => review.mutate()} disabled={review.isPending}>
                    {review.isPending ? "Submitting..." : "Submit review"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {needsPayment ? (
            <div className="rounded-md border border-gold/40 bg-gold/5 p-5">
              <h3 className="label-eyebrow text-gold">Payment required</h3>
              <p className="mt-2 text-sm">Pay {formatMwk(booking.fareMwk)} to confirm your seat.</p>
              <div className="mt-4 space-y-3">
                {needsEmergencyContact && (
                  <div className="rounded-md border border-gold/40 bg-background/70 p-3">
                    <div className="label-eyebrow text-gold">Emergency contact required</div>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Contact name</Label>
                        <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="label-eyebrow">Contact phone</Label>
                        <Input
                          value={emergencyPhone}
                          onChange={(e) => setEmergencyPhone(e.target.value)}
                          placeholder="Example: +265..."
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Method</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="airtel_money">Airtel Money</SelectItem>
                      <SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem>
                      <SelectItem value="visa">Visa</SelectItem>
                      <SelectItem value="mastercard">Mastercard</SelectItem>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Phone</Label>
                  <Input value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />
                </div>
                <Button
                  className="w-full"
                  onClick={() => pay.mutate()}
                  disabled={pay.isPending || saveEmergencyContact.isPending}
                >
                  {pay.isPending || saveEmergencyContact.isPending
                    ? "Initiating..."
                    : `Pay ${formatMwk(booking.fareMwk)}`}
                </Button>
              </div>
            </div>
          ) : null}

          {canRequestRefund ? (
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="label-eyebrow">Refund</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You can request a refund before boarding. A convenience fee applies.
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full gap-2"
                onClick={() => setRefundOpen(true)}
              >
                <RotateCcw className="h-4 w-4" /> Request refund
              </Button>
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request refund</DialogTitle>
            <DialogDescription>
              Review the refund policy and amount before confirming.
            </DialogDescription>
          </DialogHeader>

          {refundPreview.isLoading ? (
            <LoadingState />
          ) : refundPreview.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {refundPreview.error instanceof Error
                ? refundPreview.error.message
                : "Refund preview is not available."}
            </div>
          ) : refundPreview.data ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-surface-2 p-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Amount paid</dt>
                    <dd className="font-semibold">{formatMwk(refundPreview.data.originalCustomerAmountMwk)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Convenience fee</dt>
                    <dd className="font-semibold">{formatMwk(refundPreview.data.convenienceFeeMwk)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Refund amount</dt>
                    <dd className="font-semibold text-primary">{formatMwk(refundPreview.data.refundAmountMwk)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Driver fee share</dt>
                    <dd className="font-semibold">{formatMwk(refundPreview.data.driverConvenienceShareMwk)}</dd>
                  </div>
                </dl>
              </div>
              <p className="text-sm text-muted-foreground">{refundPreview.data.policy}</p>
              <div className="space-y-1.5">
                <Label className="label-eyebrow">Reason</Label>
                <Textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => refund.mutate()}
              disabled={refund.isPending || refundPreview.isLoading || !refundPreview.data}
            >
              {refund.isPending ? "Submitting..." : "Confirm refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
