import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { driverService, tripService, isDriverNotOnboardedError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { LoadingState } from "@/components/loading-state";
import { formatMwk, formatDateTime } from "@/lib/format";
import { Star, Wallet, Car, Clock, ArrowRight, Plus, AlertCircle, Users, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/driver/")({
  component: DriverDashboard,
});

function DriverDashboard() {
  const navigate = useNavigate();

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["driver", "dashboard"],
    queryFn: () => driverService.dashboard(),
    meta: { silent: true }, // suppress default error toast
    retry: false,
  });

  const { data: trips } = useQuery({
    queryKey: ["trips", "mine"],
    queryFn: () => tripService.mine(),
    meta: { silent: true },
    retry: false,
  });

  // Redirect to onboarding only for the backend's explicit driver setup state.
  useEffect(() => {
    if (isDriverNotOnboardedError(error)) {
      navigate({ to: "/driver/onboarding", replace: true });
    }
  }, [error, navigate]);

  const upcoming = (trips ?? [])
    .filter((t) => t.status === "scheduled" || t.status === "boarding")
    .slice(0, 4);
  const liveTrips = (trips ?? []).filter((t) => t.status === "boarding" || t.status === "in_transit");
  const openSeats = (trips ?? [])
    .filter((t) => t.status === "scheduled" || t.status === "boarding")
    .reduce((total, trip) => total + Number(trip.availableSeats || 0), 0);
  const nextTrip = upcoming[0];

  // Show a funnel message while the redirect settles.
  if (!isLoading && isDriverNotOnboardedError(error)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="mb-4 h-12 w-12 text-gold" />
        <h2 className="font-display text-xl font-semibold">No driver profile yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to complete onboarding before you can access the dashboard.
        </p>
        <Button className="mt-6" onClick={() => navigate({ to: "/driver/onboarding" })}>
          Go to Onboarding
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Driver console"
        title="At a glance"
        description="Earnings, ratings and trips in motion."
        actions={
          <Link to="/driver/trips/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New trip
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        stats && (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
            <StatCard
              label="Total earned"
              value={formatMwk(stats.totalEarningsMwk)}
              icon={<Wallet className="h-4 w-4" />}
              accent="primary"
            />
            <StatCard
              label="Wallet balance"
              value={formatMwk(stats.balanceMwk)}
              hint="Available to withdraw"
              icon={<Wallet className="h-4 w-4" />}
              accent="gold"
            />
            <StatCard
              label="Trips completed"
              value={stats.completedTrips ?? stats.totalTrips}
              icon={<Car className="h-4 w-4" />}
            />
            <StatCard
              label="Rating"
              value={
                stats.rating ? (
                  <span className="flex items-center gap-2">
                    {Number(stats.rating).toFixed(1)} <Star className="h-5 w-5 fill-gold text-gold" />
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">No ratings yet</span>
                )
              }
              hint={`${stats.completedTrips ?? stats.totalTrips} completed trip${(stats.completedTrips ?? stats.totalTrips) === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Upcoming"
              value={stats.scheduledTrips ?? stats.pendingTrips}
              hint={`${stats.boardingTrips ?? 0} boarding now`}
              icon={<RouteIcon className="h-4 w-4" />}
              accent="info"
            />
            <StatCard
              label="Open seats"
              value={openSeats}
              hint={nextTrip ? `Next: ${nextTrip.originName} to ${nextTrip.destinationName}` : "No seats listed"}
              icon={<Users className="h-4 w-4" />}
              accent="violet"
            />
          </div>
        )
      )}

      {stats && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="label-eyebrow">Trip pipeline</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <MiniStat label="Scheduled" value={stats.scheduledTrips ?? stats.pendingTrips} />
              <MiniStat label="Live" value={stats.activeTrips ?? liveTrips.length} />
              <MiniStat label="Cancelled" value={stats.cancelledTrips ?? 0} />
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 lg:col-span-2">
            <div className="label-eyebrow">Next departure</div>
            {nextTrip ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-semibold">
                    {nextTrip.originName} to {nextTrip.destinationName}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(nextTrip.departureTime)} · {nextTrip.availableSeats} seat{nextTrip.availableSeats === 1 ? "" : "s"} open
                  </div>
                </div>
                <Link to="/driver/trips/$id" params={{ id: nextTrip.id }}>
                  <Button size="sm" variant="outline" className="gap-2">
                    View trip <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No upcoming departure yet.</p>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold">Upcoming trips</h2>
          <Link to="/driver/trips" className="text-xs text-primary hover:underline">
            All trips
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No scheduled trips.{" "}
            <Link to="/driver/trips/new" className="text-primary hover:underline">
              Publish one
            </Link>
            .
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {upcoming.map((t) => (
              <li key={t.id}>
                <Link
                  to="/driver/trips/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4 transition-colors hover:border-border-strong"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={t.status} />
                      <span className="label-eyebrow flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(t.departureTime)}
                      </span>
                    </div>
                    <div className="mt-2 font-display text-base font-semibold">
                      {t.originName} → {t.destinationName}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs">
                      <div className="tabular font-medium">{formatMwk(t.farePerSeatMwk)}</div>
                      <div className="text-muted-foreground">
                        {t.availableSeats} available
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
