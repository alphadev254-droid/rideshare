import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { tripService, type TripStatus } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatMwk, formatDistanceKm } from "@/lib/format";
import { Eye, KeyRound, MapPin, Pencil, Play, Plus, Route as RouteIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type StatusFilter = TripStatus | "all";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "boarding", label: "Boarding" },
  { value: "in_transit", label: "In transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const Route = createFileRoute("/driver/trips/")({
  component: TripsList,
});

function TripsList() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["trips", "mine"],
    queryFn: () => tripService.mine(),
  });

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: data?.length ?? 0,
      scheduled: 0,
      boarding: 0,
      in_transit: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const trip of data ?? []) {
      counts[trip.status] += 1;
    }
    return counts;
  }, [data]);

  const filteredTrips = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data;
    return data.filter((trip) => trip.status === statusFilter);
  }, [data, statusFilter]);

  const notifyBoarding = useMutation({
    mutationFn: (id: string) => tripService.setStatus(id, "boarding"),
    onSuccess: () => {
      toast.success("Passengers notified that you've arrived");
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
        className="flex-row items-end justify-between gap-3 pb-4"
        actions={
          <Link to="/driver/trips/new">
            <Button size="sm" className="shrink-0 gap-2 sm:h-10 sm:px-4 sm:py-2">
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
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 rounded-md border border-border bg-card p-2">
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                    {statusCounts[filter.value]}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredTrips.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
              No{" "}
              {STATUS_FILTERS.find((filter) => filter.value === statusFilter)?.label.toLowerCase()}{" "}
              trips found.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredTrips.map((t) => {
                const isUpdatingBoarding =
                  notifyBoarding.isPending && notifyBoarding.variables === t.id;
                const isStarting = startTrip.isPending && startTrip.variables === t.id;

                return (
                  <li key={t.id}>
                    <div className="rounded-md border border-border bg-card p-3 transition-colors hover:border-border-strong sm:p-4">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusPill status={t.status} />
                          <span className="truncate text-xs text-muted-foreground">
                            {formatDateTime(t.departureTime)}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold tabular-nums sm:text-base">
                            {formatMwk(t.farePerSeatMwk)}
                          </div>
                          <div className="text-[11px] text-muted-foreground sm:text-xs">
                            {t.availableSeats} available
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="min-w-0">
                          <div className="truncate font-display text-base font-semibold sm:text-lg">
                            {t.originName} &rarr; {t.destinationName}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatDistanceKm(t.distanceKm)} &middot; {t.comfortClass}
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
                              <span>Notify passengers you've arrived</span>
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
                              <span className="sm:hidden">Start trip</span>
                              <span className="hidden sm:inline">Start trip and share GPS</span>
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
                          {(t.status === "scheduled" || t.status === "boarding") &&
                            !t.startedAt && (
                              <Button asChild size="sm" variant="outline" className="gap-1.5">
                                <Link to="/driver/trips/$id/edit" params={{ id: t.id }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Link>
                              </Button>
                            )}
                          <Button asChild size="sm" variant="outline" className="gap-1.5">
                            <Link to="/driver/trips/$id/passengers" params={{ id: t.id }}>
                              <Users className="h-3.5 w-3.5" />
                              View passengers who booked
                            </Link>
                          </Button>
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
      )}
    </div>
  );
}
