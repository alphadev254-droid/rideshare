import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { driverService, tripService, type Trip } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/trips/$id/edit")({
  component: EditTrip,
});

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Date(2026, index, 1).toLocaleDateString(undefined, { month: "long" }),
}));

type TripFormState = {
  vehicleId: string;
  originName: string;
  pickupPoint: string;
  destinationName: string;
  dropOffPoint: string;
  departureYear: string;
  departureMonth: string;
  departureDay: string;
  departureHour: string;
  departureMinute: string;
  departurePeriod: string;
  durationHours: string;
  durationMinutes: string;
  farePerSeatMwk: string;
  totalSeats: string;
  distanceKm: string;
};

function EditTrip() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TripFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initializedTripId, setInitializedTripId] = useState<string | null>(null);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => tripService.byId(id),
  });
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["driver", "vehicles"],
    queryFn: () => driverService.vehicles(),
  });

  useEffect(() => {
    if (!trip || initializedTripId === trip.id) return;
    setForm(formFromTrip(trip));
    setInitializedTripId(trip.id);
  }, [initializedTripId, trip]);

  const approvedVehicles = useMemo(
    () => (vehicles ?? []).filter((vehicle) => vehicle.reviewStatus === "approved" || vehicle.id === form.vehicleId),
    [vehicles, form.vehicleId],
  );

  const selectedVehicle = useMemo(
    () => approvedVehicles.find((vehicle) => vehicle.id === form.vehicleId),
    [approvedVehicles, form.vehicleId],
  );
  const seatCapacity = selectedVehicle?.seatCapacity ?? 50;
  const bookedSeats = trip ? Math.max(0, trip.totalSeats - trip.availableSeats) : 0;
  const canEdit =
    !!trip && (trip.status === "scheduled" || trip.status === "boarding") && !trip.startedAt;

  function up<K extends keyof TripFormState>(key: K, value: TripFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "departureHour" || key === "departureMinute" || key === "departurePeriod") {
        delete next.departureTime;
      }
      if (key === "durationHours" || key === "durationMinutes") delete next.duration;
      return next;
    });
  }

  function setDatePart(part: "departureYear" | "departureMonth" | "departureDay", value: string) {
    setErrors((current) => {
      const next = { ...current };
      delete next.departureDate;
      delete next[part];
      return next;
    });
    setForm((current) => {
      const next = { ...current, [part]: value };
      const months = availableMonths(next.departureYear);
      if (next.departureMonth && !months.some((month) => month.value === next.departureMonth)) {
        next.departureMonth = "";
        next.departureDay = "";
      }
      const days = availableDays(next.departureYear, next.departureMonth);
      if (next.departureDay && !days.includes(next.departureDay)) next.departureDay = "";
      return next;
    });
  }

  const update = useMutation({
    mutationFn: () => {
      const hour = toTwentyFourHour(form.departureHour, form.departurePeriod);
      const departureDate = dateValue(
        form.departureYear,
        form.departureMonth,
        form.departureDay,
      );

      return tripService.update(id, {
        vehicleId: form.vehicleId,
        originName: form.originName.trim(),
        pickupPoint: form.pickupPoint.trim() || undefined,
        destinationName: form.destinationName.trim(),
        dropOffPoint: form.dropOffPoint.trim() || undefined,
        departureTime: new Date(`${departureDate}T${hour}:${form.departureMinute}`).toISOString(),
        totalSeats: Number(form.totalSeats),
        comfortClass: selectedVehicle?.comfortClass ?? trip?.comfortClass ?? "economy",
        distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
        estimatedDurationMinutes:
          Number(form.durationHours || 0) * 60 + Number(form.durationMinutes || 0),
        farePerSeatMwk: Number(form.farePerSeatMwk),
      });
    },
    onSuccess: () => {
      toast.success("Trip updated");
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      queryClient.invalidateQueries({ queryKey: ["trips", "mine"] });
      navigate({ to: "/driver/trips/$id", params: { id } });
    },
    onError: (error: Error) => {
      toast.error(error instanceof Error ? error.message : "Could not update trip");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateTripForm(form, seatCapacity, bookedSeats);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    update.mutate();
  }

  if (tripLoading || vehiclesLoading) return <LoadingState />;
  if (!trip) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Trip not found.
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <BackLink id={id} />
        <div className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">
          This trip has already started or is no longer editable.
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, index) => String(currentYear + index));
  const months = availableMonths(form.departureYear);
  const dayNumbers = availableDays(form.departureYear, form.departureMonth);

  return (
    <div className="space-y-6">
      <BackLink id={id} />

      <PageHeader
        eyebrow="My trips"
        title="Edit trip"
        description="Update route, departure time, seats, fare and vehicle before the trip starts."
      />

      {bookedSeats > 0 && (
        <div className="rounded-md border border-gold/40 bg-gold/5 p-4 text-sm">
          {bookedSeats} seat{bookedSeats === 1 ? "" : "s"} already booked. Total seats cannot be
          reduced below that number.
        </div>
      )}

      <form noValidate onSubmit={submit} className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-6">
          <h3 className="label-eyebrow">Route</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origin" error={errors.originName}>
              <Input
                required
                aria-invalid={!!errors.originName}
                value={form.originName}
                onChange={(event) => up("originName", event.target.value)}
              />
            </Field>
            <Field label="Destination" error={errors.destinationName}>
              <Input
                required
                aria-invalid={!!errors.destinationName}
                value={form.destinationName}
                onChange={(event) => up("destinationName", event.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pickup point">
              <Input
                value={form.pickupPoint}
                onChange={(event) => up("pickupPoint", event.target.value)}
                placeholder="Blank uses origin name"
              />
            </Field>
            <Field label="Drop-off point">
              <Input
                value={form.dropOffPoint}
                onChange={(event) => up("dropOffPoint", event.target.value)}
                placeholder="Blank uses destination name"
              />
            </Field>
          </div>
          <Field label="Distance (km, optional)" error={errors.distanceKm}>
            <Input
              type="number"
              min={0}
              step="0.1"
              aria-invalid={!!errors.distanceKm}
              value={form.distanceKm}
              onChange={(event) => up("distanceKm", event.target.value)}
            />
          </Field>
          <Field label="Amount per passenger (MWK)" error={errors.farePerSeatMwk}>
            <Input
              type="number"
              required
              min={1}
              step={1}
              aria-invalid={!!errors.farePerSeatMwk}
              value={form.farePerSeatMwk}
              onChange={(event) => up("farePerSeatMwk", event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Duration hours">
              <Input
                type="number"
                min={0}
                max={72}
                aria-invalid={!!errors.duration}
                value={form.durationHours}
                onChange={(event) => up("durationHours", event.target.value)}
              />
            </Field>
            <Choice
              label="Duration minutes"
              value={form.durationMinutes}
              placeholder="Min"
              options={["00", "15", "30", "45"]}
              onChange={(value) => up("durationMinutes", value)}
              error={errors.duration}
            />
          </div>
          <FieldError message={errors.duration} />
        </div>

        <div className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-6">
          <h3 className="label-eyebrow">Departure time & vehicle</h3>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Vehicle</Label>
            <Select value={form.vehicleId} onValueChange={(value) => up("vehicleId", value)}>
              <SelectTrigger aria-invalid={!!errors.vehicleId}>
                <SelectValue placeholder="Choose vehicle" />
              </SelectTrigger>
              <SelectContent>
                {approvedVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.make} {vehicle.model} - {vehicle.plateNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVehicle && (
              <div className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                {selectedVehicle.comfortClass} class, {selectedVehicle.seatCapacity} seats,{" "}
                {selectedVehicle.year}
              </div>
            )}
            <FieldError message={errors.vehicleId} />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[0.8fr_1.2fr_0.8fr] gap-2">
              <DateChoice
                label="Departure year"
                value={form.departureYear}
                placeholder="Year"
                options={years.map((year) => ({ value: year, label: year }))}
                onChange={(value) => setDatePart("departureYear", value)}
                error={errors.departureDate}
              />
              <DateChoice
                label="Departure month"
                value={form.departureMonth}
                placeholder="Month"
                options={months}
                onChange={(value) => setDatePart("departureMonth", value)}
                error={errors.departureDate}
              />
              <DateChoice
                label="Departure date"
                value={form.departureDay}
                placeholder="Date"
                options={dayNumbers.map((day) => ({ value: day, label: day }))}
                onChange={(value) => setDatePart("departureDay", value)}
                error={errors.departureDate}
              />
            </div>
            <FieldError message={errors.departureDate} />
            <div className="grid grid-cols-3 gap-2">
              <Choice
                label="Departure hour"
                value={form.departureHour}
                placeholder="Hour"
                options={Array.from({ length: 12 }, (_, index) => String(index + 1))}
                onChange={(value) => up("departureHour", value)}
                error={errors.departureTime}
              />
              <Choice
                label="Departure minutes"
                value={form.departureMinute}
                placeholder="Min"
                options={["00", "15", "30", "45"]}
                onChange={(value) => up("departureMinute", value)}
                error={errors.departureTime}
              />
              <Choice
                label="AM/PM"
                value={form.departurePeriod}
                placeholder="AM/PM"
                options={["AM", "PM"]}
                onChange={(value) => up("departurePeriod", value)}
                error={errors.departureTime}
              />
            </div>
            <FieldError message={errors.departureTime} />
          </div>

          <Field label="Bookable seats" error={errors.totalSeats}>
            <Input
              type="number"
              required
              min={Math.max(1, bookedSeats)}
              max={seatCapacity}
              aria-invalid={!!errors.totalSeats}
              value={form.totalSeats}
              onChange={(event) => up("totalSeats", event.target.value)}
            />
          </Field>

          <Button type="submit" className="h-11 w-full" disabled={update.isPending}>
            {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

const emptyForm: TripFormState = {
  vehicleId: "",
  originName: "",
  pickupPoint: "",
  destinationName: "",
  dropOffPoint: "",
  departureYear: "",
  departureMonth: "",
  departureDay: "",
  departureHour: "",
  departureMinute: "",
  departurePeriod: "",
  durationHours: "",
  durationMinutes: "00",
  farePerSeatMwk: "",
  totalSeats: "1",
  distanceKm: "",
};

function formFromTrip(trip: Trip): TripFormState {
  const departure = new Date(trip.departureTime);
  const hours24 = departure.getHours();
  const hour12 = hours24 % 12 || 12;
  const duration = trip.estimatedDurationMinutes ?? 0;

  return {
    vehicleId: trip.vehicleId ?? "",
    originName: trip.originName,
    pickupPoint: trip.pickupPoint ?? "",
    destinationName: trip.destinationName,
    dropOffPoint: trip.dropOffPoint ?? "",
    departureYear: String(departure.getFullYear()),
    departureMonth: String(departure.getMonth() + 1).padStart(2, "0"),
    departureDay: String(departure.getDate()).padStart(2, "0"),
    departureHour: String(hour12),
    departureMinute: nearestQuarterMinute(departure.getMinutes()),
    departurePeriod: hours24 >= 12 ? "PM" : "AM",
    durationHours: duration ? String(Math.floor(duration / 60)) : "",
    durationMinutes: String(duration % 60).padStart(2, "0"),
    farePerSeatMwk: String(Math.round(Number(trip.farePerSeatMwk))),
    totalSeats: String(trip.totalSeats),
    distanceKm: String(trip.distanceKm ?? ""),
  };
}

function validateTripForm(form: TripFormState, seatCapacity: number, bookedSeats: number) {
  const nextErrors: Record<string, string> = {};
  const farePerSeatMwk = Number(form.farePerSeatMwk);
  const totalSeats = Number(form.totalSeats);
  const durationMinutes = Number(form.durationHours || 0) * 60 + Number(form.durationMinutes || 0);

  if (!form.originName.trim()) nextErrors.originName = "Enter the trip origin.";
  if (!form.destinationName.trim()) nextErrors.destinationName = "Enter the trip destination.";
  if (!form.vehicleId) nextErrors.vehicleId = "Choose the vehicle for this trip.";
  if (!form.farePerSeatMwk || !Number.isFinite(farePerSeatMwk) || farePerSeatMwk <= 0) {
    nextErrors.farePerSeatMwk = "Enter the amount each passenger will pay.";
  }
  if (durationMinutes < 1) nextErrors.duration = "Enter the approximate trip duration.";
  if (!form.departureYear || !form.departureMonth || !form.departureDay) {
    nextErrors.departureDate = "Choose the departure year, month and date.";
  }
  if (!form.departureHour || !form.departureMinute || !form.departurePeriod) {
    nextErrors.departureTime = "Choose the departure hour, minutes and AM/PM.";
  }
  if (!form.totalSeats || !Number.isFinite(totalSeats) || totalSeats < 1) {
    nextErrors.totalSeats = "Enter at least 1 bookable seat.";
  } else if (totalSeats < bookedSeats) {
    nextErrors.totalSeats = `Seats cannot be below ${bookedSeats} already booked.`;
  } else if (totalSeats > seatCapacity) {
    nextErrors.totalSeats = `Seats cannot exceed this vehicle capacity of ${seatCapacity}.`;
  }

  return nextErrors;
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      to="/driver/trips/$id"
      params={{ id }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Trip details
    </Link>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function Choice({
  label,
  value,
  placeholder,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-invalid={!!error}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateChoice({
  label,
  value,
  placeholder,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-invalid={!!error}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function daysInMonth(year: string, month: string) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function dateValue(year: string, month: string, day: string) {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function isCurrentYear(year: string) {
  return Number(year) === new Date().getFullYear();
}

function isCurrentMonth(year: string, month: string) {
  const today = new Date();
  return isCurrentYear(year) && Number(month) === today.getMonth() + 1;
}

function availableMonths(year: string) {
  if (!isCurrentYear(year)) return monthOptions;
  const currentMonth = new Date().getMonth() + 1;
  return monthOptions.filter((month) => Number(month.value) >= currentMonth);
}

function availableDays(year: string, month: string) {
  if (!year || !month) return [];
  const firstDay = isCurrentMonth(year, month) ? new Date().getDate() : 1;
  return Array.from({ length: daysInMonth(year, month) - firstDay + 1 }, (_, index) =>
    String(firstDay + index).padStart(2, "0"),
  );
}

function toTwentyFourHour(hour: string, period: string) {
  const parsedHour = Number(hour);
  if (!parsedHour || !period) return "";
  if (period === "AM") return String(parsedHour === 12 ? 0 : parsedHour).padStart(2, "0");
  return String(parsedHour === 12 ? 12 : parsedHour + 12).padStart(2, "0");
}

function nearestQuarterMinute(minutes: number) {
  const allowed = [0, 15, 30, 45];
  const closest = allowed.reduce((best, current) =>
    Math.abs(current - minutes) < Math.abs(best - minutes) ? current : best,
  );
  return String(closest).padStart(2, "0");
}




