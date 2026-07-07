import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { BookingSeatsFields } from "@/components/booking-seats-fields";
import { PaymentMethodFields } from "@/components/payment-method-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ApiError,
  type PendingPayment,
  type PaymentMethod,
  paymentService,
  tripService,
  userService,
  type ComfortClass,
  type Trip,
  type User,
  locationService,
} from "@/lib/api";
import { formatMwk, formatDateTime, formatDistanceKm, formatDuration } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { SecureImage } from "@/components/secure-image";
import { useDebounce } from "@/hooks/use-debounce";
import { clearPendingTripId, getPendingTripId } from "@/lib/pending-trip";
import { TripOfferCard } from "@/components/trip-offer-card";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/")({
  component: PassengerHome,
});

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Date(2026, index, 1).toLocaleDateString(undefined, { month: "short" }),
}));

function daysInMonth(year: string, month: string) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function dateValue(year: string, month: string, day: string) {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function availableDays(year: string, month: string) {
  if (!year || !month) return [];
  return Array.from({ length: daysInMonth(year, month) }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
}

function PassengerHome() {
  const { t } = useI18n();
  const activeTripId = typeof window === "undefined" ? undefined : (getPendingTripId() ?? undefined);
  const { user, setUser } = useAuth();
  const [page, setPage] = useState(1);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originSearch, setOriginSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const debouncedOriginSearch = useDebounce(originSearch, 200);
  const debouncedDestSearch = useDebounce(destSearch, 200);
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);

  const { data: districts } = useQuery({
    queryKey: ["locations", "districts"],
    queryFn: () => locationService.districts(),
    staleTime: 60 * 60 * 1000,
  });

  const filteredOriginDistricts = useMemo(() => {
    if (!districts) return [];
    const q = debouncedOriginSearch.toLowerCase().trim();
    if (!q) return districts;
    return districts.filter((d) => d.toLowerCase().includes(q));
  }, [districts, debouncedOriginSearch]);

  const filteredDestDistricts = useMemo(() => {
    if (!districts) return [];
    const q = debouncedDestSearch.toLowerCase().trim();
    if (!q) return districts;
    return districts.filter((d) => d.toLowerCase().includes(q));
  }, [districts, debouncedDestSearch]);
  const [dateYear, setDateYear] = useState("");
  const [dateMonth, setDateMonth] = useState("");
  const [dateDay, setDateDay] = useState("");
  const [seats, setSeats] = useState("any");
  const [comfortClass, setComfortClass] = useState<string>("any");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("airtel_money");
  const [seatsBooked, setSeatsBooked] = useState(1);
  const [travelerNames, setTravelerNames] = useState<string[]>([]);
  const date = dateValue(dateYear, dateMonth, dateDay);
  const years = Array.from({ length: 3 }, (_, index) => String(new Date().getFullYear() + index));
  const dayOptions = availableDays(dateYear, dateMonth);

  const { data: pendingTrip } = useQuery({
    queryKey: ["trip", activeTripId],
    queryFn: () => tripService.byId(activeTripId!),
    enabled: !!activeTripId,
  });

  const { data: publicTrips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["trips", "public", { page, origin, destination, date, seats, comfortClass }],
    queryFn: () =>
      tripService.publicList({
        page,
        limit: 50,
        originName: origin,
        destName: destination,
        date: date || undefined,
        seats: seats === "any" ? undefined : Number(seats),
        comfortClass: comfortClass === "any" ? undefined : (comfortClass as ComfortClass),
      }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
  const trips = publicTrips?.items ?? [];

  useEffect(() => {
    if (!activeTripId || selectedTrip?.id === activeTripId) return;
    const listedTrip = trips.find((trip) => trip.id === activeTripId);
    if (listedTrip) {
      setSelectedTrip(listedTrip);
      clearPendingTripId();
      return;
    }
    if (pendingTrip) {
      setSelectedTrip(pendingTrip);
      clearPendingTripId();
    }
  }, [activeTripId, pendingTrip, selectedTrip?.id, trips]);
  const totalPages = publicTrips ? Math.max(1, Math.ceil(publicTrips.total / publicTrips.limit)) : 1;
  const fullyBooked = (selectedTrip?.availableSeats ?? 0) <= 0;
  const needsEmergencyContact = !user?.emergencyContactPhone;

  useEffect(() => {
    setEmergencyName(user?.emergencyContactName ?? "");
    setEmergencyPhone(user?.emergencyContactPhone ?? "");
    setPaymentPhone(user?.phone ?? "");
  }, [user]);

  const saveEmergencyContact = useMutation({
    mutationFn: () =>
      userService.updateMe({
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      }),
    onSuccess: (updatedUser: User) => {
      setUser(updatedUser);
      toast.success("Emergency contact saved");
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not save emergency contact");
    },
  });

  const book = useMutation({
    mutationFn: async (trip: Trip) => {
      return paymentService.initiateRide({
        tripId: trip.id,
        segmentId: trip.segmentId ?? undefined,
        boardingPoint: trip.pickupPoint || trip.originName,
        dropOffPoint: trip.dropOffPoint || trip.destinationName,
        seatsBooked,
        travelerNames: travelerNames.map((name) => name.trim()).filter(Boolean),
        phone: paymentPhone,
        method: paymentMethod,
      });
    },
    onSuccess: (payment: PendingPayment & { checkoutUrl?: string | null }) => {
      toast.success("Opening secure payment.");
      setSelectedTrip(null);
      if (payment?.checkoutUrl) {
        window.location.assign(payment.checkoutUrl);
        return;
      }
      if (payment?.txRef) {
        window.location.assign(`/app/payments/callback?tx_ref=${encodeURIComponent(payment.txRef)}`);
        return;
      }
      toast.error("Could not start payment confirmation");
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : t("trips.toast.paymentFailed"));
    },
  });

  async function reserveSelectedTrip() {
    if (!selectedTrip) return;
    if (!paymentPhone.trim()) {
      toast.error(t("trips.toast.paymentPhoneRequired"));
      return;
    }
    if (needsEmergencyContact) {
      if (!emergencyPhone.trim()) {
        toast.error(t("trips.toast.emergencyPhoneRequired"));
        return;
      }
      try {
        await saveEmergencyContact.mutateAsync();
      } catch {
        return;
      }
    }
    book.mutate(selectedTrip);
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function updateDateYear(value: string) {
    setDateYear(value);
    if (dateMonth && Number(dateDay) > daysInMonth(value, dateMonth)) setDateDay("");
    setPage(1);
  }

  function updateDateMonth(value: string) {
    setDateMonth(value);
    if (dateYear && Number(dateDay) > daysInMonth(dateYear, value)) setDateDay("");
    setPage(1);
  }

  function updateDateDay(value: string) {
    setDateDay(value);
    setPage(1);
  }

  function clearDate() {
    setDateYear("");
    setDateMonth("");
    setDateDay("");
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={user ? t("passengerHome.welcomeName", { name: user.fullName.split(" ")[0] }) : t("passengerHome.welcome")}
        title={t("passengerHome.title")}
        description={t("passengerHome.description")}
      />

      <div className="rounded-md border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">{t("trips.from")}</Label>
            <DistrictSearch
              selectedValue={origin}
              searchValue={originSearch}
              onSearchChange={setOriginSearch}
              onSelect={(district) => { setOrigin(district); setOriginSearch(""); setOriginDropdownOpen(false); setPage(1); }}
              onClear={() => { setOrigin(""); setOriginSearch(""); setPage(1); }}
              open={originDropdownOpen}
              onOpenChange={setOriginDropdownOpen}
              districts={filteredOriginDistricts}
              placeholder={t("trips.searchPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">{t("trips.to")}</Label>
            <DistrictSearch
              selectedValue={destination}
              searchValue={destSearch}
              onSearchChange={setDestSearch}
              onSelect={(district) => { setDestination(district); setDestSearch(""); setDestDropdownOpen(false); setPage(1); }}
              onClear={() => { setDestination(""); setDestSearch(""); setPage(1); }}
              open={destDropdownOpen}
              onOpenChange={setDestDropdownOpen}
              districts={filteredDestDistricts}
              placeholder={t("trips.searchPlaceholder")}
            />
          </div>
          <div className="col-span-2 space-y-1.5 lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="label-eyebrow">{t("trips.departureDate")}</Label>
              {(dateYear || dateMonth || dateDay) && (
                <button
                  type="button"
                  onClick={clearDate}
                  className="text-xs text-primary hover:underline"
                >
                  {t("trips.clear")}
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1.15fr_1.25fr_0.9fr] gap-2">
              <Select value={dateYear} onValueChange={updateDateYear}>
                <SelectTrigger>
                  <SelectValue placeholder={t("trips.year")} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateMonth} onValueChange={updateDateMonth}>
                <SelectTrigger>
                  <SelectValue placeholder={t("trips.month")} />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateDay} onValueChange={updateDateDay}>
                <SelectTrigger disabled={!dateYear || !dateMonth}>
                  <SelectValue placeholder={t("trips.day")} />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">{t("trips.seats")}</Label>
            <Select value={seats} onValueChange={(v) => updateFilter(setSeats, v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("trips.all")}</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">{t("trips.class")}</Label>
            <Select value={comfortClass} onValueChange={(v: string) => updateFilter(setComfortClass, v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("trips.any")}</SelectItem>
                <SelectItem value="economy">{t("trips.economy")}</SelectItem>
                <SelectItem value="standard">{t("trips.standard")}</SelectItem>
                <SelectItem value="comfort">{t("trips.comfort")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("trips.available")}</h2>
          </div>
          {publicTrips && (
            <div className="text-xs text-muted-foreground">
              {t("trips.page")} {publicTrips.page} {t("trips.of")} {totalPages} - {publicTrips.total} {t("trips.tripCount")}
            </div>
          )}
        </div>

        {isLoadingTrips ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("trips.loading")}
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("passengerHome.noTrips")}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <li key={`${trip.id}-${trip.segmentId ?? "main"}`}>
                <TripOfferCard trip={trip} onAction={setSelectedTrip} />
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page <= 1 || isLoadingTrips}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t("trips.previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {publicTrips ? `${publicTrips.items.length} ${t("trips.shown")}` : `0 ${t("trips.shown")}`}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages || isLoadingTrips}
            onClick={() => setPage((current) => current + 1)}
          >
            {t("trips.next")}
          </Button>
        </div>
      </section>

      <RideDetailsDialog
        trip={selectedTrip}
        open={!!selectedTrip}
        isBooking={book.isPending}
        isSavingEmergency={saveEmergencyContact.isPending}
        fullyBooked={fullyBooked}
        needsEmergencyContact={needsEmergencyContact}
        emergencyName={emergencyName}
        emergencyPhone={emergencyPhone}
        paymentPhone={paymentPhone}
        paymentMethod={paymentMethod}
        seatsBooked={seatsBooked}
        travelerNames={travelerNames}
        primaryName={user?.fullName ?? "You"}
        onSeatsBookedChange={setSeatsBooked}
        onTravelerNamesChange={setTravelerNames}
        onEmergencyNameChange={setEmergencyName}
        onEmergencyPhoneChange={setEmergencyPhone}
        onPaymentPhoneChange={setPaymentPhone}
        onPaymentMethodChange={setPaymentMethod}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTrip(null);
            setSeatsBooked(1);
            setTravelerNames([]);
          }
        }}
        onReserve={reserveSelectedTrip}
      />
    </div>
  );
}

function RideDetailsDialog({
  trip,
  open,
  isBooking,
  isSavingEmergency,
  fullyBooked,
  needsEmergencyContact,
  emergencyName,
  emergencyPhone,
  paymentPhone,
  paymentMethod,
  seatsBooked,
  travelerNames,
  primaryName,
  onSeatsBookedChange,
  onTravelerNamesChange,
  onEmergencyNameChange,
  onEmergencyPhoneChange,
  onPaymentPhoneChange,
  onPaymentMethodChange,
  onOpenChange,
  onReserve,
}: {
  trip: Trip | null;
  open: boolean;
  isBooking: boolean;
  isSavingEmergency: boolean;
  fullyBooked: boolean;
  needsEmergencyContact: boolean;
  emergencyName: string;
  emergencyPhone: string;
  paymentPhone: string;
  paymentMethod: PaymentMethod;
  seatsBooked: number;
  travelerNames: string[];
  primaryName: string;
  onSeatsBookedChange: (value: number) => void;
  onTravelerNamesChange: (value: string[]) => void;
  onEmergencyNameChange: (value: string) => void;
  onEmergencyPhoneChange: (value: string) => void;
  onPaymentPhoneChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onOpenChange: (open: boolean) => void;
  onReserve: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  if (!trip) return null;
  const totalFareMwk = Number(trip.farePerSeatMwk) * seatsBooked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {trip.originName} {t("tripCard.to")} {trip.dropOffPoint || trip.destinationName}
          </DialogTitle>
          <DialogDescription>{t("driverTripForm.departureTime")}: {formatDateTime(trip.departureTime)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 text-sm">
            <Detail label={t("passengerBookings.fare")} value={formatMwk(trip.farePerSeatMwk)} />
            <Detail label={t("passengerTrip.availableSeats")} value={String(trip.availableSeats)} />
            <Detail label={t("driverRoute.distance")} value={formatDistanceKm(trip.distanceKm)} />
            <Detail
              label={t("passengerTrip.duration")}
              value={
                trip.estimatedDurationMinutes ? formatDuration(trip.estimatedDurationMinutes) : t("driverCommon.notSet")
              }
            />
            <Detail label={t("trips.class")} value={trip.comfortClass} />
            <Detail
              label={t("driverTripForm.vehicle")}
              value={
                trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : t("passengerTrip.vehiclePending")
              }
            />
            {trip.vehicle?.plateNumber && <Detail label={t("passengerTrip.plate")} value={trip.vehicle.plateNumber} />}
            {trip.vehicle?.color && <Detail label={t("driverVehicles.color")} value={trip.vehicle.color} />}
          </div>

          <div className="rounded-md border border-border bg-surface-2 p-4 text-sm">
            <div className="label-eyebrow">{t("passengerTrip.pickupDropoff")}</div>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">{t("trips.boardingPoint")}</div>
                  <div className="text-muted-foreground">{trip.pickupPoint || trip.originName}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">{t("trips.dropOffPoint")}</div>
                  <div className="text-muted-foreground">{trip.dropOffPoint || trip.destinationName}</div>
                </div>
              </div>
            </div>
          </div>

          {needsEmergencyContact && (
            <div className="rounded-md border border-gold/40 bg-gold/5 p-4">
              <div className="label-eyebrow text-gold">{t("trips.emergencyRequired")}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">{t("trips.contactName")}</Label>
                  <Input value={emergencyName} onChange={(e) => onEmergencyNameChange(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">{t("trips.contactPhone")}</Label>
                  <Input
                    value={emergencyPhone}
                    onChange={(e) => onEmergencyPhoneChange(e.target.value)}
                    placeholder="Example: +265..."
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md border border-border bg-card p-4">
            <div className="label-eyebrow">{t("trips.payment")}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("passengerTrip.paymentHelp")}
            </p>
            <div className="mt-3 space-y-3">
              <BookingSeatsFields
                availableSeats={trip.availableSeats}
                seatsBooked={seatsBooked}
                onSeatsBookedChange={onSeatsBookedChange}
                travelerNames={travelerNames}
                onTravelerNamesChange={onTravelerNamesChange}
                primaryName={primaryName}
              />
              <PaymentMethodFields
                method={paymentMethod}
                phone={paymentPhone}
                onMethodChange={onPaymentMethodChange}
                onPhoneChange={onPaymentPhoneChange}
                disabled={isBooking || isSavingEmergency}
              />
            </div>
          </div>

          <Button
            className="h-11 w-full"
            disabled={fullyBooked || isBooking || isSavingEmergency || !paymentPhone.trim()}
            onClick={onReserve}
          >
            {fullyBooked
              ? t("trips.fullyBooked")
              : isBooking || isSavingEmergency
                ? t("trips.processingPayment")
                : t("trips.payBook", { amount: formatMwk(totalFareMwk), seats: seatsBooked, plural: seatsBooked === 1 ? "" : "s" })}
          </Button>

          {(trip.vehicle?.imageUrls?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="label-eyebrow">{t("trips.vehiclePhotos")}</div>
              <div className="grid grid-cols-2 gap-2">
                {(trip.vehicle?.imageUrls ?? []).slice(0, 4).map((url) => (
                  <SecureImage
                    key={url}
                    src={url}
                    alt={`${trip.vehicle?.make ?? t("driverTripForm.vehicle")} ${t("passengerTrip.photo")}`}
                    className="aspect-[4/3] w-full rounded-md border border-border object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium capitalize">{value}</div>
    </div>
  );
}


function DistrictSearch({
  selectedValue,
  searchValue,
  onSearchChange,
  onSelect,
  onClear,
  open,
  onOpenChange,
  districts,
  placeholder,
}: {
  selectedValue: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (district: string) => void;
  onClear: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districts: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      {selectedValue ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="flex w-full items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-2 pr-9 text-left"
          >
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{selectedValue}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => { onSearchChange(e.target.value); onOpenChange(true); }}
            onFocus={() => onOpenChange(true)}
            placeholder={placeholder}
            className="pl-9"
          />
          {open && districts.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {districts.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                  onClick={() => onSelect(d)}
                >
                  <MapPin className="mr-2 inline h-3.5 w-3.5 text-muted-foreground" />
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {selectedValue && open && districts.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {districts.map((d) => (
            <button
              key={d}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
              onClick={() => onSelect(d)}
            >
              <MapPin className="mr-2 inline h-3.5 w-3.5 text-muted-foreground" />
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
