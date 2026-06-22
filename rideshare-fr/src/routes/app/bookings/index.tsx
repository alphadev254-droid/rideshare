import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { bookingService } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatMwk } from "@/lib/format";
import { ArrowRight, MapPinned, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/bookings/")({
  component: BookingsList,
});

function BookingsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: () => bookingService.mine(),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="History" title="My bookings" description="All trips you've reserved." />
      {isLoading && <LoadingState />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<Ticket className="h-5 w-5" />}
          title="No bookings yet"
          description="Find your first ride to see it here."
          action={
            <Link to="/app">
              <Button>Find a ride</Button>
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((b) => (
            <li key={b.id}>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-5">
                <div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={b.status} />
                    <StatusPill status={b.paymentStatus} />
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 font-display text-base font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {b.boardingPoint}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(b.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {b.trip?.status === "in_transit" && (
                    <Link to="/trips/$id/location" params={{ id: b.tripId }}>
                      <Button size="sm" variant="outline" className="gap-2">
                        <MapPinned className="h-4 w-4" />
                        View driver location
                      </Button>
                    </Link>
                  )}
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold tabular">
                      {formatMwk(b.fareMwk)}
                    </div>
                  </div>
                  <Link to="/app/bookings/$id" params={{ id: b.id }}>
                    <Button size="icon" variant="ghost">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
