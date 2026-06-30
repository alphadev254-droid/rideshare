import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  tripService,
  paymentService,
  userService,
  type Trip,
  type PendingPayment,
  type User,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { setPendingTripId, clearPendingTripId } from "@/lib/pending-trip";
import { formatMwk, formatDateTime, formatDistanceKm } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill, ComfortBadge } from "@/components/status-pill";
import { BookingSeatsFields } from "@/components/booking-seats-fields";
import { SecureImage } from "@/components/secure-image";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  Share2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_share/t/$tripId")({
  head: () => ({
    meta: [
      { title: "Book an Intercity Ride — ChepetsaRide" },
      { name: "description", content: "Secure your seat on a verified intercity trip in Malawi. Pay with Airtel Money or TNM Mpamba. Boarding code sent by SMS after payment." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TripSharePage,
});

function TripSharePage() {
  const { tripId } = Route.useParams();
  const { user, setUser } = useAuth();
  const { openModal } = useAuthModal();

  const { data: trip, isLoading, error } = useQuery({
    queryKey: ["trips", "public", tripId],
    queryFn: () => tripService.byId(tripId),
    staleTime: 30_000,
    retry: 1,
  });

  // Payment state
  const [paymentPhone, setPaymentPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [seatsBooked, setSeatsBooked] = useState(1);
  const [travelerNames, setTravelerNames] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setPaymentPhone(user.phone ?? "");
      setEmergencyName(user.emergencyContactName ?? "");
      setEmergencyPhone(user.emergencyContactPhone ?? "");
    }
  }, [user]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const saveEmergency = useMutation({
    mutationFn: () =>
      userService.updateMe({
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      }),
    onSuccess: (u: User) => { setUser(u); },
  });

  const book = useMutation({
    mutationFn: async (t: Trip) => {
      if (!user?.emergencyContactPhone && emergencyPhone.trim()) {
        await saveEmergency.mutateAsync();
      }
      return paymentService.initiateRide({
        tripId: t.id,
        boardingPoint: t.pickupPoint || t.originName,
        dropOffPoint: t.dropOffPoint || t.destinationName,
        phone: paymentPhone,
        seatsBooked,
        travelerNames: travelerNames.map((name) => name.trim()).filter(Boolean),
      });
    },
    onSuccess: (payment: PendingPayment & { checkoutUrl?: string | null }) => {
      clearPendingTripId();
      if (payment?.checkoutUrl) {
        window.location.assign(payment.checkoutUrl);
        return;
      }
      toast.error("Could not open payment checkout");
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Payment failed"),
  });

  function handleBook() {
    if (!trip) return;
    if (!user) {
      // Store trip + return path so auth modal redirects back here
      setPendingTripId(trip.id, `/t/${trip.id}`);
      openModal({ mode: "login", role: "passenger" });
      return;
    }
    if (!paymentPhone.trim()) {
      toast.error("Enter your payment phone number");
      return;
    }
    if (!user.emergencyContactPhone && !emergencyPhone.trim()) {
      toast.error("Emergency contact phone is required");
      return;
    }
    book.mutate(trip);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <TripSkeleton />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Car className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold">Trip not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This trip may have been cancelled or the link is invalid.
        </p>
        <Button asChild className="mt-6">
          <Link to="/trips">Browse all trips</Link>
        </Button>
      </div>
    );
  }

  const fullyBooked = trip.availableSeats <= 0;
  const needsEmergency = user ? !user.emergencyContactPhone : false;
  const isCancelled = trip.status === "cancelled";
  const isCompleted = trip.status === "completed";
  const canBook = !fullyBooked && !isCancelled && !isCompleted;
  const totalFareMwk = Number(trip.farePerSeatMwk) * seatsBooked;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Back link */}
      <Link
        to="/trips"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All trips
      </Link>

      {/* Hero card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Vehicle photo banner if available */}
        {(trip.vehicle?.imageUrls?.length ?? 0) > 0 && (
          <div className="h-48 w-full overflow-hidden sm:h-56">
            <SecureImage
              src={trip.vehicle!.imageUrls![0]}
              alt={`${trip.vehicle?.make} ${trip.vehicle?.model}`}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-5 sm:p-7">
          {/* Route headline */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={trip.status} />
                <ComfortBadge value={trip.comfortClass} />
              </div>
              <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
                {trip.originName}
                <span className="mx-2 text-muted-foreground">→</span>
                {trip.dropOffPoint || trip.destinationName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateTime(trip.departureTime)}
                </span>
                {trip.distanceKm > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {formatDistanceKm(trip.distanceKm)}
                  </span>
                )}
                {trip.estimatedDurationMinutes && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(trip.estimatedDurationMinutes)}
                  </span>
                )}
              </div>
            </div>

            {/* Price + seats */}
            <div className="shrink-0 text-right">
              <div className="font-display text-3xl font-bold text-primary">
                {formatMwk(trip.farePerSeatMwk)}
              </div>
              <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-info">
                <Users className="h-3.5 w-3.5" />
                {fullyBooked ? (
                  <span className="text-destructive">Fully booked</span>
                ) : (
                  <span>{trip.availableSeats} seat{trip.availableSeats !== 1 ? "s" : ""} left</span>
                )}
              </div>
            </div>
          </div>

          {/* Share button */}
          <button
            type="button"
            onClick={copyLink}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            {copied ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Link copied!</>
            ) : (
              <><Share2 className="h-3.5 w-3.5" /> Share this trip</>
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Left: trip details */}
        <div className="space-y-5 lg:col-span-3">

          {/* Trip facts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile icon={<Zap />} label="Fare per seat" value={formatMwk(trip.farePerSeatMwk)} />
            <Tile icon={<Users />} label="Available seats" value={fullyBooked ? "Fully booked" : String(trip.availableSeats)} />
            {trip.distanceKm > 0 && (
              <Tile icon={<MapPin />} label="Distance" value={formatDistanceKm(trip.distanceKm)} />
            )}
            {trip.estimatedDurationMinutes && (
              <Tile icon={<Clock />} label="Duration" value={formatDuration(trip.estimatedDurationMinutes)} />
            )}
            <Tile icon={<ShieldCheck />} label="Class" value={trip.comfortClass} />
            {trip.vehicle && (
              <Tile icon={<Car />} label="Vehicle" value={`${trip.vehicle.make} ${trip.vehicle.model}`} />
            )}
          </div>

          {/* Pickup / drop-off */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="label-eyebrow mb-4">Pickup & drop-off</h2>
            <div className="space-y-1">
              <StopRow letter="A" label="Boarding point" place={trip.pickupPoint || trip.originName} />
              <div className="ml-[11px] h-8 w-px bg-border" />
              <StopRow letter="B" label="Drop-off point" place={trip.dropOffPoint || trip.destinationName} />
            </div>
          </div>

          {/* Driver info */}
          {trip.driver && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="label-eyebrow mb-3">Your driver</h2>
              <div className="flex items-center gap-3">
                {trip.driver.user.profilePhotoUrl ? (
                  <SecureImage
                    src={trip.driver.user.profilePhotoUrl}
                    alt={trip.driver.user.fullName}
                    className="h-12 w-12 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-lg font-semibold text-muted-foreground border border-border">
                    {trip.driver.user.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-medium">{trip.driver.user.fullName}</div>
                  {trip.driver.rating && (
                    <div className="text-xs text-muted-foreground">
                      <span className="text-gold">★</span> {Number(trip.driver.rating).toFixed(1)} rating
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vehicle photos */}
          {(trip.vehicle?.imageUrls?.length ?? 0) > 1 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="label-eyebrow mb-3">Vehicle photos</h2>
              <div className="grid grid-cols-3 gap-2">
                {trip.vehicle!.imageUrls!.slice(0, 6).map((url) => (
                  <SecureImage
                    key={url}
                    src={url}
                    alt={`${trip.vehicle?.make} ${trip.vehicle?.model}`}
                    className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: booking panel */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            {isCancelled ? (
              <div className="py-4 text-center">
                <div className="text-sm font-medium text-destructive">Trip cancelled</div>
                <p className="mt-1 text-xs text-muted-foreground">This trip is no longer available.</p>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link to="/trips">Find another ride</Link>
                </Button>
              </div>
            ) : isCompleted ? (
              <div className="py-4 text-center">
                <div className="text-sm font-medium text-muted-foreground">Trip completed</div>
                <p className="mt-1 text-xs text-muted-foreground">This trip has already departed.</p>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link to="/trips">Find another ride</Link>
                </Button>
              </div>
            ) : fullyBooked ? (
              <div className="py-4 text-center">
                <div className="text-sm font-medium text-destructive">Fully booked</div>
                <p className="mt-1 text-xs text-muted-foreground">No seats remaining on this trip.</p>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link to="/trips">Find another ride</Link>
                </Button>
              </div>
            ) : (
              <>
                <h2 className="label-eyebrow mb-1">Book this ride</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Seat confirmed only after payment. You will receive a boarding code by SMS.
                </p>

                {!user ? (
                  /* Not logged in — show sign-in prompt */
                  <div className="space-y-3">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                      <p className="text-sm font-medium">Sign in to book</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        You need a passenger account to reserve a seat.
                      </p>
                    </div>
                    <Button className="h-11 w-full" onClick={handleBook}>
                      Sign in &amp; Book
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      No account?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          if (trip) setPendingTripId(trip.id, `/t/${trip.id}`);
                          openModal({ mode: "register", role: "passenger" });
                        }}
                      >
                        Register for free
                      </button>
                    </p>
                  </div>
                ) : (
                  /* Logged in — show payment form */
                  <div className="space-y-4">
                    {needsEmergency && (
                      <div className="rounded-lg border border-gold/40 bg-gold/5 p-3">
                        <p className="label-eyebrow text-gold mb-2">Emergency contact required</p>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="label-eyebrow">Contact name</Label>
                            <Input
                              value={emergencyName}
                              onChange={(e) => setEmergencyName(e.target.value)}
                              placeholder="Full name"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="label-eyebrow">Contact phone</Label>
                            <Input
                              value={emergencyPhone}
                              onChange={(e) => setEmergencyPhone(e.target.value)}
                              placeholder="+265..."
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <BookingSeatsFields availableSeats={trip.availableSeats} seatsBooked={seatsBooked} onSeatsBookedChange={setSeatsBooked} travelerNames={travelerNames} onTravelerNamesChange={setTravelerNames} primaryName={user.fullName ?? "You"} />
                    <div className="space-y-1">
                      <Label className="label-eyebrow">Mobile money number</Label>
                      <Input
                        value={paymentPhone}
                        onChange={(e) => setPaymentPhone(e.target.value)}
                        placeholder="+265..."
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                      You will pay{" "}
                      <span className="font-semibold text-foreground">
                        {formatMwk(totalFareMwk)}
                      </span>{" "}
                      + a small processing fee. Booking is created only after payment is confirmed.
                    </div>
                    <Button
                      className="h-11 w-full"
                      disabled={book.isPending || saveEmergency.isPending || !paymentPhone.trim()}
                      onClick={handleBook}
                    >
                      {book.isPending || saveEmergency.isPending
                        ? "Opening payment..."
                        : `Pay ${formatMwk(totalFareMwk)} - Book ${seatsBooked} seat${seatsBooked === 1 ? "" : "s"}`}
                      {!book.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium capitalize">{value}</div>
      </div>
    </div>
  );
}

function StopRow({ letter, label, place }: { letter: string; label: string; place: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
        {letter}
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{place}</div>
      </div>
    </div>
  );
}

function TripSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 rounded-xl bg-surface-2" />
      <div className="h-8 w-2/3 rounded bg-surface-2" />
      <div className="h-4 w-1/3 rounded bg-surface-2" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-surface-2" />
        ))}
      </div>
    </div>
  );
}


