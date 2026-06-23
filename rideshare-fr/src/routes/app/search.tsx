import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { tripService, type ComfortClass } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { formatMwk, formatTime, formatDate, formatDistanceKm } from "@/lib/format";
import { ArrowRight, Car, Clock, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchParams {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originName?: string;
  destName?: string;
  date: string;
  seats?: number;
  comfortClass?: ComfortClass;
}

export const Route = createFileRoute("/app/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    originLat: Number(s.originLat),
    originLng: Number(s.originLng),
    destLat: Number(s.destLat),
    destLng: Number(s.destLng),
    originName: s.originName ? String(s.originName) : undefined,
    destName: s.destName ? String(s.destName) : undefined,
    date: String(s.date),
    seats: s.seats ? Number(s.seats) : undefined,
    comfortClass: s.comfortClass as ComfortClass | undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const { data, isLoading, error } = useQuery({
    queryKey: ["trips", "search", search],
    queryFn: () =>
      tripService.search({
        originLat: search.originLat,
        originLng: search.originLng,
        destLat: search.destLat,
        destLng: search.destLng,
        date: search.date,
        seats: search.seats,
        comfortClass: search.comfortClass,
      }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Results"
        title={`${search.originName ?? "Origin"} → ${search.destName ?? "Destination"}`}
        description={`${formatDate(search.date)}${search.seats ? ` · ${search.seats} seat${search.seats > 1 ? "s" : ""}` : ""}${search.comfortClass ? ` · ${search.comfortClass}` : ""}`}
        actions={
          <Link to="/app">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              New search
            </Button>
          </Link>
        }
      />

      {isLoading && <LoadingState label="Searching trips" />}
      {error && (
        <EmptyState
          title="Couldn't load trips"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      )}
      {data && data.length === 0 && (
        <EmptyState
          icon={<Car className="h-5 w-5" />}
          title="No trips found"
          description="Try a different date or relax the seat or class filters."
          action={
            <Link to="/app">
              <Button variant="outline">Adjust search</Button>
            </Link>
          }
        />
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((trip) => (
            <li key={trip.id}>
              <Link
                to="/app/trips/$id"
                params={{ id: trip.id }}
                className="flex flex-col gap-4 rounded-md border border-border bg-card p-5 transition-colors hover:border-border-strong sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <StatusPill status={trip.status} />
                    <span className="font-mono text-xs text-muted-foreground">
                      {trip.comfortClass}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 font-display text-lg font-semibold">
                    <span>{trip.originName}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span>{trip.destinationName}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {formatTime(trip.departureTime)} · {formatDate(trip.departureTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {formatDistanceKm(trip.distanceKm)}
                    </span>
                    {trip.estimatedDurationMinutes && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(trip.estimatedDurationMinutes)}
                      </span>
                    )}
                    {trip.vehicle && (
                      <span className="flex items-center gap-1.5">
                        <Car className="h-3 w-3" />
                        {trip.vehicle.make} {trip.vehicle.model}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-6 border-t border-border pt-4 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold tabular">
                      {formatMwk(trip.farePerSeatMwk)}
                    </div>
                    <div className="label-eyebrow mt-0.5">
                      {trip.availableSeats} available
                    </div>
                  </div>
                  <Button size="sm" className="gap-1.5">
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
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

