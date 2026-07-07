import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { bookingService } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatMwk } from "@/lib/format";
import { CalendarClock, Eye, MapPinned, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/bookings/")({
  component: BookingsList,
});

function BookingsList() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: () => bookingService.mine(),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("passengerBookings.eyebrow")} title={t("passengerBookings.title")} description={t("passengerBookings.description")} />
      {isLoading && <LoadingState />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<Ticket className="h-5 w-5" />}
          title={t("passengerBookings.none")}
          description={t("passengerBookings.noneHint")}
          action={
            <Link to="/app">
              <Button>{t("passengerNav.findRide")}</Button>
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((b) => {
            const route = bookingRoute(b);
            return (
              <li key={b.id}>
                <article className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/45 sm:p-5">
                  <div className="flex items-stretch justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={b.status} />
                        <StatusPill status={b.paymentStatus} />
                      </div>

                      <div className="route-rail mt-4 space-y-3 pl-6">
                        <div className="relative flex items-center gap-2">
                          <span className="route-dot absolute -left-6" />
                          <span className="truncate font-display text-lg font-semibold sm:text-xl">
                            {route.from}
                          </span>
                        </div>
                        <div className="relative flex items-center gap-2">
                          <span className="route-dot absolute -left-6 bg-primary" />
                          <span className="truncate font-display text-lg font-semibold sm:text-xl">
                            {route.to}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 text-gold" />
                          {formatDateTime(b.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-route" />
                          {t("passengerBookings.seatsBooked", {
                            seats: b.seatsBooked ?? 1,
                            plural: (b.seatsBooked ?? 1) === 1 ? "" : "s",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex w-24 shrink-0 flex-col items-end justify-between gap-3 border-l border-border pl-3 sm:w-32 sm:pl-5">
                      <div className="text-right">
                        <div className="label-eyebrow">{t("passengerBookings.fare")}</div>
                        <div className="mt-1 font-display text-lg font-semibold tabular-nums text-gold sm:text-xl">
                          {formatMwk(b.fareMwk)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {b.trip?.status === "in_transit" && (
                          <Link to="/trips/$id/location" params={{ id: b.tripId }}>
                            <Button size="sm" variant="outline" className="gap-2">
                              <MapPinned className="h-4 w-4" />
                              <span className="hidden sm:inline">{t("passengerBookings.location")}</span>
                            </Button>
                          </Link>
                        )}
                        <Link to="/app/bookings/$id" params={{ id: b.id }}>
                          <Button size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            {t("driverCommon.view")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function bookingRoute(booking: Awaited<ReturnType<typeof bookingService.mine>>[number]) {
  const from =
    booking.segment?.fromStop?.name ??
    booking.boardingPoint ??
    booking.trip?.originName ??
    "Boarding";
  const to =
    booking.segment?.toStop?.name ??
    booking.dropOffPoint ??
    booking.trip?.destinationName ??
    "Drop-off";
  return { from, to };
}
