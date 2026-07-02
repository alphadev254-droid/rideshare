import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { bookingService, type Booking, type Trip } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { formatMwk } from "@/lib/format";
import { toast } from "sonner";

export function PassengerManifestPanel({ trip, bookings }: { trip: Trip; bookings: Booking[] }) {
  const queryClient = useQueryClient();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const verify = useMutation({
    mutationFn: ({ bookingId, code }: { bookingId: string; code: string }) =>
      bookingService.verifyCode(bookingId, code),
    onSuccess: (res) => {
      toast.success(`${res.seatsBooked} passenger${res.seatsBooked === 1 ? "" : "s"} checked in`);
      queryClient.invalidateQueries({ queryKey: ["bookings", "trip", trip.id] });
    },
  });

  return (
    <div className="rounded-md border border-border bg-card p-2.5 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="label-eyebrow">Passenger manifest</h3>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
            View booked passengers, their routes, travelers, payment status, and verify boarding
            codes.
          </p>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </div>
      </div>

      {bookings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <>
          <div className="mt-2 space-y-2 md:hidden">
            {bookings.map((booking) => (
              <MobilePassengerCard
                key={booking.id}
                booking={booking}
                trip={trip}
                code={codes[booking.id] ?? ""}
                isVerifying={verify.isPending}
                onCodeChange={(value) =>
                  setCodes((current) => ({ ...current, [booking.id]: value.toUpperCase() }))
                }
                onVerify={() =>
                  verify.mutate({ bookingId: booking.id, code: codes[booking.id] ?? "" })
                }
              />
            ))}
          </div>

          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Passenger</th>
                  <th className="px-3 py-2 font-medium">Booked route</th>
                  <th className="px-3 py-2 font-medium">Boarding</th>
                  <th className="px-3 py-2 font-medium">Drop-off</th>
                  <th className="px-3 py-2 font-medium">Seats</th>
                  <th className="px-3 py-2 font-medium">Travelers</th>
                  <th className="px-3 py-2 font-medium">Fare</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Verify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((booking) => {
                  const route = bookingRouteLabel(booking, trip);
                  const travelers = travelerSummary(booking);
                  return (
                    <tr key={booking.id} className="align-middle">
                      <td className="max-w-[190px] px-3 py-2">
                        <div className="truncate font-medium">{booking.passenger?.fullName}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {booking.passenger?.phone}
                        </div>
                      </td>
                      <td className="max-w-[210px] px-3 py-2">
                        <div className="truncate font-medium">{route}</div>
                      </td>
                      <td className="max-w-[170px] px-3 py-2">
                        <div className="truncate text-xs text-muted-foreground">
                          {booking.boardingPoint}
                        </div>
                      </td>
                      <td className="max-w-[170px] px-3 py-2">
                        <div className="truncate text-xs text-muted-foreground">
                          {booking.dropOffPoint ??
                            booking.segment?.toStop?.name ??
                            trip.destinationName}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" /> {booking.seatsBooked ?? 1}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-3 py-2">
                        <div className="truncate text-xs text-muted-foreground" title={travelers}>
                          {travelers}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium tabular-nums">
                        {formatMwk(booking.fareMwk)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <StatusPill status={booking.status} />
                          <span className="text-[10px] text-muted-foreground">
                            {booking.paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          {booking.status === "confirmed" && (
                            <>
                              <Input
                                placeholder="Code"
                                value={codes[booking.id] ?? ""}
                                onChange={(event) =>
                                  setCodes((current) => ({
                                    ...current,
                                    [booking.id]: event.target.value.toUpperCase(),
                                  }))
                                }
                                className="h-8 w-24 font-mono uppercase"
                                maxLength={6}
                              />
                              <Button
                                size="sm"
                                onClick={() =>
                                  verify.mutate({
                                    bookingId: booking.id,
                                    code: codes[booking.id] ?? "",
                                  })
                                }
                                disabled={!codes[booking.id] || verify.isPending}
                              >
                                Verify
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MobilePassengerCard({
  booking,
  trip,
  code,
  isVerifying,
  onCodeChange,
  onVerify,
}: {
  booking: Booking;
  trip: Trip;
  code: string;
  isVerifying: boolean;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2/50 p-2 sm:p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{booking.passenger?.fullName}</div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {booking.passenger?.phone}
          </div>
        </div>
        <StatusPill status={booking.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
        <MobileManifestDetail label="Route" value={bookingRouteLabel(booking, trip)} />
        <MobileManifestDetail label="Boarding" value={booking.boardingPoint} />
        <MobileManifestDetail
          label="Drop-off"
          value={booking.dropOffPoint ?? booking.segment?.toStop?.name ?? trip.destinationName}
        />
        <MobileManifestDetail label="Seats" value={String(booking.seatsBooked ?? 1)} />
        <MobileManifestDetail label="Fare" value={formatMwk(booking.fareMwk)} />
        <MobileManifestDetail label="Payment" value={booking.paymentStatus} />
        <MobileManifestDetail label="Travelers" value={travelerSummary(booking)} />
      </div>
      {booking.status === "confirmed" && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <Input
            placeholder="Code"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            className="h-8 font-mono uppercase"
            maxLength={6}
          />
          <Button size="sm" onClick={onVerify} disabled={!code || isVerifying}>
            Verify
          </Button>
        </div>
      )}
    </div>
  );
}

function MobileManifestDetail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium text-foreground">{value || "Not set"}</div>
    </div>
  );
}

function bookingRouteLabel(booking: Booking, trip: Trip) {
  return booking.segment
    ? `${booking.segment.fromStop?.name ?? booking.boardingPoint} to ${booking.segment.toStop?.name ?? booking.dropOffPoint ?? "Drop-off"}`
    : `${booking.trip?.originName ?? trip.originName} to ${booking.trip?.destinationName ?? trip.destinationName}`;
}

function travelerSummary(booking: Booking) {
  const travelers = booking.travelers ?? [];
  return travelers.length > 0
    ? travelers.map((traveler) => traveler.fullName).join(", ")
    : (booking.passenger?.fullName ?? "Passenger");
}
