import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { tripService, type Trip } from "@/lib/api";
import { formatMwk, formatDateTime, formatDistanceKm } from "@/lib/format";
import { StatusPill, ComfortBadge } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { SecureImage } from "@/components/secure-image";
import {
  ArrowRight,
  Calendar,
  Car,
  Clock,
  MapPin,
  Share2,
  CheckCircle2,
  Users,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_share/d/$driverId")({
  head: () => ({
    meta: [
      { title: "Driver Trips — ChepetsaRide" },
      { name: "description", content: "Browse upcoming intercity trips from a verified ChepetsaRide driver. Book a seat and pay securely with mobile money." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverTripsPage,
});

function DriverTripsPage() {
  const { driverId } = Route.useParams();
  const [copied, setCopied] = useState(false);

  // Fetch this driver's public trips directly from the backend
  const { data, isLoading } = useQuery({
    queryKey: ["trips", "public", { driverId }],
    queryFn: () =>
      tripService.publicList({ limit: 50, driverId }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const allTrips = data?.items ?? [];

  const driverName = allTrips[0]?.driver?.user?.fullName;
  const driverPhoto = allTrips[0]?.driver?.user?.profilePhotoUrl;
  const driverRating = allTrips[0]?.driver?.rating;

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-20 rounded-xl bg-surface-2" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-2" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Driver header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {driverPhoto ? (
            <SecureImage
              src={driverPhoto}
              alt={driverName ?? "Driver"}
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-2 text-2xl font-semibold text-muted-foreground">
              {driverName?.charAt(0) ?? "D"}
            </div>
          )}
          <div>
            <h1 className="font-display text-xl font-semibold">
              {driverName ? `${driverName}'s trips` : "Driver trips"}
            </h1>
            <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
              {driverRating && (
                <span><span className="text-gold">★</span> {Number(driverRating).toFixed(1)}</span>
              )}
              <span>{allTrips.length} upcoming trip{allTrips.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          {copied ? (
            <><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Link copied!</>
          ) : (
            <><Share2 className="h-3.5 w-3.5" /> Share all trips</>
          )}
        </button>
      </div>

      {/* Trips list */}
      {allTrips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Car className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No upcoming trips</p>
          <p className="mt-1 text-xs text-muted-foreground">Check back later.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/trips">Browse all trips</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {allTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const fullyBooked = trip.availableSeats <= 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border-strong">
      {/* Vehicle photo strip */}
      {(trip.vehicle?.imageUrls?.length ?? 0) > 0 && (
        <div className="h-32 w-full overflow-hidden">
          <SecureImage
            src={trip.vehicle!.imageUrls![0]}
            alt={`${trip.vehicle?.make} ${trip.vehicle?.model}`}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusPill status={trip.status} />
              <ComfortBadge value={trip.comfortClass} />
            </div>
            <div className="font-display text-lg font-semibold">
              {trip.originName}
              <span className="mx-1.5 text-muted-foreground">→</span>
              {trip.destinationName}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDateTime(trip.departureTime)}
              </span>
              {trip.distanceKm > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {formatDistanceKm(trip.distanceKm)}
                </span>
              )}
              {trip.estimatedDurationMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(trip.estimatedDurationMinutes)}
                </span>
              )}
              {trip.vehicle && (
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  {trip.vehicle.make} {trip.vehicle.model}
                  {trip.vehicle.plateNumber && ` · ${trip.vehicle.plateNumber}`}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-display text-2xl font-bold text-primary">
              {formatMwk(trip.farePerSeatMwk)}
            </div>
            <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-info">
              <Users className="h-3 w-3" />
              {fullyBooked ? (
                <span className="text-destructive">Full</span>
              ) : (
                <span>{trip.availableSeats} left</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">
            📍 {trip.pickupPoint || trip.originName}
          </div>
          <Button asChild size="sm" disabled={fullyBooked}>
            <Link to="/t/$tripId" params={{ tripId: trip.id }}>
              {fullyBooked ? "Fully booked" : "View & book"}
              {!fullyBooked && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
}
