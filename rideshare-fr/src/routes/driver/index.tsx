import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { driverService, tripService, isDriverNotOnboardedError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { LoadingState } from "@/components/loading-state";
import { formatMwk, formatDateTime } from "@/lib/format";
import { Star, Wallet, Car, Clock, ArrowRight, Plus, AlertCircle } from "lucide-react";
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total earnings"
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
              value={stats.totalTrips}
              icon={<Car className="h-4 w-4" />}
            />
            <StatCard
              label="Rating"
              value={
                <span className="flex items-center gap-2">
                  {stats.rating} <Star className="h-5 w-5 fill-gold text-gold" />
                </span>
              }
              hint={`${stats.pendingTrips} pending`}
            />
          </div>
        )
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
                        {t.availableSeats}/{t.totalSeats} seats
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
