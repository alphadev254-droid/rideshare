import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { driverService, tripService, type Trip } from "@/lib/api";
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
import { toast } from "sonner";

export const Route = createFileRoute("/driver/trips/new")({
  component: NewTrip,
});

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Date(2026, index, 1).toLocaleDateString(undefined, { month: "long" }),
}));

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

type TripFormState = {
  vehicleId: string;
  originName: string;
  destinationName: string;
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

function validateTripForm(form: TripFormState, seatCapacity: number) {
  const nextErrors: Record<string, string> = {};
  const distanceKm = Number(form.distanceKm);
  const farePerSeatMwk = Number(form.farePerSeatMwk);
  const totalSeats = Number(form.totalSeats);
  const durationMinutes = Number(form.durationHours || 0) * 60 + Number(form.durationMinutes || 0);

  if (!form.originName.trim()) nextErrors.originName = "Enter the trip origin.";
  if (!form.destinationName.trim()) nextErrors.destinationName = "Enter the trip destination.";
  if (!form.distanceKm || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    nextErrors.distanceKm = "Enter a valid distance greater than 0.";
  }
  if (!form.farePerSeatMwk || !Number.isFinite(farePerSeatMwk) || farePerSeatMwk <= 0) {
    nextErrors.farePerSeatMwk = "Enter the amount each passenger will pay.";
  }
  if (durationMinutes < 1) nextErrors.duration = "Enter the approximate trip duration.";
  if (!form.vehicleId) nextErrors.vehicleId = "Choose the vehicle for this trip.";
  if (!form.departureYear || !form.departureMonth || !form.departureDay) {
    nextErrors.departureDate = "Choose the departure year, month and date.";
  }
  if (!form.departureHour || !form.departureMinute || !form.departurePeriod) {
    nextErrors.departureTime = "Choose the departure hour, minutes and AM/PM.";
  }
  if (!form.totalSeats || !Number.isFinite(totalSeats) || totalSeats < 1) {
    nextErrors.totalSeats = "Enter at least 1 bookable seat.";
  } else if (totalSeats > seatCapacity) {
    nextErrors.totalSeats = `Seats cannot exceed this vehicle capacity of ${seatCapacity}.`;
  }

  return nextErrors;
}

function NewTrip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: vehicles } = useQuery({
    queryKey: ["driver", "vehicles"],
    queryFn: () => driverService.vehicles(),
  });

  const [form, setForm] = useState({
    vehicleId: "",
    originName: "",
    destinationName: "",
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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedVehicle = useMemo(
    () => (vehicles ?? []).find((vehicle) => vehicle.id === form.vehicleId),
    [vehicles, form.vehicleId],
  );

  function up<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((current) => {
      const next = { ...current };
      delete next[k];
      if (k === "departureHour" || k === "departureMinute" || k === "departurePeriod") {
        delete next.departureTime;
      }
      if (k === "durationHours" || k === "durationMinutes") {
        delete next.duration;
      }
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
      if (next.departureDay && !days.includes(next.departureDay)) {
        next.departureDay = "";
      }
      return next;
    });
  }

  const create = useMutation({
    mutationFn: () => {
      const hour = toTwentyFourHour(form.departureHour, form.departurePeriod);
      const departureDate = dateValue(
        form.departureYear,
        form.departureMonth,
        form.departureDay,
      );
      const departureTime = new Date(
        `${departureDate}T${hour}:${form.departureMinute}`,
      ).toISOString();

      return tripService.create({
        vehicleId: form.vehicleId,
        originName: form.originName.trim(),
        destinationName: form.destinationName.trim(),
        departureTime,
        totalSeats: Number(form.totalSeats),
        comfortClass: selectedVehicle?.comfortClass ?? "economy",
        distanceKm: Number(form.distanceKm),
        estimatedDurationMinutes:
          Number(form.durationHours || 0) * 60 + Number(form.durationMinutes || 0),
        farePerSeatMwk: Number(form.farePerSeatMwk),
      });
    },
    onSuccess: (_trip: Trip) => {
      toast.success("Trip published");
      queryClient.invalidateQueries({ queryKey: ["trips", "mine"] });
      navigate({ to: "/driver/trips" });
    },
    onError: (error: Error) => {
      toast.error(error instanceof Error ? error.message : "Could not publish trip");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateTripForm(form, seatCapacity);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    create.mutate();
  }

  const hasVehicles = (vehicles?.length ?? 0) > 0;
  const seatCapacity = selectedVehicle?.seatCapacity ?? 50;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, index) => String(currentYear + index));
  const months = availableMonths(form.departureYear);
  const dayNumbers = availableDays(form.departureYear, form.departureMonth);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My trips"
        title="Publish a trip"
        description="Create a scheduled route with the vehicle, seats, departure time and distance passengers need to book."
      />

      {!hasVehicles && (
        <div className="rounded-md border border-gold/40 bg-gold/5 p-4 text-sm">
          You need an active approved vehicle to publish trips.{" "}
          <Link to="/driver/onboarding" className="text-primary hover:underline">
            Add one
          </Link>
          .
        </div>
      )}

      <form noValidate onSubmit={submit} className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-6">
          <h3 className="label-eyebrow">Route</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Origin</Label>
              <Input
                required
                aria-invalid={!!errors.originName}
                value={form.originName}
                onChange={(e) => up("originName", e.target.value)}
                placeholder="Lilongwe"
              />
              <FieldError message={errors.originName} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Destination</Label>
              <Input
                required
                aria-invalid={!!errors.destinationName}
                value={form.destinationName}
                onChange={(e) => up("destinationName", e.target.value)}
                placeholder="Blantyre"
              />
              <FieldError message={errors.destinationName} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Distance (km)</Label>
            <Input
              type="number"
              required
              min={1}
              step="0.1"
              aria-invalid={!!errors.distanceKm}
              value={form.distanceKm}
              onChange={(e) => up("distanceKm", e.target.value)}
              placeholder="312"
            />
            <FieldError message={errors.distanceKm} />
            <p className="text-xs text-muted-foreground">
              Used for passenger route information and search matching.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Amount per passenger (MWK)</Label>
              <Input
                type="number"
                required
                min={1}
                step={1}
                aria-invalid={!!errors.farePerSeatMwk}
                value={form.farePerSeatMwk}
                onChange={(e) => up("farePerSeatMwk", e.target.value)}
                placeholder="25000"
              />
              <FieldError message={errors.farePerSeatMwk} />
            </div>
            <div className="grid gap-2 min-[380px]:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="label-eyebrow">Duration hours</Label>
                <Input
                  type="number"
                  min={0}
                  max={72}
                  aria-invalid={!!errors.duration}
                  value={form.durationHours}
                  onChange={(e) => up("durationHours", e.target.value)}
                  placeholder="4"
                />
              </div>
              <TimeSelect
                label="Minutes"
                value={form.durationMinutes}
                placeholder="Min"
                options={["00", "15", "30", "45"]}
                onChange={(v) => up("durationMinutes", v)}
                error={errors.duration}
              />
            </div>
            <FieldError message={errors.duration} />
          </div>
        </div>

        <div className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-6">
          <h3 className="label-eyebrow">Schedule & vehicle</h3>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Vehicle</Label>
            <Select value={form.vehicleId} onValueChange={(v) => up("vehicleId", v)}>
              <SelectTrigger aria-invalid={!!errors.vehicleId}>
                <SelectValue placeholder={hasVehicles ? "Choose vehicle" : "No vehicles yet"} />
              </SelectTrigger>
              <SelectContent>
                {(vehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.make} {v.model} - {v.plateNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVehicle && (
              <div className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                {selectedVehicle.comfortClass} class · {selectedVehicle.seatCapacity} seats ·{" "}
                {selectedVehicle.color ? `${selectedVehicle.color} · ` : ""}
                {selectedVehicle.year}
              </div>
            )}
            <FieldError message={errors.vehicleId} />
          </div>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[0.9fr_1.2fr_0.9fr]">
              <DateSelect
                label="Year"
                value={form.departureYear}
                placeholder="Year"
                options={years.map((year) => ({ value: year, label: year }))}
                onChange={(v) => setDatePart("departureYear", v)}
                error={errors.departureDate}
              />
              <DateSelect
                label="Month"
                value={form.departureMonth}
                placeholder="Month"
                options={months}
                onChange={(v) => setDatePart("departureMonth", v)}
                error={errors.departureDate}
              />
              <DateSelect
                label="Date"
                value={form.departureDay}
                placeholder="Date"
                options={dayNumbers.map((day) => ({ value: day, label: day }))}
                onChange={(v) => setDatePart("departureDay", v)}
                error={errors.departureDate}
              />
            </div>
            <FieldError message={errors.departureDate} />
            <div className="grid gap-2 min-[380px]:grid-cols-3">
              <TimeSelect
                label="Hour"
                value={form.departureHour}
                placeholder="Hour"
                options={Array.from({ length: 12 }, (_, index) => String(index + 1))}
                onChange={(v) => up("departureHour", v)}
                error={errors.departureTime}
              />
              <TimeSelect
                label="Minutes"
                value={form.departureMinute}
                placeholder="Min"
                options={["00", "15", "30", "45"]}
                onChange={(v) => up("departureMinute", v)}
                error={errors.departureTime}
              />
              <TimeSelect
                label="AM/PM"
                value={form.departurePeriod}
                placeholder="AM/PM"
                options={["AM", "PM"]}
                onChange={(v) => up("departurePeriod", v)}
                error={errors.departureTime}
              />
            </div>
            <FieldError message={errors.departureTime} />
          </div>
          <div className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
            Time is saved using your local timezone.
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Bookable seats</Label>
            <Input
              type="number"
              required
              min={1}
              max={seatCapacity}
              aria-invalid={!!errors.totalSeats}
              value={form.totalSeats}
              onChange={(e) => up("totalSeats", e.target.value)}
            />
            <FieldError message={errors.totalSeats} />
            <p className="text-xs text-muted-foreground">
              Keep this at or below the selected vehicle capacity.
            </p>
          </div>
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={create.isPending}
          >
            {create.isPending ? "Publishing..." : "Publish trip"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TimeSelect({
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

function DateSelect({
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
