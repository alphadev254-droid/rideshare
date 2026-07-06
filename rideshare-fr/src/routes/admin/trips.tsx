import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  adminService,
  locationService,
  type Trip,
  type TripStatus,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatMwk, formatDistanceKm, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Edit3, Eye, MapPin, Plus, Search, Trash2, XCircle, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { TripViewDialog } from "@/components/trip-view-dialog";
import { AdminPagination } from "@/components/admin-pagination";
import { MainTripStep } from "@/components/driver-trips/main-trip-step";
import { RouteTableStep } from "@/components/driver-trips/route-table-step";
import {
  buildTripPayload,
  emptyMainDraft,
  makeRouteRow,
  tripToDrafts,
  validateMainTrip,
  validateRouteManifest,
  type MainTripDraft,
  type RouteSegmentDraft,
} from "@/components/driver-trips/trip-create-types";

export const Route = createFileRoute("/admin/trips")({
  component: AdminTrips,
});

const STATUSES: (TripStatus | "all")[] = [
  "all",
  "scheduled",
  "boarding",
  "in_transit",
  "completed",
  "cancelled",
];

const STATUS_ACTIONS: TripStatus[] = [
  "scheduled",
  "boarding",
  "in_transit",
  "completed",
  "cancelled",
];

const DEFAULT_PAGE_SIZE = 70;

type AdminTripForm = {
  id?: string;
  driverId: string;
};

const emptyAdminForm: AdminTripForm = { driverId: "" };

function AdminTrips() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TripStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [formOpen, setFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [adminForm, setAdminForm] = useState<AdminTripForm>(emptyAdminForm);
  const [tripDraft, setTripDraft] = useState<MainTripDraft>(() => emptyMainDraft());
  const [segments, setSegments] = useState<RouteSegmentDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [originSearch, setOriginSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const [originOpen, setOriginOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedDateFrom = useDebounce(dateFrom, 400);
  const debouncedDateTo = useDebounce(dateTo, 400);
  const debouncedOriginSearch = useDebounce(originSearch, 150);
  const debouncedDestSearch = useDebounce(destSearch, 150);

  const tripsQuery = useQuery({
    queryKey: [
      "admin",
      "trips",
      { page, limit, status: filter, search: debouncedSearch, dateFrom: debouncedDateFrom, dateTo: debouncedDateTo },
    ],
    queryFn: () =>
      adminService.listTrips({
        page,
        limit,
        status: filter !== "all" ? filter : undefined,
        search: debouncedSearch.trim() || undefined,
        dateFrom: debouncedDateFrom || undefined,
        dateTo: debouncedDateTo || undefined,
      }),
  });

  const driversQuery = useQuery({
    queryKey: ["admin", "drivers", "trip-form"],
    queryFn: () => adminService.listDrivers({ limit: 200, approved: true }),
  });

  const { data: districts } = useQuery({
    queryKey: ["locations", "districts"],
    queryFn: () => locationService.districts(),
    staleTime: 60 * 60 * 1000,
  });

  const drivers = driversQuery.data ?? [];
  const selectedDriver = drivers.find((driver) => driver.id === adminForm.driverId);
  const vehicles = (selectedDriver?.vehicles ?? []).filter(
    (vehicle) => vehicle.reviewStatus === "approved" || vehicle.id === tripDraft.vehicleId,
  );
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === tripDraft.vehicleId);
  const districtList = districts ?? [];
  const filteredOrigin = useMemo(() => filterDistricts(districtList, debouncedOriginSearch), [districtList, debouncedOriginSearch]);
  const filteredDest = useMemo(() => filterDistricts(districtList, debouncedDestSearch), [districtList, debouncedDestSearch]);

  const trips = tripsQuery.data?.data ?? [];
  const totalTrips = tripsQuery.data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch, debouncedDateFrom, debouncedDateTo]);

  const createTrip = useMutation({
    mutationFn: () => {
      if (!adminForm.driverId) throw new Error("Choose a driver");
      if (!selectedVehicle) throw new Error("Choose an approved vehicle");
      return adminService.createTrip({
        ...buildTripPayload(tripDraft, selectedVehicle, segments),
        driverId: adminForm.driverId,
      });
    },
    onSuccess: () => {
      toast.success("Trip created");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
    },
    onError: showError,
  });

  const updateTrip = useMutation({
    mutationFn: () => {
      if (!adminForm.id) throw new Error("Trip is missing");
      if (!adminForm.driverId) throw new Error("Choose a driver");
      if (!selectedVehicle) throw new Error("Choose an approved vehicle");
      return adminService.updateTrip(adminForm.id, {
        ...buildTripPayload(tripDraft, selectedVehicle, segments),
        driverId: adminForm.driverId,
      });
    },
    onSuccess: () => {
      toast.success("Trip updated");
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
    },
    onError: showError,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TripStatus }) =>
      adminService.setTripStatus(id, status),
    onSuccess: () => {
      toast.success("Trip status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
    },
    onError: showError,
  });

  const deleteTrip = useMutation({
    mutationFn: (id: string) => adminService.deleteTrip(id),
    onSuccess: () => {
      toast.success("Trip deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
    },
    onError: showError,
  });

  function changeLimit(nextLimit: number) {
    setLimit(nextLimit);
    setPage(1);
  }

  function openCreate() {
    setAdminForm(emptyAdminForm);
    setTripDraft(emptyMainDraft());
    setSegments([]);
    setErrors({});
    setFormStep(1);
    setOriginSearch("");
    setDestSearch("");
    setFormOpen(true);
  }

  function openEdit(trip: Trip) {
    const drafts = tripToDrafts(trip);
    setAdminForm({ id: trip.id, driverId: trip.driver?.id ?? "" });
    setTripDraft(drafts.form);
    setSegments(drafts.segments);
    setErrors({});
    setFormStep(1);
    setOriginSearch("");
    setDestSearch("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setAdminForm(emptyAdminForm);
    setTripDraft(emptyMainDraft());
    setSegments([]);
    setErrors({});
    setFormStep(1);
  }

  function updateMain<K extends keyof MainTripDraft>(key: K, value: MainTripDraft[K]) {
    setTripDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function goNext() {
    if (!adminForm.driverId) {
      toast.error("Choose a driver");
      return;
    }
    const nextErrors = validateMainTrip(tripDraft, selectedVehicle);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the main trip details");
      return;
    }
    if (segments.length === 0) {
      setSegments([
        {
          ...makeRouteRow(tripDraft.originName, tripDraft.destinationName, tripDraft.totalSeats),
          departureTime: tripDraft.departureTime,
          arrivalTime: tripDraft.arrivalTime,
        },
      ]);
    } else {
      setSegments((current) =>
        current.map((segment, index) => {
          if (index !== 0) return segment;
          const currentSeats = Number(segment.seats || tripDraft.totalSeats);
          const tripSeats = Number(tripDraft.totalSeats || 1);
          return {
            ...segment,
            from: tripDraft.originName,
            to: tripDraft.destinationName,
            departureTime: tripDraft.departureTime,
            arrivalTime: tripDraft.arrivalTime,
            seats: String(Math.max(1, Math.min(currentSeats || tripSeats, tripSeats))),
          };
        }),
      );
    }
    setFormStep(2);
  }

  function addRouteRow() {
    setSegments((current) => [...current, makeRouteRow("", "", tripDraft.totalSeats)]);
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

  function submit() {
    const nextErrors = {
      ...validateMainTrip(tripDraft, selectedVehicle),
      ...validateRouteManifest(tripDraft, segments, Number(tripDraft.totalSeats || 0)),
    };
    setErrors(nextErrors);
    if (!adminForm.driverId) {
      toast.error("Choose a driver");
      return;
    }
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the route manifest");
      return;
    }
    adminForm.id ? updateTrip.mutate() : createTrip.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Trips"
        description="Create, inspect, update, cancel and delete platform trips."
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New trip
          </Button>
        }
      />

      <div className="grid gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by driver name, route"
            className="h-10 pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
                filter === status
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {status.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateFilter label="From" value={dateFrom} onChange={setDateFrom} />
          <DateFilter label="To" value={dateTo} onChange={setDateTo} />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {tripsQuery.isLoading ? (
        <LoadingState />
      ) : trips.length === 0 ? (
        <EmptyState title="No trips" description="Nothing matches this filter." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Available seats</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Fare</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>
                      <StatusPill status={trip.status} />
                    </TableCell>
                    <TableCell className="min-w-56 font-medium">
                      {trip.originName} to {trip.dropOffPoint || trip.destinationName}
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{trip.id.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <div>{trip.driver?.user.fullName ?? "-"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{trip.driver?.user.phone ?? ""}</div>
                    </TableCell>
                    <TableCell className="min-w-44">
                      <div>
                        {trip.vehicle?.make} {trip.vehicle?.model}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{trip.vehicle?.plateNumber ?? "-"}</div>
                    </TableCell>
                    <TableCell className="min-w-44 text-xs">{formatDateTime(trip.departureTime)}</TableCell>
                    <TableCell className="tabular">{trip.availableSeats}</TableCell>
                    <TableCell className="tabular">{trip._count?.bookings ?? trip.bookingCount ?? 0}</TableCell>
                    <TableCell className="tabular">{formatMwk(trip.farePerSeatMwk)}</TableCell>
                    <TableCell className="tabular">{formatDistanceKm(trip.distanceKm)}</TableCell>
                    <TableCell className="tabular">
                      {trip.estimatedDurationMinutes ? formatDuration(trip.estimatedDurationMinutes) : "-"}
                    </TableCell>
                    <TableCell className="uppercase">{trip.comfortClass}</TableCell>
                    <TableCell className="min-w-36 text-xs">{trip.createdAt ? formatDateTime(trip.createdAt) : "-"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Select
                          value={trip.status}
                          onValueChange={(status) => setStatus.mutate({ id: trip.id, status: status as TripStatus })}
                        >
                          <SelectTrigger className="h-9 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ACTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="outline" onClick={() => { setViewTrip(trip); setViewOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {trip.status === "in_transit" && (
                          <Button asChild size="icon" variant="outline" title="View driver location">
                            <Link to="/trips/$id/location" params={{ id: trip.id }}>
                              <MapPin className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        <Button size="icon" variant="outline" onClick={() => openEdit(trip)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {trip.status !== "cancelled" && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="border-destructive/40 text-destructive"
                            onClick={() => setStatus.mutate({ id: trip.id, status: "cancelled" })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <DeleteTripButton onDelete={() => deleteTrip.mutate(trip.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            page={page}
            limit={limit}
            total={totalTrips}
            isFetching={tripsQuery.isFetching}
            onPageChange={setPage}
            onLimitChange={changeLimit}
          />
        </>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{adminForm.id ? "Edit trip" : "Create trip"}</DialogTitle>
            <DialogDescription>
              Choose an approved driver, then use the same trip and route manifest editor drivers use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <SelectField
              label="Driver"
              value={adminForm.driverId}
              placeholder="Choose driver"
              onChange={(driverId) => {
                setAdminForm((current) => ({ ...current, driverId }));
                setTripDraft((current) => ({ ...current, vehicleId: "" }));
              }}
              options={drivers.map((driver) => ({
                value: driver.id,
                label: `${driver.user?.fullName ?? "Driver"} (${driver.user?.phone ?? "no phone"})`,
              }))}
            />

            <div className="flex gap-2 text-xs">
              <StepPill active={formStep === 1} label="1. Main trip" />
              <StepPill active={formStep === 2} label="2. Route manifest" />
            </div>

            {formStep === 1 ? (
              <MainTripStep
                form={tripDraft}
                vehicles={vehicles}
                districts={districtList}
                filteredOrigin={filteredOrigin}
                filteredDestination={filteredDest}
                originSearch={originSearch}
                destinationSearch={destSearch}
                originOpen={originOpen}
                destinationOpen={destOpen}
                errors={errors}
                onChange={updateMain}
                onOriginSearch={setOriginSearch}
                onDestinationSearch={setDestSearch}
                onOriginOpen={setOriginOpen}
                onDestinationOpen={setDestOpen}
                onNext={goNext}
              />
            ) : (
              <RouteTableStep
                form={tripDraft}
                districts={districtList}
                segments={segments}
                errors={errors}
                publishing={createTrip.isPending || updateTrip.isPending}
                publishLabel="Save trip"
                publishingLabel="Saving..."
                onBack={() => setFormStep(1)}
                onAddRow={addRouteRow}
                onRemoveRow={removeRouteRow}
                onUpdateSegment={updateSegment}
                onPublish={submit}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TripViewDialog trip={viewTrip} open={viewOpen} onOpenChange={setViewOpen} />
    </div>
  );
}

function filterDistricts(districts: string[], query: string) {
  const q = query.toLowerCase().trim();
  return q ? districts.filter((district) => district.toLowerCase().includes(q)) : districts;
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-44" />
    </div>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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

function DeleteTripButton({ onDelete }: { onDelete: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="outline" className="border-destructive/40 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete trip?</AlertDialogTitle>
          <AlertDialogDescription>
            Trips with bookings or pending payments cannot be deleted. Cancel those instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function showError(error: Error) {
  toast.error(error instanceof Error ? error.message : "Request failed");
}
