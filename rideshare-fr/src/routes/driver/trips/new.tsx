import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { driverService, locationService, tripService, type Trip, type Vehicle } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { MainTripStep } from "@/components/driver-trips/main-trip-step";
import { RouteTableStep } from "@/components/driver-trips/route-table-step";
import { ArrowLeft } from "lucide-react";
import { addDays, format, isAfter } from "date-fns";
import {
  dateTimeFromParts,
  minutesBetween,
  minutesOffset,
  type MainTripDraft,
  type RouteSegmentDraft,
  type RouteStopDraft,
} from "@/components/driver-trips/trip-create-types";

export const Route = createFileRoute("/driver/trips/new")({
  component: NewTrip,
});

function defaultDate() {
  return format(new Date(), "yyyy-MM-dd");
}

function emptyMainDraft(): MainTripDraft {
  return {
    vehicleId: "",
    originName: "",
    destinationName: "",
    departureDate: defaultDate(),
    totalSeats: "1",
  };
}

function makeSegmentKey(fromIndex: number, toIndex: number) {
  return `${fromIndex}:${toIndex}`;
}

function addDayIfNeeded(start: Date, end: Date) {
  return isAfter(end, start) ? end : addDays(end, 1);
}

function NewTrip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<MainTripDraft>(() => emptyMainDraft());
  const [stops, setStops] = useState<RouteStopDraft[]>([]);
  const [segmentDrafts, setSegmentDrafts] = useState<Record<string, Partial<RouteSegmentDraft>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [originOpen, setOriginOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const debouncedOrigin = useDebounce(originSearch, 150);
  const debouncedDestination = useDebounce(destinationSearch, 150);

  const { data: vehicles } = useQuery({
    queryKey: ["driver", "vehicles"],
    queryFn: () => driverService.vehicles(),
  });
  const { data: districts } = useQuery({
    queryKey: ["locations", "districts"],
    queryFn: () => locationService.districts(),
    staleTime: 60 * 60 * 1000,
  });

  const approvedVehicles = useMemo(
    () => (vehicles ?? []).filter((vehicle) => vehicle.reviewStatus === "approved"),
    [vehicles],
  );
  const selectedVehicle = approvedVehicles.find((vehicle) => vehicle.id === form.vehicleId);
  const districtList = districts ?? [];
  const filteredOrigin = filterDistricts(districtList, debouncedOrigin);
  const filteredDestination = filterDistricts(districtList, debouncedDestination);

  const routePoints = useMemo(
    () => [form.originName, ...stops.map((stop) => stop.name), form.destinationName],
    [form.originName, form.destinationName, stops],
  );
  const segments = useMemo(
    () => buildSegments(routePoints, segmentDrafts, Number(form.totalSeats || 1)),
    [routePoints, segmentDrafts, form.totalSeats],
  );

  const create = useMutation({
    mutationFn: () => {
      if (!selectedVehicle) throw new Error("Choose an approved vehicle");
      const payload = buildTripPayload(form, selectedVehicle, stops, segments);
      return tripService.create(payload);
    },
    onSuccess: (_trip: Trip) => {
      toast.success("Trip published");
      queryClient.invalidateQueries({ queryKey: ["trips", "mine"] });
      navigate({ to: "/driver/trips" });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not publish trip");
    },
  });

  function updateMain<K extends keyof MainTripDraft>(key: K, value: MainTripDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function goNext() {
    const nextErrors = validateMain(form, selectedVehicle);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the main trip details");
      return;
    }
    setStep(2);
  }

  function addStop() {
    setStops((current) => [...current, { id: crypto.randomUUID(), name: "" }]);
  }

  function updateStop(id: string, name: string) {
    setStops((current) => current.map((stop) => (stop.id === id ? { ...stop, name } : stop)));
  }

  function removeStop(id: string) {
    setStops((current) => current.filter((stop) => stop.id !== id));
  }

  function updateSegment(key: string, patch: Partial<RouteSegmentDraft>) {
    setSegmentDrafts((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.route;
      return next;
    });
  }

  function publish() {
    const nextErrors = {
      ...validateMain(form, selectedVehicle),
      ...validateRoute(stops, segments, Number(form.totalSeats || 0)),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the route table");
      return;
    }
    create.mutate();
  }

  return (
    <div className="space-y-6">
      <Link
        to="/driver/trips"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to trips
      </Link>

      <PageHeader
        eyebrow="My trips"
        title="Publish a trip"
        description="Start with the main journey, then set the route rows passengers can book."
      />

      {approvedVehicles.length === 0 && (
        <div className="rounded-md border border-gold/40 bg-gold/5 p-4 text-sm">
          You need an active vehicle to publish trips.{" "}
          <Link to="/driver/vehicles" className="text-primary hover:underline">
            Add one now
          </Link>
          .
        </div>
      )}

      <div className="flex gap-2 text-xs">
        <StepPill active={step === 1} label="1. Main trip" />
        <StepPill active={step === 2} label="2. Route table" />
      </div>

      {step === 1 ? (
        <MainTripStep
          form={form}
          vehicles={approvedVehicles}
          districts={districtList}
          filteredOrigin={filteredOrigin}
          filteredDestination={filteredDestination}
          originSearch={originSearch}
          destinationSearch={destinationSearch}
          originOpen={originOpen}
          destinationOpen={destinationOpen}
          errors={errors}
          onChange={updateMain}
          onOriginSearch={setOriginSearch}
          onDestinationSearch={setDestinationSearch}
          onOriginOpen={setOriginOpen}
          onDestinationOpen={setDestinationOpen}
          onNext={goNext}
        />
      ) : (
        <RouteTableStep
          form={form}
          stops={stops}
          segments={segments}
          errors={errors}
          publishing={create.isPending}
          onBack={() => setStep(1)}
          onAddStop={addStop}
          onUpdateStop={updateStop}
          onRemoveStop={removeStop}
          onUpdateSegment={updateSegment}
          onPublish={publish}
        />
      )}
    </div>
  );
}

function filterDistricts(districts: string[], query: string) {
  const q = query.toLowerCase().trim();
  return q ? districts.filter((district) => district.toLowerCase().includes(q)) : districts;
}

function validateMain(form: MainTripDraft, vehicle?: Vehicle) {
  const errors: Record<string, string> = {};
  const seats = Number(form.totalSeats);
  if (!form.originName.trim()) errors.originName = "Choose the trip origin.";
  if (!form.destinationName.trim()) errors.destinationName = "Choose the trip destination.";
  if (!form.departureDate) errors.departureDate = "Choose the trip date.";
  if (!form.vehicleId) errors.vehicleId = "Choose the vehicle for this trip.";
  if (!Number.isFinite(seats) || seats < 1) {
    errors.totalSeats = "Enter at least 1 bookable seat.";
  } else if (vehicle && seats > vehicle.seatCapacity) {
    errors.totalSeats = `Bookable seats cannot exceed this vehicle capacity of ${vehicle.seatCapacity}.`;
  }
  return errors;
}

function validateRoute(stops: RouteStopDraft[], segments: RouteSegmentDraft[], bookableSeats: number) {
  const errors: Record<string, string> = {};
  if (stops.some((stop) => !stop.name.trim())) {
    errors.route = "Every added stop needs a name.";
    return errors;
  }
  const enabled = segments.filter((segment) => segment.enabled);
  const legRows = segments.filter((segment) => !segment.isFullJourney);
  if (enabled.length === 0) {
    errors.route = "Enable at least one route row.";
    return errors;
  }
  if (legRows.some((segment) => !segment.departureTime || !segment.arrivalTime)) {
    errors.route = "Every route leg needs a departure time and arrival time.";
    return errors;
  }
  const invalid = enabled.find((segment) => {
    const seats = Number(segment.seats);
    const amount = Number(segment.amountMwk);
    return (
      !Number.isFinite(seats) ||
      seats < 1 ||
      seats > bookableSeats ||
      !Number.isFinite(amount) ||
      amount < 1
    );
  });
  if (invalid) {
    errors.route = "Every enabled route row needs departure time, arrival time, seats within bookable seats, and amount.";
  }
  return errors;
}

function buildSegments(
  routePoints: string[],
  drafts: Record<string, Partial<RouteSegmentDraft>>,
  bookableSeats: number,
) {
  const rows: RouteSegmentDraft[] = [];
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    rows.push(makeSegment(index, index + 1, routePoints, drafts, bookableSeats, false));
  }
  if (routePoints.length > 2) {
    rows.push(makeSegment(0, routePoints.length - 1, routePoints, drafts, bookableSeats, true));
  }
  return rows;
}

function makeSegment(
  fromIndex: number,
  toIndex: number,
  routePoints: string[],
  drafts: Record<string, Partial<RouteSegmentDraft>>,
  bookableSeats: number,
  isFullJourney: boolean,
): RouteSegmentDraft {
  const key = makeSegmentKey(fromIndex, toIndex);
  const draft = drafts[key] ?? {};
  return {
    key,
    fromIndex,
    toIndex,
    from: routePoints[fromIndex] || "From",
    to: routePoints[toIndex] || "To",
    departureTime: draft.departureTime ?? "",
    arrivalTime: draft.arrivalTime ?? "",
    seats: draft.seats ?? String(bookableSeats || 1),
    distanceKm: draft.distanceKm ?? "",
    amountMwk: draft.amountMwk ?? "",
    enabled: draft.enabled ?? true,
    isFullJourney,
  };
}

function buildTripPayload(
  form: MainTripDraft,
  vehicle: Vehicle,
  stops: RouteStopDraft[],
  segments: RouteSegmentDraft[],
) {
  const enabled = segments.filter((segment) => segment.enabled);
  const enabledLegs = segments.filter((segment) => segment.enabled && !segment.isFullJourney);
  const firstLeg = enabledLegs.reduce((earliest, segment) => {
    if (!earliest) return segment;
    return segment.fromIndex < earliest.fromIndex ? segment : earliest;
  }, enabledLegs[0] as RouteSegmentDraft | undefined);
  const lastLeg = enabledLegs.reduce((latest, segment) => {
    if (!latest) return segment;
    return segment.toIndex > latest.toIndex ? segment : latest;
  }, enabledLegs[0] as RouteSegmentDraft | undefined);
  if (!firstLeg || !lastLeg) throw new Error("Enable at least one route row");

  const tripStart = dateTimeFromParts(form.departureDate, firstLeg.departureTime);
  const tripEnd = addDayIfNeeded(tripStart, dateTimeFromParts(form.departureDate, lastLeg.arrivalTime));
  const stopInputs = stops.map((stop, index) => {
    const arrivalSegment = segments.find((segment) => segment.enabled && segment.toIndex === index + 1);
    const departureSegment = segments.find((segment) => segment.enabled && segment.fromIndex === index + 1);
    const arrival = arrivalSegment?.arrivalTime
      ? addDayIfNeeded(tripStart, dateTimeFromParts(form.departureDate, arrivalSegment.arrivalTime))
      : null;
    const departure = departureSegment?.departureTime
      ? addDayIfNeeded(tripStart, dateTimeFromParts(form.departureDate, departureSegment.departureTime))
      : arrival;
    return {
      name: stop.name.trim(),
      arrivalOffsetMinutes: arrival ? minutesOffset(tripStart, arrival) : undefined,
      departureOffsetMinutes: departure ? minutesOffset(tripStart, departure) : undefined,
    };
  });

  const segmentInputs = enabled.map((segment) => {
    const segmentDeparture = segment.isFullJourney ? firstLeg.departureTime : segment.departureTime;
    const segmentArrival = segment.isFullJourney ? lastLeg.arrivalTime : segment.arrivalTime;
    const start = dateTimeFromParts(form.departureDate, segmentDeparture);
    const end = addDayIfNeeded(start, dateTimeFromParts(form.departureDate, segmentArrival));
    return {
      fromStopIndex: segment.fromIndex,
      toStopIndex: segment.toIndex,
      farePerSeatMwk: Number(segment.amountMwk),
      maxSeats: Math.min(Number(segment.seats), Number(form.totalSeats)),
      distanceKm: segment.distanceKm ? Number(segment.distanceKm) : undefined,
      estimatedDurationMinutes: minutesBetween(start, end),
      isEnabled: true,
    };
  });

  const fullJourney = segments.find((segment) => segment.isFullJourney && segment.enabled);
  const distanceKm = fullJourney?.distanceKm
    ? Number(fullJourney.distanceKm)
    : segmentInputs.reduce((total, segment) => total + (segment.distanceKm ?? 0), 0) || undefined;
  const farePerSeatMwk = fullJourney?.amountMwk
    ? Number(fullJourney.amountMwk)
    : segmentInputs.reduce((total, segment) => total + segment.farePerSeatMwk, 0);

  return {
    vehicleId: form.vehicleId,
    originName: form.originName.trim(),
    destinationName: form.destinationName.trim(),
    departureTime: tripStart.toISOString(),
    totalSeats: Number(form.totalSeats),
    comfortClass: vehicle.comfortClass,
    distanceKm,
    estimatedDurationMinutes: minutesBetween(tripStart, tripEnd),
    farePerSeatMwk,
    stops: stopInputs,
    segments: segmentInputs,
  };
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}
