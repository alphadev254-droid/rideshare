import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tripService } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatMwk, formatDistanceKm } from "@/lib/format";
import { Eye, KeyRound, MapPin, Pencil, Play, Plus, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/trips/")({
  component: TripsList,
});

function TripsList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["trips", "mine"],
    queryFn: () => tripService.mine(),
  });

  const notifyBoarding = useMutation({
    mutationFn: (id: string) => tripService.setStatus(id, "boarding"),
    onSuccess: () => {
      toast.success("Passengers notified that you are at the boarding point");
      qc.invalidateQueries({ queryKey: ["trips", "mine"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not update trip"),
  });

  const startTrip = useMutation({
    mutationFn: (id: string) => tripService.start(id),
    onSuccess: () => {
      toast.success("Trip started. GPS sharing is active.");
      qc.invalidateQueries({ queryKey: ["trips", "mine"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not start trip"),
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
          {data.map((t) => {
            const isUpdatingBoarding = notifyBoarding.isPending && notifyBoarding.variables === t.id;
            const isStarting = startTrip.isPending && startTrip.variables === t.id;

            return (
              <li key={t.id}>
                <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-border-strong sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusPill status={t.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(t.departureTime)}
                      </span>
                    </div>
                    <div className="mt-2 truncate font-display text-base font-semibold">
                      {t.originName} &rarr; {t.destinationName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceKm(t.distanceKm)} &middot; {t.comfortClass}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="text-left text-xs sm:text-right">
                      <div className="tabular font-medium">{formatMwk(t.farePerSeatMwk)}</div>
                      <div className="text-muted-foreground">
                        {t.availableSeats} available
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {t.status === "scheduled" && (
                        <Button
                          size="sm"
                          className="gap-1.5 animate-pulse"
                          onClick={() => notifyBoarding.mutate(t.id)}
                          disabled={isUpdatingBoarding}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Notify passengers you are at boarding point
                        </Button>
                      )}
                      {t.status === "boarding" && (
                        <Button
                          size="sm"
                          className="gap-1.5 animate-pulse"
                          onClick={() => startTrip.mutate(t.id)}
                          disabled={isStarting}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Start trip and share GPS
                        </Button>
                      )}
                      {t.status === "in_transit" && (
                        <Button asChild size="sm" variant="outline" className="gap-2">
                          <Link to="/trips/$id/location" params={{ id: t.id }}>
                            <MapPin className="h-4 w-4" />
                            <span className="sm:hidden">Location</span>
                            <span className="hidden sm:inline">View driver location</span>
                          </Link>
                        </Button>
                      )}
                      {(t.status === "scheduled" || t.status === "boarding") && !t.startedAt && (
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <Link to="/driver/trips/$id/edit" params={{ id: t.id }}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost" className="gap-1.5">
                        <Link to="/driver/trips/$id" params={{ id: t.id }}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
