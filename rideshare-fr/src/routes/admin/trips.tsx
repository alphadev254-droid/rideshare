import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo, type FormEvent, type ReactNode } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  adminService,
  locationService,
  type ComfortClass,
  type DriverProfile,
  type Trip,
  type TripStatus,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { formatDateTime, formatMwk, formatDistanceKm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Edit3, Eye, MapPin, Plus, Search, Trash2, X, XCircle, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { TripViewDialog } from "@/components/trip-view-dialog";

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

export const Route = createFileRoute("/admin/trips")({
  component: AdminTrips,
});

type TripForm = {
  id?: string;
  driverId: string;
  vehicleId: string;
  originName: string;
  pickupPoint: string;
  destinationName: string;
  dropOffPoint: string;
  departureTime: string;
  totalSeats: string;
  distanceKm: string;
  estimatedDurationMinutes: string;
  farePerSeatMwk: string;
};

const emptyForm: TripForm = {
  driverId: "",
  vehicleId: "",
  originName: "",
  pickupPoint: "",
  destinationName: "",
  dropOffPoint: "",
  departureTime: "",
  totalSeats: "1",
  distanceKm: "",
  estimatedDurationMinutes: "",
  farePerSeatMwk: "",
};

function AdminTrips() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TripStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedDateFrom = useDebounce(dateFrom, 400);
  const debouncedDateTo = useDebounce(dateTo, 400);

  const tripsQuery = useQuery({
    queryKey: [
      "admin",
      "trips",
      { limit: 200, status: filter, search: debouncedSearch, dateFrom: debouncedDateFrom, dateTo: debouncedDateTo },
    ],
    queryFn: () =>
      adminService.listTrips({
        limit: 200,
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

  const [originSearch, setOriginSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const debouncedOriginSearch = useDebounce(originSearch, 150);
  const debouncedDestSearch = useDebounce(destSearch, 150);
  const [originOpen, setOriginOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);

  const { data: districts } = useQuery({
    queryKey: ["locations", "districts"],
    queryFn: () => locationService.districts(),
    staleTime: 60 * 60 * 1000,
  });

  const filteredOrigin = useMemo(() => {
    if (!districts) return [];
    const q = debouncedOriginSearch.toLowerCase().trim();
    return q ? districts.filter((d) => d.toLowerCase().includes(q)) : districts;
  }, [districts, debouncedOriginSearch]);

  const filteredDest = useMemo(() => {
    if (!districts) return [];
    const q = debouncedDestSearch.toLowerCase().trim();
    return q ? districts.filter((d) => d.toLowerCase().includes(q)) : districts;
  }, [districts, debouncedDestSearch]);

  const drivers = driversQuery.data ?? [];
  const selectedDriver = drivers.find((driver) => driver.id === form.driverId);
  const vehicles = (selectedDriver?.vehicles ?? []).filter((vehicle) => vehicle.reviewStatus === "approved");
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicleId);

  const trips = tripsQuery.data ?? [];

  const createTrip = useMutation({
    mutationFn: () => adminService.createTrip(toPayload(form, selectedVehicle?.comfortClass)),
    onSuccess: () => {
      toast.success("Trip created");
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
    },
    onError: showError,
  });

  const updateTrip = useMutation({
    mutationFn: () => adminService.updateTrip(form.id!, toPayload(form, selectedVehicle?.comfortClass)),
    onSuccess: () => {
      toast.success("Trip updated");
      setFormOpen(false);
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

  function openCreate() {
    setForm(emptyForm);
    setOriginSearch("");
    setDestSearch("");
    setFormOpen(true);
  }

  function openEdit(trip: Trip) {
    setForm({
      id: trip.id,
      driverId: trip.driver?.id ?? "",
      vehicleId: trip.vehicleId ?? "",
      originName: trip.originName,
      pickupPoint: trip.pickupPoint ?? "",
      destinationName: trip.destinationName,
      dropOffPoint: trip.dropOffPoint ?? "",
      departureTime: toDateTimeLocal(trip.departureTime),
      totalSeats: String(trip.totalSeats),
      distanceKm: String(trip.distanceKm ?? ""),
      estimatedDurationMinutes: String(trip.estimatedDurationMinutes ?? ""),
      farePerSeatMwk: String(Math.round(Number(trip.farePerSeatMwk))),
    });
    setOriginSearch("");
    setDestSearch("");
    setFormOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.driverId || !form.vehicleId) {
      toast.error("Choose a driver and vehicle");
      return;
    }
    if (!form.originName.trim() || !form.destinationName.trim() || !form.departureTime) {
      toast.error("Route and departure time are required");
      return;
    }
    if (!Number(form.totalSeats) || !Number(form.farePerSeatMwk)) {
      toast.error("Seats and fare must be valid numbers");
      return;
    }
    if (selectedVehicle && Number(form.totalSeats) > selectedVehicle.seatCapacity) {
      toast.error(`Seats cannot exceed vehicle capacity of ${selectedVehicle.seatCapacity}`);
      return;
    }
    form.id ? updateTrip.mutate() : createTrip.mutate();
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
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by driver name, route"
            className="h-10 pl-9"
          />
        </div>

        {/* Status & Date range */}
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

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-44"
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-44"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
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
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {trip.id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-40">
                    <div>{trip.driver?.user.fullName ?? "-"}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {trip.driver?.user.phone ?? ""}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-44">
                    <div>
                      {trip.vehicle?.make} {trip.vehicle?.model}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {trip.vehicle?.plateNumber ?? "-"}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-44 text-xs">{formatDateTime(trip.departureTime)}</TableCell>
                  <TableCell className="tabular">
                    {trip.availableSeats}
                  </TableCell>
                  <TableCell className="tabular">{trip._count?.bookings ?? trip.bookingCount ?? 0}</TableCell>
                  <TableCell className="tabular">{formatMwk(trip.farePerSeatMwk)}</TableCell>
                  <TableCell className="tabular">{formatDistanceKm(trip.distanceKm)}</TableCell>
                  <TableCell className="tabular">
                    {trip.estimatedDurationMinutes ? formatDuration(trip.estimatedDurationMinutes) : "-"}
                  </TableCell>
                  <TableCell className="uppercase">{trip.comfortClass}</TableCell>
                  <TableCell className="min-w-36 text-xs">
                    {trip.createdAt ? formatDateTime(trip.createdAt) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Select
                        value={trip.status}
                        onValueChange={(status) =>
                          setStatus.mutate({ id: trip.id, status: status as TripStatus })
                        }
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
                            <AlertDialogAction onClick={() => deleteTrip.mutate(trip.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit trip" : "Create trip"}</DialogTitle>
            <DialogDescription>
              Choose an approved driver, one of their vehicles, route details and pricing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Driver"
                value={form.driverId}
                placeholder="Choose driver"
                onChange={(driverId) =>
                  setForm((current) => ({ ...current, driverId, vehicleId: "" }))
                }
                options={drivers.map((driver) => ({
                  value: driver.id,
                  label: `${driver.user?.fullName ?? "Driver"} (${driver.user?.phone ?? "no phone"})`,
                }))}
              />
              <SelectField
                label="Vehicle"
                value={form.vehicleId}
                placeholder={form.driverId ? "Choose vehicle" : "Choose driver first"}
                onChange={(vehicleId) => setForm((current) => ({ ...current, vehicleId }))}
                options={vehicles.map((vehicle) => ({
                  value: vehicle.id,
                  label: `${vehicle.make} ${vehicle.model} - ${vehicle.plateNumber}`,
                }))}
              />
            </div>
            {selectedVehicle && (
              <div className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                {selectedVehicle.comfortClass} class, {selectedVehicle.seatCapacity} seats,{" "}
                {selectedVehicle.color ? `${selectedVehicle.color}, ` : ""}
                {selectedVehicle.year}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Origin">
                <DistrictSearch
                  value={form.originName}
                  search={originSearch}
                  onSearch={(v) => { setOriginSearch(v); setOriginOpen(true); }}
                  onPick={(d) => { setForm((c) => ({ ...c, originName: d })); setOriginSearch(""); setOriginOpen(false); }}
                  onClear={() => { setForm((c) => ({ ...c, originName: "" })); setOriginSearch(""); }}
                  open={originOpen}
                  setOpen={setOriginOpen}
                  districts={filteredOrigin}
                  placeholder="Search districts…"
                />
              </Field>
              <Field label="Destination">
                <DistrictSearch
                  value={form.destinationName}
                  search={destSearch}
                  onSearch={(v) => { setDestSearch(v); setDestOpen(true); }}
                  onPick={(d) => { setForm((c) => ({ ...c, destinationName: d })); setDestSearch(""); setDestOpen(false); }}
                  onClear={() => { setForm((c) => ({ ...c, destinationName: "" })); setDestSearch(""); }}
                  open={destOpen}
                  setOpen={setDestOpen}
                  districts={filteredDest}
                  placeholder="Search districts…"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pickup point">
                <Input
                  value={form.pickupPoint}
                  placeholder="Blank uses origin"
                  onChange={(event) => setForm((current) => ({ ...current, pickupPoint: event.target.value }))}
                />
              </Field>
              <Field label="Drop-off point">
                <Input
                  value={form.dropOffPoint}
                  placeholder="Blank uses destination"
                  onChange={(event) => setForm((current) => ({ ...current, dropOffPoint: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Departure">
                <Input
                  required
                  type="datetime-local"
                  value={form.departureTime}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, departureTime: event.target.value }))
                  }
                />
              </Field>
              <Field label="Bookable seats">
                <Input
                  required
                  type="number"
                  min={1}
                  max={selectedVehicle?.seatCapacity ?? 50}
                  value={form.totalSeats}
                  onChange={(event) => setForm((current) => ({ ...current, totalSeats: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fare per passenger">
                <Input
                  required
                  type="number"
                  min={1}
                  value={form.farePerSeatMwk}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, farePerSeatMwk: event.target.value }))
                  }
                />
              </Field>
              <Field label="Distance (km, optional)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.distanceKm}
                  onChange={(event) => setForm((current) => ({ ...current, distanceKm: event.target.value }))}
                />
              </Field>
              <Field label="Duration minutes">
                <Input
                  required
                  type="number"
                  min={1}
                  value={form.estimatedDurationMinutes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, estimatedDurationMinutes: event.target.value }))
                  }
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTrip.isPending || updateTrip.isPending}>
                {createTrip.isPending || updateTrip.isPending ? "Saving..." : "Save trip"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TripViewDialog trip={viewTrip} open={viewOpen} onOpenChange={setViewOpen} />
    </div>
  );
}

function toPayload(form: TripForm, comfortClass: ComfortClass = "economy") {
  return {
    driverId: form.driverId,
    vehicleId: form.vehicleId,
    originName: form.originName.trim(),
    pickupPoint: form.pickupPoint.trim() || undefined,
    destinationName: form.destinationName.trim(),
    dropOffPoint: form.dropOffPoint.trim() || undefined,
    departureTime: new Date(form.departureTime).toISOString(),
    totalSeats: Number(form.totalSeats),
    comfortClass,
    distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
    estimatedDurationMinutes: Number(form.estimatedDurationMinutes),
    farePerSeatMwk: Number(form.farePerSeatMwk),
  };
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function showError(error: Error) {
  toast.error(error instanceof Error ? error.message : "Request failed");
}

function DistrictSearch({
  value,
  search,
  onSearch,
  onPick,
  onClear,
  open,
  setOpen,
  districts,
  placeholder,
}: {
  value: string;
  search: string;
  onSearch: (v: string) => void;
  onPick: (d: string) => void;
  onClear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  districts: string[];
  placeholder: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {value ? (
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm">{value}</span>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-9"
          />
          {open && districts.length > 0 && (
            // z-[200] so it clears the Dialog overlay (z-50)
            <div className="absolute z-[200] mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {districts.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  onMouseDown={(e) => { e.preventDefault(); onPick(d); }}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">{label}</Label>
      {children}
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
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="none" disabled>
              No options
            </SelectItem>
          ) : (
            options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

