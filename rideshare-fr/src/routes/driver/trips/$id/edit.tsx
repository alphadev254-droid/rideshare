import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { MainTripStep } from "@/components/driver-trips/main-trip-step";
import { RouteTableStep } from "@/components/driver-trips/route-table-step";
import { useDebounce } from "@/hooks/use-debounce";
import { driverService, locationService, tripService, type Trip } from "@/lib/api";
import {
  buildTripPayload,
  emptyMainDraft,
  makeRouteRow,
  tripToDrafts,
  type MainTripDraft,
  type RouteSegmentDraft,
  validateMainTrip,
  validateRouteManifest,
} from "@/components/driver-trips/trip-create-types";

export const Route = createFileRoute("/driver/trips/$id/edit")({
  component: EditTrip,
});

function EditTrip() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<MainTripDraft>(() => emptyMainDraft());
  const [segments, setSegments] = useState<RouteSegmentDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initializedTripId, setInitializedTripId] = useState<string | null>(null);
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [originOpen, setOriginOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const debouncedOrigin = useDebounce(originSearch, 150);
  const debouncedDestination = useDebounce(destinationSearch, 150);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => tripService.byId(id),
  });
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["driver", "vehicles"],
    queryFn: () => driverService.vehicles(),
  });
  const { data: districts } = useQuery({
    queryKey: ["locations", "districts"],
    queryFn: () => locationService.districts(),
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!trip || initializedTripId === trip.id) return;
    const drafts = tripToDrafts(trip);
    setForm(drafts.form);
    setSegments(drafts.segments);
    setInitializedTripId(trip.id);
  }, [initializedTripId, trip]);

  const approvedVehicles = useMemo(
    () => (vehicles ?? []).filter((vehicle) => vehicle.reviewStatus === "approved" || vehicle.id === form.vehicleId),
    [vehicles, form.vehicleId],
  );
  const selectedVehicle = approvedVehicles.find((vehicle) => vehicle.id === form.vehicleId);
  const districtList = districts ?? [];
  const filteredOrigin = filterDistricts(districtList, debouncedOrigin);
  const filteredDestination = filterDistricts(districtList, debouncedDestination);
  const canEdit = !!trip && (trip.status === "scheduled" || trip.status === "boarding") && !trip.startedAt;
  const hasBookings = !!trip && trip.availableSeats < trip.totalSeats;

  const update = useMutation({
    mutationFn: () => {
      if (!selectedVehicle) throw new Error("Choose an approved vehicle");
      const payload = buildTripPayload(form, selectedVehicle, segments);
      return tripService.update(id, payload);
    },
    onSuccess: (_trip: Trip) => {
      toast.success("Trip updated");
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      queryClient.invalidateQueries({ queryKey: ["trips", "mine"] });
      navigate({ to: "/driver/trips/$id", params: { id } });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not update trip");
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
    const nextErrors = validateMainTrip(form, selectedVehicle);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the main trip details");
      return;
    }
    if (segments.length === 0) {
      setSegments([
        {
          ...makeRouteRow(form.originName, form.destinationName, form.totalSeats),
          departureTime: form.departureTime,
          arrivalTime: form.arrivalTime,
        },
      ]);
    } else {
      setSegments((current) =>
        current.map((segment, index) => {
          if (index !== 0) return segment;
          const currentSeats = Number(segment.seats || form.totalSeats);
          const tripSeats = Number(form.totalSeats || 1);
          return {
            ...segment,
            from: form.originName,
            to: form.destinationName,
            departureTime: form.departureTime,
            arrivalTime: form.arrivalTime,
            seats: String(Math.max(1, Math.min(currentSeats || tripSeats, tripSeats))),
          };
        }),
      );
    }
    setStep(2);
  }

  function addRouteRow() {
    setSegments((current) => [...current, makeRouteRow("", "", form.totalSeats)]);
  }

  function removeRouteRow(key: string) {
    setSegments((current) => current.filter((segment) => segment.key !== key));
  }

  function updateSegment(key: string, patch: Partial<RouteSegmentDraft>) {
    setSegments((current) => current.map((segment) => (segment.key === key ? { ...segment, ...patch } : segment)));
    setErrors((current) => {
      const next = { ...current };
      delete next.route;
      return next;
    });
  }

  function save() {
    const nextErrors = {
      ...validateMainTrip(form, selectedVehicle),
      ...validateRouteManifest(form, segments, Number(form.totalSeats || 0)),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the route manifest");
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

  return (
    <div className="space-y-6">
      <BackLink id={id} />

      <div>
        <div className="label-eyebrow text-muted-foreground">My trips</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Edit trip</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Update the main journey, then adjust the routes passengers can book.
        </p>
      </div>

      {hasBookings && (
        <div className="rounded-md border border-gold/40 bg-gold/5 p-4 text-sm">
          This trip has passenger bookings. Route editing is blocked by the server to protect existing bookings.
        </div>
      )}

      <div className="flex gap-2 text-xs">
        <StepPill active={step === 1} label="1. Main trip" />
        <StepPill active={step === 2} label="2. Route manifest" />
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
          districts={districtList}
          segments={segments}
          errors={errors}
          publishing={update.isPending}
          publishLabel="Save changes"
          publishingLabel="Saving..."
          onBack={() => setStep(1)}
          onAddRow={addRouteRow}
          onRemoveRow={removeRouteRow}
          onUpdateSegment={updateSegment}
          onPublish={save}
        />
      )}
    </div>
  );
}

function filterDistricts(districts: string[], query: string) {
  const q = query.toLowerCase().trim();
  return q ? districts.filter((district) => district.toLowerCase().includes(q)) : districts;
}

function BackLink({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        to="/driver/trips"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to trips
      </Link>
      <Link
        to="/driver/trips/$id"
        params={{ id }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Trip details
      </Link>
    </div>
  );
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
