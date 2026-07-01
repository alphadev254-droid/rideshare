import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { driverService, locationService, tripService, type Trip } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { MainTripStep } from "@/components/driver-trips/main-trip-step";
import { RouteTableStep } from "@/components/driver-trips/route-table-step";
import { ArrowLeft } from "lucide-react";
import {
  buildTripPayload,
  emptyMainDraft,
  makeRouteRow,
  type MainTripDraft,
  type RouteSegmentDraft,
  validateMainTrip,
  validateRouteManifest,
} from "@/components/driver-trips/trip-create-types";

export const Route = createFileRoute("/driver/trips/new")({
  component: NewTrip,
});

function NewTrip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<MainTripDraft>(() => emptyMainDraft());
  const [segments, setSegments] = useState<RouteSegmentDraft[]>([]);
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

  const create = useMutation({
    mutationFn: () => {
      if (!selectedVehicle) throw new Error("Choose an approved vehicle");
      const payload = buildTripPayload(form, selectedVehicle, segments);
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
        current.map((segment, index) =>
          index === 0
            ? {
                ...segment,
                from: form.originName,
                to: form.destinationName,
                departureTime: form.departureTime,
                arrivalTime: form.arrivalTime,
                seats: form.totalSeats,
              }
            : segment,
        ),
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

  function publish() {
    const nextErrors = {
      ...validateMainTrip(form, selectedVehicle),
      ...validateRouteManifest(form, segments, Number(form.totalSeats || 0)),
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
        description="Start with the main journey, then build the routes passengers can book."
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
          publishing={create.isPending}
          onBack={() => setStep(1)}
          onAddRow={addRouteRow}
          onRemoveRow={removeRouteRow}
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
