import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  paymentService,
  tripService,
  userService,
  ApiError,
  type PaymentMethod,
  type PendingPayment,
  type User as ApiUser,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { BookingSeatsFields } from "@/components/booking-seats-fields";
import { PaymentMethodFields } from "@/components/payment-method-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMwk, formatDateTime, formatDistanceKm, formatDuration } from "@/lib/format";
import { ArrowLeft, Car, MapPin, Star, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/trips/$id")({
  component: TripDetail,
});

function TripDetail() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const { user, setUser } = useAuth();
  const [payPhone, setPayPhone] = useState(user?.phone ?? "");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("airtel_money");
  const [emergencyName, setEmergencyName] = useState(user?.emergencyContactName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyContactPhone ?? "");
  const [seatsBooked, setSeatsBooked] = useState(1);
  const [travelerNames, setTravelerNames] = useState<string[]>([]);
  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => tripService.byId(id),
  });

  useEffect(() => {
    setPayPhone(user?.phone ?? "");
    setEmergencyName(user?.emergencyContactName ?? "");
    setEmergencyPhone(user?.emergencyContactPhone ?? "");
  }, [user]);

  const saveEmergencyContact = useMutation({
    mutationFn: () =>
      userService.updateMe({
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      }),
    onSuccess: (updatedUser: ApiUser) => {
      setUser(updatedUser);
      toast.success(t("passengerBookingDetail.emergencySaved"));
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : t("passengerBookingDetail.emergencySaveFailed")),
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!trip) throw new Error(t("passengerTrip.notLoaded"));
      if (!payPhone.trim()) throw new Error(t("trips.toast.paymentPhoneRequired"));
      if (!user?.emergencyContactPhone) {
        if (!emergencyPhone.trim()) throw new Error(t("passengerBookingDetail.emergencyPhoneRequired"));
        await saveEmergencyContact.mutateAsync();
      }
      return paymentService.initiateRide({
        tripId: id,
        segmentId: trip.segmentId ?? undefined,
        boardingPoint: trip.pickupPoint || trip.originName,
        dropOffPoint: trip.dropOffPoint || trip.destinationName,
        seatsBooked,
        travelerNames: travelerNames.map((name) => name.trim()).filter(Boolean),
        phone: payPhone,
        method: payMethod,
      });
    },
    onSuccess: (payment: PendingPayment) => {
      toast.success("Payment prompt sent. Approve it on your phone.");
      if (payment.txRef) window.location.assign(`/app/payments/callback?tx_ref=${encodeURIComponent(payment.txRef)}`);
    },
    onError: (e: Error) => toast.error(e instanceof Error ? e.message : t("trips.toast.paymentFailed")),
  });

  if (isLoading) return <LoadingState label={t("passengerTrip.loading")} />;
  if (error || !trip) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {t("passengerTrip.loadFailed")}
      </div>
    );
  }

  const fullyBooked = trip.availableSeats <= 0;
  const totalFareMwk = Number(trip.farePerSeatMwk) * seatsBooked;

  return (
    <div className="space-y-6">
      <Link
        to="/app"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("passengerTrip.backToRides")}
      </Link>

      <PageHeader
        eyebrow={trip.comfortClass}
        title={`${trip.originName} → ${trip.destinationName}`}
        description={`${t("driverTripForm.departureTime")}: ${formatDateTime(trip.departureTime)}`}
        actions={<StatusPill status={trip.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="label-eyebrow">{t("transactions.driver")}</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
                {trip.driver?.user.fullName
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <div className="font-display text-base font-semibold">
                  {trip.driver?.user.fullName}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-gold">
                  <Star className="h-3 w-3 fill-gold" /> {trip.driver?.user.rating ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="label-eyebrow">{t("driverTripForm.vehicle")}</h3>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-3 text-muted-foreground">
                <Car className="h-4 w-4" />
              </span>
              <div>
                <div className="font-display text-base font-semibold">
                  {trip.vehicle?.make} {trip.vehicle?.model}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {trip.vehicle?.plateNumber} · {trip.vehicle?.year}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="label-eyebrow">{t("passengerBookingDetail.tripDetails")}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("driverRoute.distance")}</dt>
                <dd className="mt-0.5 tabular font-medium">{formatDistanceKm(trip.distanceKm)}</dd>
              </div>
              {trip.estimatedDurationMinutes && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t("passengerTrip.approxDuration")}</dt>
                  <dd className="mt-0.5 tabular font-medium">
                    {formatDuration(trip.estimatedDurationMinutes)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">{t("passengerTrip.availableSeats")}</dt>
                <dd className="mt-0.5 tabular font-medium">
                  {trip.availableSeats}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("trips.class")}</dt>
                <dd className="mt-0.5 font-medium capitalize">{trip.comfortClass}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("driverTripForm.departureTime")}</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(trip.departureTime)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="label-eyebrow">{t("passengerTrip.farePerSeat")}</div>
            <div className="mt-2 font-display text-3xl font-semibold tabular">
              {formatMwk(trip.farePerSeatMwk)}
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <div className="rounded-md bg-surface-2 p-3 text-sm">
                <div className="label-eyebrow">{t("trips.boardingPoint")}</div>
                <div className="mt-1 font-medium">{trip.pickupPoint || trip.originName}</div>
              </div>
              <div className="rounded-md bg-surface-2 p-3 text-sm">
                <div className="label-eyebrow">{t("trips.dropOffPoint")}</div>
                <div className="mt-1 font-medium">{trip.dropOffPoint || trip.destinationName}</div>
              </div>
              {!user?.emergencyContactPhone && (
                <div className="space-y-3 rounded-md border border-gold/40 bg-gold/5 p-3">
                  <div className="label-eyebrow text-gold">{t("trips.emergencyRequired")}</div>
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">{t("trips.contactName")}</Label>
                    <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="label-eyebrow">{t("trips.contactPhone")}</Label>
                    <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
                  </div>
                </div>
              )}
              <BookingSeatsFields
                availableSeats={trip.availableSeats}
                seatsBooked={seatsBooked}
                onSeatsBookedChange={setSeatsBooked}
                travelerNames={travelerNames}
                onTravelerNamesChange={setTravelerNames}
                primaryName={user?.fullName ?? "You"}
              />
              <PaymentMethodFields
                method={payMethod}
                phone={payPhone}
                onMethodChange={setPayMethod}
                onPhoneChange={setPayPhone}
                disabled={book.isPending || saveEmergencyContact.isPending}
              />
              <Button
                type="button"
                className="w-full"
                disabled={fullyBooked || book.isPending || saveEmergencyContact.isPending || !payPhone.trim()}
                onClick={() => book.mutate()}
              >
                {fullyBooked ? t("trips.fullyBooked") : book.isPending ? t("trips.processingPayment") : t("trips.payBook", { amount: formatMwk(totalFareMwk), seats: seatsBooked, plural: seatsBooked === 1 ? "" : "s" })}
              </Button>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <User className="h-3 w-3" /> {t("passengerTrip.paymentHelp")}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
            <MapPin className="mb-1 inline h-3.5 w-3.5 text-primary" /> {t("passengerTrip.gpsHelp")}
          </div>
        </aside>
      </div>
    </div>
  );
}

