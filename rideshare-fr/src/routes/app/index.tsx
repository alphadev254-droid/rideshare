import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
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
  ArrowRight,
  Car,
  Clock,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ApiError,
  type PendingPayment,
  paymentService,
  tripService,
  userService,
  type ComfortClass,
  type Trip,
  type User,
  locationService,
} from "@/lib/api";
import { formatMwk, formatDateTime, formatDistanceKm } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
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
        boardingPoint: trip.pickupPoint || trip.originName,
        dropOffPoint: trip.dropOffPoint || trip.destinationName,
        phone: paymentPhone,
      });
    },
    onSuccess: (payment: PendingPayment & { checkoutUrl?: string | null }) => {
      toast.success("Opening secure payment.");
      setSelectedTrip(null);
      if (payment?.checkoutUrl) {
        window.location.assign(payment.checkoutUrl);
        return;
      }
      toast.error("Could not open payment checkout");
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "Payment failed");
    },
  });

  async function reserveSelectedTrip() {
    if (!selectedTrip) return;
    if (!paymentPhone.trim()) {
      toast.error("Payment phone number is required");
      return;
    }
    if (needsEmergencyContact) {
      if (!emergencyPhone.trim()) {
        toast.error("Emergency phone number is required before reserving");
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
        eyebrow={`Welcome${user ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        title="Where are you going?"
        description="Search verified intercity trips. Pay securely with mobile money."
      />

      <div className="rounded-md border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">From</Label>
            <DistrictSearch
              selectedValue={origin}
              searchValue={originSearch}
              onSearchChange={setOriginSearch}
              onSelect={(district) => { setOrigin(district); setOriginSearch(""); setOriginDropdownOpen(false); setPage(1); }}
              onClear={() => { setOrigin(""); setOriginSearch(""); setPage(1); }}
              open={originDropdownOpen}
              onOpenChange={setOriginDropdownOpen}
              districts={filteredOriginDistricts}
              placeholder="Search districts..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">To</Label>
            <DistrictSearch
              selectedValue={destination}
              searchValue={destSearch}
              onSearchChange={setDestSearch}
              onSelect={(district) => { setDestination(district); setDestSearch(""); setDestDropdownOpen(false); setPage(1); }}
              onClear={() => { setDestination(""); setDestSearch(""); setPage(1); }}
              open={destDropdownOpen}
              onOpenChange={setDestDropdownOpen}
              districts={filteredDestDistricts}
              placeholder="Search districts..."
            />
          </div>
          <div className="col-span-2 space-y-1.5 lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="label-eyebrow">Departure date</Label>
              {(dateYear || dateMonth || dateDay) && (
                <button
                  type="button"
                  onClick={clearDate}
                  className="text-xs text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1.15fr_1.25fr_0.9fr] gap-2">
              <Select value={dateYear} onValueChange={updateDateYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Year" />
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
                  <SelectValue placeholder="Month" />
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
                  <SelectValue placeholder="Day" />
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
            <Label className="label-eyebrow">Seats</Label>
            <Select value={seats} onValueChange={(v) => updateFilter(setSeats, v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Class</Label>
            <Select value={comfortClass} onValueChange={(v: string) => updateFilter(setComfortClass, v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="economy">Economy</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="comfort">Comfort</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Available trips</h2>
          </div>
          {publicTrips && (
            <div className="text-xs text-muted-foreground">
              Page {publicTrips.page} of {totalPages} - {publicTrips.total} trips
            </div>
          )}
        </div>

        {isLoadingTrips ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading trips...
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No scheduled trips are available right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {trips.map((trip) => (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTrip(trip)}
                  className="flex w-full flex-col gap-4 rounded-md border border-border bg-card p-4 text-left transition-colors hover:border-border-strong sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={trip.status} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {trip.comfortClass}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-display text-base font-semibold">
                      <span className="truncate">{trip.originName}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{trip.dropOffPoint || trip.destinationName}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(trip.departureTime)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {formatDistanceKm(trip.distanceKm)}
                      </span>
                      {trip.vehicle && (
                        <span className="flex items-center gap-1.5">
                          <Car className="h-3 w-3" />
                          {trip.vehicle.make} {trip.vehicle.model}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <div className="text-right">
                      <div className="font-display text-xl font-semibold tabular">
                        {formatMwk(trip.farePerSeatMwk)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {trip.availableSeats} available
                      </div>
                    </div>
                    <Button asChild size="sm" className="gap-1.5">
                      <span>
                        View ride <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Button>
                  </div>
                </button>
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
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {publicTrips ? `${publicTrips.items.length} shown` : "0 shown"}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages || isLoadingTrips}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
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
        onEmergencyNameChange={setEmergencyName}
        onEmergencyPhoneChange={setEmergencyPhone}
        onPaymentPhoneChange={setPaymentPhone}
        onOpenChange={(open) => {
          if (!open) setSelectedTrip(null);
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
  onEmergencyNameChange,
  onEmergencyPhoneChange,
  onPaymentPhoneChange,
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
  onEmergencyNameChange: (value: string) => void;
  onEmergencyPhoneChange: (value: string) => void;
  onPaymentPhoneChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onReserve: () => Promise<void> | void;
}) {
  if (!trip) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {trip.originName} to {trip.dropOffPoint || trip.destinationName}
          </DialogTitle>
          <DialogDescription>Departure time: {formatDateTime(trip.departureTime)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 text-sm">
            <Detail label="Fare" value={formatMwk(trip.farePerSeatMwk)} />
            <Detail label="Available seats" value={String(trip.availableSeats)} />
            <Detail label="Distance" value={formatDistanceKm(trip.distanceKm)} />
            <Detail
              label="Duration"
              value={
                trip.estimatedDurationMinutes ? formatDuration(trip.estimatedDurationMinutes) : "Not set"
              }
            />
            <Detail label="Class" value={trip.comfortClass} />
            <Detail
              label="Vehicle"
              value={
                trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "Vehicle details pending"
              }
            />
            {trip.vehicle?.plateNumber && <Detail label="Plate" value={trip.vehicle.plateNumber} />}
            {trip.vehicle?.color && <Detail label="Color" value={trip.vehicle.color} />}
          </div>

          <div className="rounded-md border border-border bg-surface-2 p-4 text-sm">
            <div className="label-eyebrow">Pickup and drop-off</div>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">Boarding point</div>
                  <div className="text-muted-foreground">{trip.pickupPoint || trip.originName}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">Drop-off point</div>
                  <div className="text-muted-foreground">{trip.dropOffPoint || trip.destinationName}</div>
                </div>
              </div>
            </div>
          </div>

          {needsEmergencyContact && (
            <div className="rounded-md border border-gold/40 bg-gold/5 p-4">
              <div className="label-eyebrow text-gold">Emergency contact required</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Contact name</Label>
                  <Input value={emergencyName} onChange={(e) => onEmergencyNameChange(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="label-eyebrow">Contact phone</Label>
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
            <div className="label-eyebrow">Payment</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your booking is created only after payment is confirmed.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="label-eyebrow">Payment phone</Label>
                <Input value={paymentPhone} onChange={(e) => onPaymentPhoneChange(e.target.value)} />
              </div>
            </div>
          </div>

          <Button
            className="h-11 w-full"
            disabled={fullyBooked || isBooking || isSavingEmergency || !paymentPhone.trim()}
            onClick={onReserve}
          >
            {fullyBooked
              ? "Fully booked"
              : isBooking || isSavingEmergency
                ? "Opening payment..."
                : "Pay to book"}
          </Button>

          {(trip.vehicle?.imageUrls?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="label-eyebrow">Vehicle photos</div>
              <div className="grid grid-cols-2 gap-2">
                {(trip.vehicle?.imageUrls ?? []).slice(0, 4).map((url) => (
                  <SecureImage
                    key={url}
                    src={url}
                    alt={`${trip.vehicle?.make ?? "Vehicle"} photo`}
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

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
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
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm">{selectedValue}</span>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground">
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
    </div>
  );
}







