import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  bookingService,
  paymentService,
  ApiError,
  reviewService,
  userService,
  type PendingPayment,
  type PaymentRefund,
  type User,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { SecureImage } from "@/components/secure-image";
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
import { formatMwk, formatDateTime } from "@/lib/format";
import { ArrowLeft, Car, CheckCircle2, KeyRound, RefreshCw, RotateCcw, Star, User as UserIcon, Navigation, Calendar } from "lucide-react";
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

  const [payPhone, setPayPhone] = useState(user?.phone ?? "");
  const [emergencyName, setEmergencyName] = useState(user?.emergencyContactName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyContactPhone ?? "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundResult, setRefundResult] = useState<PaymentRefund | null>(null);
  const [selectedVehicleImage, setSelectedVehicleImage] = useState<string | null>(null);
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
      return paymentService.initiate({ bookingId: id, phone: payPhone });
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
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not submit"),
  });

  const refund = useMutation({
    mutationFn: () => bookingService.requestRefund(id, { reason: refundReason.trim() || undefined }),
    onSuccess: (result) => {
      toast.success("Refund payout started");
      setRefundResult(result);
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
  const boardingApproved = booking.codeUsed || booking.status === "authenticated";
  const canResendCode = !!booking.codeAvailable && booking.status !== "cancelled";
  const showBoardingCodePanel = !needsPayment && booking.status !== "cancelled";
  const canReview = booking.status === "completed" && !booking.ratedDriver && !reviewed;
  const hasActiveRefund = Boolean(booking.payment?.refunds?.length);
  const tripHasStarted =
    !!booking.trip?.startedAt ||
    booking.trip?.status === "in_transit" ||
    booking.trip?.status === "completed" ||
    booking.trip?.status === "cancelled";
  const canRequestRefund =
    booking.paymentStatus === "held_in_escrow" &&
    booking.payment?.status === "escrow_held" &&
    !hasActiveRefund &&
    !booking.codeUsed &&
    booking.status !== "authenticated" &&
    !tripHasStarted;

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 border-b border-border pb-6">
      <Link
        to="/app/bookings"
        className="mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-foreground"
        aria-label="All bookings"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <PageHeader
        eyebrow="Booking"
        title={booking.boardingPoint}
        description={booking.dropOffPoint ? `→ ${booking.dropOffPoint}` : undefined}
        className="min-w-0 flex-1 flex-row items-end justify-between gap-3 border-b-0 pb-0 [&>div:first-child]:min-w-0 [&>div:first-child]:flex-1 [&_h1]:truncate"
        actions={
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <StatusPill status={booking.status} />
            <StatusPill status={booking.paymentStatus} />
          </div>
        }
      />
      </div>

      {showBoardingCodePanel && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary">
                {boardingApproved ? <CheckCircle2 className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                <span className="label-eyebrow">
                  {boardingApproved ? "Boarding approved" : "Boarding code"}
                </span>
              </div>

              {boardingApproved ? (
                <>
                  {booking.boardingCode && (
                    <div className="mt-3 font-mono text-4xl font-bold tracking-[0.35em] text-primary">
                      {booking.boardingCode}
                    </div>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    The driver has verified your boarding code.
                  </p>
                </>
              ) : booking.boardingCode ? (
                <>
                  <div className="mt-3 font-mono text-4xl font-bold tracking-[0.35em] text-primary">
                    {booking.boardingCode}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Show this code to the driver when boarding. It must be verified before you enter.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your boarding code will show here after payment confirmation.
                </p>
              )}
            </div>

            {canResendCode && !boardingApproved && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-2"
                onClick={() => resend.mutate()}
                disabled={resend.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Resend by SMS
              </Button>
            )}
          </div>
        </div>
      )}

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
                <dt className="text-xs text-muted-foreground">Seats</dt>
                <dd className="mt-0.5 font-medium">{booking.seatsBooked ?? 1} passenger{(booking.seatsBooked ?? 1) === 1 ? "" : "s"}</dd>
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

          {booking.travelers && booking.travelers.length > 0 && (
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="label-eyebrow mb-3">Traveler manifest</h3>
              <div className="space-y-2 text-sm">
                {booking.travelers.map((traveler) => (
                  <div key={traveler.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
                    <span>{traveler.fullName}</span>
                    {traveler.isPrimary && <span className="text-xs text-muted-foreground">Primary</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
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
                    <Calendar className="h-3 w-3" /> Departure time
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

              {(booking.trip.vehicle.imageUrls?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <div className="label-eyebrow mb-2">Vehicle photos</div>
                  <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
                    {booking.trip.vehicle.imageUrls?.map((url, index) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setSelectedVehicleImage(url)}
                        className="group aspect-square overflow-hidden rounded-md border border-border bg-surface-2 ring-focus sm:h-16 sm:w-16"
                        aria-label={`View vehicle photo ${index + 1}`}
                      >
                        <SecureImage
                          src={url}
                          alt={`${booking.trip?.vehicle?.make ?? "Vehicle"} photo ${index + 1}`}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                onClick={() => {
                  setRefundResult(null);
                  setRefundOpen(true);
                }}
              >
                <RotateCcw className="h-4 w-4" /> Request refund
              </Button>
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog open={!!selectedVehicleImage} onOpenChange={(open) => !open && setSelectedVehicleImage(null)}>
        <DialogContent className="max-w-3xl border-border bg-card p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>Vehicle photo</DialogTitle>
            <DialogDescription>Expanded vehicle image preview.</DialogDescription>
          </DialogHeader>
          {selectedVehicleImage && (
            <SecureImage
              src={selectedVehicleImage}
              alt="Vehicle photo"
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          if (refund.isPending) return;
          setRefundOpen(open);
          if (!open) setRefundResult(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{refundResult ? "Refund payout processing" : "Request refund"}</DialogTitle>
            <DialogDescription>
              {refundResult
                ? "Your refund request has been sent to PayChangu. We will update the booking when the payout is confirmed."
                : "Review the refund policy and amount before confirming."}
            </DialogDescription>
          </DialogHeader>

          {refundResult ? (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <RefreshCw className="mt-0.5 h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-semibold">Refund is being processed</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Keep this booking for tracking. If PayChangu confirms success, the booking will be cancelled and marked refunded.
                    </p>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-2 p-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="font-semibold capitalize">{refundResult.status.replace("_", " ")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Refund amount</dt>
                  <dd className="font-semibold text-primary">{formatMwk(refundResult.refundAmountMwk)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Convenience fee</dt>
                  <dd className="font-semibold">{formatMwk(refundResult.convenienceFeeMwk)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Requested</dt>
                  <dd className="font-semibold">{formatDateTime(refundResult.requestedAt)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Tracking ID</dt>
                  <dd className="break-all font-mono text-xs">{refundResult.gatewayChargeId ?? refundResult.id}</dd>
                </div>
              </dl>
            </div>
          ) : refundPreview.isLoading ? (
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
            {!refundResult ? (
              <Button
                onClick={() => refund.mutate()}
                disabled={refund.isPending || refundPreview.isLoading || !refundPreview.data}
              >
                {refund.isPending ? "Starting refund..." : "Confirm refund"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
