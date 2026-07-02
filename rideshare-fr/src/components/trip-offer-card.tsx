import { Car, Clock, MapPin, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecureImage } from "@/components/secure-image";
import type { Trip } from "@/lib/api";
import { formatDateTime, formatDistanceKm, formatMwk } from "@/lib/format";

type TripOfferCardProps = {
  trip: Trip;
  actionLabel?: string;
  onAction: (trip: Trip) => void;
};

export function TripOfferCard({ trip, actionLabel = "Book Ride", onAction }: TripOfferCardProps) {
  const stops = getTimelineStops(trip);
  const selectedTo =
    trip.segmentToOrder ??
    stops.find((stop) => stop.name === (trip.dropOffPoint || trip.destinationName))?.stopOrder ??
    stops.length - 1;
  const driverName = trip.driver?.user.fullName ?? "Verified driver";
  const rating = trip.driver?.user.rating ?? trip.driver?.rating;
  const vehicle = trip.vehicle
    ? `${trip.vehicle.color ? `${trip.vehicle.color} ` : ""}${trip.vehicle.make} ${trip.vehicle.model}${trip.vehicle.plateNumber ? ` - ${trip.vehicle.plateNumber}` : ""}`
    : "Approved vehicle";
  const arrivalTime = formatClock(trip.arrivalTime ?? selectedArrivalTime(trip, stops, selectedTo));

  return (
    <article className="public-card flex h-full flex-col rounded-xl p-4 transition-colors hover:border-primary/45 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <DriverAvatar name={driverName} imageUrl={trip.driver?.user.profilePhotoUrl} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{driverName}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
              {rating && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Star className="h-3 w-3 fill-gold text-gold" />
                  {Number(rating).toFixed(1)}
                </span>
              )}
              <span className="inline-flex min-w-0 items-center gap-1">
                <Car className="h-3 w-3 shrink-0" />
                <span className="truncate">{vehicle}</span>
              </span>
            </div>
          </div>
        </div>
        <span className="trust-chip shrink-0 px-2 py-1 text-[10px]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified
        </span>
      </div>

      <div className="route-rail mt-4 space-y-3 pl-6">
        <div className="relative flex items-center gap-2">
          <span className="route-dot absolute -left-6" />
          <span className="truncate font-display text-lg font-semibold">{trip.originName}</span>
        </div>
        <div className="relative flex items-center gap-2">
          <span className="route-dot absolute -left-6 bg-primary" />
          <span className="truncate font-display text-lg font-semibold">
            {trip.dropOffPoint || trip.destinationName}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-gold" />
          Depart {formatDateTime(trip.departureTime)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-route" />
          Arrive {arrivalTime || "Not set"}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-route" />
          {formatDistanceKm(trip.distanceKm)}
        </span>
      </div>

      {trip.parentOriginName && trip.parentDestinationName && (
        <div className="mt-3 truncate text-xs text-muted-foreground">
          Part of {trip.parentOriginName} to {trip.parentDestinationName}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="min-w-0">
          <div className="font-display text-xl font-semibold tabular-nums text-gold">
            {formatMwk(trip.farePerSeatMwk)}
          </div>
          <div className="text-xs text-muted-foreground">
            {trip.availableSeats} seat{trip.availableSeats === 1 ? "" : "s"} available
          </div>
        </div>
        <Button size="sm" onClick={() => onAction(trip)} className="shrink-0">
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}

function DriverAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <SecureImage
        src={imageUrl}
        alt={name}
        className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
        access="public"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[8px] uppercase text-muted-foreground">
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("") || "DR"}
    </div>
  );
}

function getTimelineStops(trip: Trip) {
  const stops =
    trip.routeStops && trip.routeStops.length >= 2
      ? trip.routeStops
      : [
          {
            name: trip.parentOriginName || trip.originName,
            stopOrder: 0,
            departureOffsetMinutes: 0,
          },
          {
            name: trip.dropOffPoint || trip.parentDestinationName || trip.destinationName,
            stopOrder: 1,
            arrivalOffsetMinutes: null,
          },
        ];

  return [...stops]
    .sort((a, b) => a.stopOrder - b.stopOrder)
    .filter(
      (stop, index, sorted) =>
        index === 0 ||
        stop.stopOrder !== sorted[index - 1].stopOrder ||
        stop.name !== sorted[index - 1].name,
    );
}

function formatClock(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function selectedArrivalTime(
  trip: Trip,
  stops: ReturnType<typeof getTimelineStops>,
  selectedTo: number,
) {
  const stop = stops.find((row) => row.stopOrder === selectedTo);
  if (!stop) return null;
  const offset = stop.arrivalOffsetMinutes ?? stop.departureOffsetMinutes;
  if (offset === null || offset === undefined) return null;
  return new Date(new Date(trip.departureTime).getTime() + offset * 60_000);
}
