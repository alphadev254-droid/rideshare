import { Car, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Trip } from "@/lib/api";
import { formatMwk } from "@/lib/format";

type TripOfferCardProps = {
  trip: Trip;
  actionLabel?: string;
  onAction: (trip: Trip) => void;
};

export function TripOfferCard({ trip, actionLabel = "Book Ride", onAction }: TripOfferCardProps) {
  const stops = getTimelineStops(trip);
  const selectedFrom = trip.segmentFromOrder ?? stops.find((stop) => stop.name === trip.originName)?.stopOrder ?? 0;
  const selectedTo =
    trip.segmentToOrder ??
    stops.find((stop) => stop.name === (trip.dropOffPoint || trip.destinationName))?.stopOrder ??
    stops.length - 1;
  const driverName = trip.driver?.user.fullName ?? "Verified driver";
  const rating = trip.driver?.user.rating ?? trip.driver?.rating;
  const vehicle = trip.vehicle
    ? `${trip.vehicle.color ? `${trip.vehicle.color} ` : ""}${trip.vehicle.make} ${trip.vehicle.model}${trip.vehicle.plateNumber ? ` - ${trip.vehicle.plateNumber}` : ""}`
    : "Approved vehicle";
  const selectedSegmentIndex = Math.max(1, stops.findIndex((stop) => stop.stopOrder === selectedFrom) + 1);
  const segmentCount = Math.max(1, stops.length - 1);
  const arrivalTime = formatClock(trip.arrivalTime ?? selectedArrivalTime(trip, stops, selectedTo));
  const tripMeta = (
    <>
      <span>
        Depart <span className="font-semibold text-foreground">{formatClock(trip.departureTime)}</span>
      </span>
      <span>.</span>
      <span>
        Arrive <span className="font-semibold text-foreground">{arrivalTime || "Not set"}</span>
      </span>
      {trip.estimatedDurationMinutes ? (
        <>
          <span>.</span>
          <span>{formatMinutes(trip.estimatedDurationMinutes)} journey</span>
        </>
      ) : null}
      <span>.</span>
      <span>
        Segment {selectedSegmentIndex} of {segmentCount}
      </span>
      {trip.parentOriginName && trip.parentDestinationName && (
        <>
          <span>.</span>
          <span className="truncate">
            Part of longer trip: <span className="font-medium text-foreground">{trip.parentOriginName} to {trip.parentDestinationName}</span>
          </span>
        </>
      )}
    </>
  );

  return (
    <article className="grid overflow-hidden rounded-md border border-border bg-card shadow-sm transition-colors hover:border-primary/45 lg:grid-cols-[minmax(0,1fr)_150px]">
      <div className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(170px,auto)_minmax(0,1fr)_auto] sm:items-start">
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
          <div className="hidden min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 pt-1 text-[10px] text-muted-foreground sm:flex">
            {tripMeta}
          </div>
          <span className="hidden shrink-0 items-center gap-1 rounded-sm border border-border bg-surface-2 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline-flex">
            <Check className="h-3 w-3 text-primary" />
            Verified
          </span>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mt-4">
          <h3 className="min-w-0 truncate font-display text-xl font-semibold leading-tight text-foreground sm:text-2xl">
            {trip.originName}
          </h3>
          <span className="text-sm font-medium text-muted-foreground">to</span>
          <h3 className="min-w-0 truncate font-display text-xl font-semibold leading-tight text-foreground sm:text-2xl">
            {trip.dropOffPoint || trip.destinationName}
          </h3>
        </div>

        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground sm:hidden">
          {tripMeta}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-2/60 px-3 py-2 lg:block lg:border-l lg:border-t-0 lg:px-4 lg:py-3 lg:text-left">
        <div className="min-w-0">
          <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:text-[9px]">Total price</div>
          <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-primary lg:text-2xl">{formatMwk(trip.farePerSeatMwk)}</div>
          <div className="mt-0.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary lg:mt-1 lg:text-[10px]">
            {trip.availableSeats} seat{trip.availableSeats === 1 ? "" : "s"} left
          </div>
        </div>
        <Button size="sm" onClick={() => onAction(trip)} className="h-8 shrink-0 px-4 text-[11px] font-semibold uppercase tracking-wide lg:mt-5 lg:h-9 lg:w-full lg:px-5 lg:text-xs">
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}

function DriverAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />;
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[8px] uppercase text-muted-foreground">
      {name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "DR"}
    </div>
  );
}

function getTimelineStops(trip: Trip) {
  const stops =
    trip.routeStops && trip.routeStops.length >= 2
      ? trip.routeStops
      : [
          { name: trip.parentOriginName || trip.originName, stopOrder: 0, departureOffsetMinutes: 0 },
          { name: trip.dropOffPoint || trip.parentDestinationName || trip.destinationName, stopOrder: 1, arrivalOffsetMinutes: null },
        ];

  return [...stops]
    .sort((a, b) => a.stopOrder - b.stopOrder)
    .filter((stop, index, sorted) => index === 0 || stop.stopOrder !== sorted[index - 1].stopOrder || stop.name !== sorted[index - 1].name);
}

function formatClock(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function selectedArrivalTime(trip: Trip, stops: ReturnType<typeof getTimelineStops>, selectedTo: number) {
  const stop = stops.find((row) => row.stopOrder === selectedTo);
  if (!stop) return null;
  const offset = stop.arrivalOffsetMinutes ?? stop.departureOffsetMinutes;
  if (offset === null || offset === undefined) return null;
  return new Date(new Date(trip.departureTime).getTime() + offset * 60_000);
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
