import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  paymentService,
  tripService,
  userService,
  ApiError,
  type PendingPayment,
  type User as ApiUser,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMwk, formatDateTime, formatDistanceKm } from "@/lib/format";
import { ArrowLeft, Car, MapPin, Star, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/trips/$id")({
  component: TripDetail,
});

function TripDetail() {
  const { id } = Route.useParams();
  const { user, setUser } = useAuth();
  const [payPhone, setPayPhone] = useState(user?.phone ?? "");
  const [emergencyName, setEmergencyName] = useState(user?.emergencyContactName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyContactPhone ?? "");
  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => tripService.byId(id),
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
    onSuccess: (updatedUser: ApiUser) => {
      setUser(updatedUser);
      toast.success("Emergency contact saved");
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not save emergency contact"),
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!trip) throw new Error("Trip is not loaded");
      if (!payPhone.trim()) throw new Error("Payment phone number is required");
      if (!user?.emergencyContactPhone) {
        if (!emergencyPhone.trim()) throw new Error("Emergency phone number is required before payment");
        await saveEmergencyContact.mutateAsync();
      }
      return paymentService.initiateRide({
        tripId: id,
        boardingPoint: trip.pickupPoint || trip.originName,
        dropOffPoint: trip.dropOffPoint || trip.destinationName,
        phone: payPhone,
      });
    },
    onSuccess: (payment: PendingPayment & { checkoutUrl?: string | null }) => {
      toast.success("Opening secure payment.");
      if (payment.checkoutUrl) window.location.assign(payment.checkoutUrl);
    },
    onError: (e: Error) => toast.error(e instanceof Error ? e.message : "Payment failed"),
  });

  if (isLoading) return <LoadingState label="Loading trip" />;
  if (error || !trip) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Couldn't load this trip.
      </div>
    );
  }

  const fullyBooked = trip.availableSeats <= 0;

  return (
    <div className="space-y-6">
      <Link
        to="/app"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to rides
      </Link>

      <PageHeader
        eyebrow={trip.comfortClass}
        title={`${trip.originName} → ${trip.destinationName}`}
        description={`Departure time: ${formatDateTime(trip.departureTime)}`}
        actions={<StatusPill status={trip.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="label-eyebrow">Driver</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
                {trip.driver?.user.fullName
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <div className="font-display text-base font-semibold">
                  {trip.driver?.user.fullName}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-gold">
                  <Star className="h-3 w-3 fill-gold" /> {trip.driver?.user.rating ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="label-eyebrow">Vehicle</h3>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-3 text-muted-foreground">
                <Car className="h-4 w-4" />
              </span>
              <div>
                <div className="font-display text-base font-semibold">
                  {trip.vehicle?.make} {trip.vehicle?.model}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {trip.vehicle?.plateNumber} · {trip.vehicle?.year}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="label-eyebrow">Trip details</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Distance</dt>
                <dd className="mt-0.5 tabular font-medium">{formatDistanceKm(trip.distanceKm)}</dd>
              </div>
              {trip.estimatedDurationMinutes && (
                <div>
                  <dt className="text-xs text-muted-foreground">Approx. duration</dt>
                  <dd className="mt-0.5 tabular font-medium">
                    {formatDuration(trip.estimatedDurationMinutes)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Available seats</dt>
                <dd className="mt-0.5 tabular font-medium">
                  {trip.availableSeats}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Class</dt>
                <dd className="mt-0.5 font-medium capitalize">{trip.comfortClass}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Departure time</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(trip.departureTime)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="label-eyebrow">Fare per seat</div>
            <div className="mt-2 font-display text-3xl font-semibold tabular">
              {formatMwk(trip.farePerSeatMwk)}
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <div className="rounded-md bg-surface-2 p-3 text-sm">
                <div className="label-eyebrow">Boarding point</div>
                <div className="mt-1 font-medium">{trip.pickupPoint || trip.originName}</div>
              </div>
              <div className="rounded-md bg-surface-2 p-3 text-sm">
                <div className="label-eyebrow">Drop-off point</div>
                <div className="mt-1 font-medium">{trip.dropOffPoint || trip.destinationName}</div>
              </div>
              {!user?.emergencyContactPhone && (
                <div className="space-y-3 rounded-md border border-gold/40 bg-gold/5 p-3">
                  <div className="label-eyebrow text-gold">Emergency contact required</div>
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">Contact name</Label>
                    <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">Contact phone</Label>
                    <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="label-eyebrow">Payment phone</Label>
                <Input value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={fullyBooked || book.isPending || saveEmergencyContact.isPending || !payPhone.trim()}
                onClick={() => book.mutate()}
              >
                {fullyBooked ? "Fully booked" : book.isPending ? "Opening payment..." : "Pay to book"}
              </Button>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <User className="h-3 w-3" /> Booking is created only after payment is confirmed.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
            <MapPin className="mb-1 inline h-3.5 w-3.5 text-primary" /> Live GPS shared with
            passengers once the trip is in transit.
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}



