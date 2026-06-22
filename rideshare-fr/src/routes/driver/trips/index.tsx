import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { tripService } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatMwk } from "@/lib/format";
import { Eye, MapPin, Plus, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/driver/trips/")({
  component: TripsList,
});

function TripsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["trips", "mine"],
    queryFn: () => tripService.mine(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My trips"
        title="All published trips"
        actions={
          <Link to="/driver/trips/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New trip
            </Button>
          </Link>
        }
      />
      {isLoading && <LoadingState />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<RouteIcon className="h-5 w-5" />}
          title="No trips yet"
          description="Publish your first trip and start accepting passengers."
          action={
            <Link to="/driver/trips/new">
              <Button>Publish trip</Button>
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((t) => (
            <li key={t.id}>
              <Link
                to="/driver/trips/$id"
                params={{ id: t.id }}
                className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-border-strong sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusPill status={t.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(t.departureTime)}
                    </span>
                  </div>
                  <div className="mt-2 font-display text-base font-semibold truncate">
                    {t.originName} → {t.destinationName}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t.distanceKm} km · {t.comfortClass}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="text-right text-xs">
                    <div className="tabular font-medium">{formatMwk(t.farePerSeatMwk)}</div>
                    <div className="text-muted-foreground">
                      {t.availableSeats}/{t.totalSeats} seats
                    </div>
                  </div>
                  {t.status === "in_transit" && (
                    <Button asChild size="sm" variant="outline" className="gap-2 w-full sm:w-auto">
                      <Link to="/trips/$id/location" params={{ id: t.id }}>
                        <MapPin className="h-4 w-4" />
                        <span className="sm:hidden">Location</span>
                        <span className="hidden sm:inline">View driver location</span>
                      </Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <span>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </span>
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
