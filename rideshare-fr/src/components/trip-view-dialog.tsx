import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime, formatMwk, formatDate, formatTime, formatDistanceKm } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/api";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  MapPin,
  Navigation,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Car,
  User,
  Gauge,
  Route,
  CreditCard,
  Hash,
  Star,
  Phone,
  Shield,
  Timer,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface TripViewDialogProps {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TripViewDialog({ trip, open, onOpenChange }: TripViewDialogProps) {
  const isMobile = useIsMobile();

  if (!trip) return null;

  const content = <TripDetailContent trip={trip} onClose={() => onOpenChange(false)} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              Trip Details
              <StatusPill status={trip.status} />
            </DrawerTitle>
            <DrawerDescription>
              {trip.originName} → {trip.destinationName}
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="overflow-y-auto px-4 pb-8">
            {content}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Trip Details
            <StatusPill status={trip.status} />
          </DialogTitle>
          <DialogDescription>
            {trip.originName} → {trip.destinationName}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function TripDetailContent({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  // Access extra fields that exist on the API response but not the type
  const tripData = trip as Record<string, unknown>;
  const createdAt = tripData.createdAt as string | undefined;
  const vehicleId = tripData.vehicleId as string | undefined;
  const driverPhone = (trip.driver as Record<string, unknown>)?.user
    ? ((trip.driver as Record<string, unknown>).user as Record<string, unknown>)?.phone
    : undefined;
  const bookingCount = trip.bookingCount ?? (tripData._count as Record<string, unknown>)?.bookings ?? 0;

  const detailRows: Array<{
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    fullWidth?: boolean;
  }> = [
    {
      label: "Trip ID",
      value: (
        <span className="font-mono text-xs text-muted-foreground">{trip.id}</span>
      ),
      icon: <Hash className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Status",
      value: <StatusPill status={trip.status} />,
      icon: trip.status === "cancelled"
        ? <XCircle className="h-4 w-4 text-destructive" />
        : trip.status === "completed"
          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
          : <Shield className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Route",
      value: (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{trip.originName}</span>
          <Navigation className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="font-medium">{trip.destinationName}</span>
        </div>
      ),
      icon: <Route className="h-4 w-4 text-muted-foreground" />,
      fullWidth: true,
    },
    {
      label: "Departure",
      value: (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{formatDate(trip.departureTime)}</span>
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{formatTime(trip.departureTime)}</span>
        </div>
      ),
      icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
      fullWidth: true,
    },
    {
      label: "Distance",
      value: <span className="tabular-nums">{formatDistanceKm(trip.distanceKm)}</span>,
      icon: <Gauge className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Duration",
      value: (
        <span className="tabular-nums">
          {trip.estimatedDurationMinutes
            ? formatDuration(trip.estimatedDurationMinutes)
            : "-"}
        </span>
      ),
      icon: <Timer className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Fare per seat",
      value: <span className="font-semibold tabular-nums">{formatMwk(trip.farePerSeatMwk)}</span>,
      icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label: "Seats",
      value: (
        <span className="tabular-nums">
          <span className="font-semibold">{bookingCount}</span>
          {" / "}
          <span className="font-semibold">{trip.totalSeats}</span>
          {" total"}
          <span className="text-muted-foreground"> · </span>
          <span className="text-green-600">{trip.availableSeats} available</span>
        </span>
      ),
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
      fullWidth: true,
    },
    {
      label: "Comfort class",
      value: (
        <Badge variant="outline" className="uppercase">
          {trip.comfortClass}
        </Badge>
      ),
      icon: <CreditCard className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  // Driver section
  const driver = trip.driver;

  // Vehicle section
  const vehicle = trip.vehicle;

  // GPS Tracking
  const gpsActive = trip.gpsTrackingActive;

  // Timestamps
  const timestamps: Array<{ label: string; value: string | undefined; icon: React.ReactNode }> = [
    { label: "Created", value: createdAt, icon: <Calendar className="h-4 w-4 text-muted-foreground" /> },
    { label: "Started", value: trip.startedAt ?? undefined, icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
    { label: "Completed", value: trip.completedAt ?? undefined, icon: <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Key Details Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {detailRows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3",
              row.fullWidth && "sm:col-span-2",
            )}
          >
            <div className="mt-0.5 shrink-0">{row.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {row.label}
              </p>
              <div className="mt-0.5">{row.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Section */}
      {driver && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-muted-foreground" />
              Driver
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                label="Name"
                value={(driver.user as Record<string, unknown>)?.fullName as string ?? "-"}
              />
              <InfoCard
                label="Phone"
                value={driverPhone as string ?? "-"}
              />
              {driver.rating && (
                <InfoCard
                  label="Rating"
                  value={
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      {Number(driver.rating).toFixed(1)}
                    </span>
                  }
                />
              )}
              <InfoCard label="Driver ID" value={<span className="font-mono text-xs">{driver.id}</span>} />
            </div>
          </div>
        </>
      )}

      {/* Vehicle Section */}
      {vehicle && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Car className="h-4 w-4 text-muted-foreground" />
              Vehicle
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                label="Make & Model"
                value={`${vehicle.make} ${vehicle.model}`}
              />
              <InfoCard label="Plate Number" value={vehicle.plateNumber} />
              <InfoCard label="Year" value={vehicle.year?.toString() ?? "-"} />
              {vehicle.color && <InfoCard label="Color" value={vehicle.color} />}
              {vehicleId && (
                <InfoCard label="Vehicle ID" value={<span className="font-mono text-xs">{vehicleId}</span>} />
              )}
            </div>
          </div>
        </>
      )}

      {/* GPS / Tracking */}
      <Separator />
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4 text-muted-foreground" />
          GPS Tracking
        </span>
        {gpsActive ? (
          <Badge className="bg-green-600 text-white">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
        )}
      </div>

      {/* Timestamps */}
      <Separator />
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {timestamps.map((ts, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-2.5">
              {ts.icon}
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {ts.label}
                </p>
                <p className="text-xs">{ts.value ? formatDateTime(ts.value) : "-"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Close button */}
      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Close
        </Button>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-sm">{value}</div>
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
