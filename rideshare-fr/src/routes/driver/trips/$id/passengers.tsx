import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { bookingService, tripService } from "@/lib/api";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PassengerManifestPanel } from "@/components/driver-trips/passenger-manifest-panel";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/driver/trips/$id/passengers")({
  component: TripPassengersPage,
});

function TripPassengersPage() {
  const { id } = Route.useParams();
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => tripService.byId(id),
  });
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings", "trip", id],
    queryFn: () => bookingService.byTrip(id),
  });

  if (tripLoading || bookingsLoading) return <LoadingState />;
  if (!trip) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:p-6">
        Trip not found.
      </div>
    );
  }

  const passengerBookings = bookings ?? [];
  const totalSeats = passengerBookings.reduce(
    (total, booking) => total + (booking.seatsBooked ?? 1),
    0,
  );
  const checkedInCount = passengerBookings.filter(
    (booking) => booking.status === "authenticated",
  ).length;
  const awaitingVerificationCount = passengerBookings.filter(
    (booking) => booking.status === "confirmed",
  ).length;

  return (
    <div className="space-y-3 sm:space-y-5">
      <PageHeader
        eyebrow="Passenger manifest"
        className="gap-3 pb-4"
        title={
          <span className="flex min-w-0 items-center gap-2">
            <Link
              to="/driver/trips/$id"
              params={{ id }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              aria-label="Back to trip"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-0 truncate">
              {trip.originName} to {trip.destinationName}
            </span>
          </span>
        }
        description={formatDateTime(trip.departureTime)}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/driver/trips/$id" params={{ id }}>
              Trip timeline
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        <ManifestMetric label="Bookings" value={String(passengerBookings.length)} />
        <ManifestMetric label="Seats booked" value={String(totalSeats)} />
        <ManifestMetric label="Checked in" value={String(checkedInCount)} />
        <ManifestMetric label="To verify" value={String(awaitingVerificationCount)} />
      </div>

      <PassengerManifestPanel trip={trip} bookings={passengerBookings} />
    </div>
  );
}

function ManifestMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2 sm:p-4">
      <div className="truncate text-[8px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:mt-1 sm:text-2xl">
        {value}
      </div>
    </div>
  );
}
