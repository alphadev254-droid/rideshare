import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime, formatMwk } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Booking, PaymentStatus } from "@/lib/api";
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
  DollarSign,
  User,
  Phone,
  Mail,
  Hash,
  Star,
  Route,
  ShieldCheck,
  CreditCard,
  KeyRound,
  Building,
  Car,
  Loader2,
} from "lucide-react";

interface BookingViewDialogProps {
  booking: Booking | null;
  open: boolean;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingViewDialog({ booking, open, loading, onOpenChange }: BookingViewDialogProps) {
  const isMobile = useIsMobile();

  const content = loading ? (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : !booking ? null : (
    <BookingDetailContent booking={booking} onClose={() => onOpenChange(false)} />
  );

  const header = !booking ? null : (
    <>
      <DialogTitle className="flex items-center gap-2">
        Booking Details
        <StatusPill status={booking.status} />
      </DialogTitle>
      <DialogDescription>
        {booking.trip?.originName ?? "?"} → {booking.trip?.destinationName ?? "?"}
      </DialogDescription>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">{header}</DrawerHeader>
          <ScrollArea className="overflow-y-auto px-4 pb-8">{content}</ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>{header}</DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function BookingDetailContent({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const trip = booking.trip;
  const passenger = booking.passenger;
  const driver = trip?.driver;
  const vehicle = trip?.vehicle;
  const payment = booking.payment;

  return (
    <div className="space-y-6">
      {/* Booking ID & Statuses */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard
          label="Booking ID"
          icon={<Hash className="h-4 w-4 text-muted-foreground" />}
          value={<span className="font-mono text-xs">{booking.id}</span>}
        />
        <InfoCard
          label="Payment Status"
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          value={<StatusPill status={booking.paymentStatus} />}
        />
        <InfoCard
          label="Route"
          icon={<Route className="h-4 w-4 text-muted-foreground" />}
          value={
            <span className="text-sm font-medium">
              {booking.boardingPoint}
              <Navigation className="mx-1.5 inline h-3 w-3 text-muted-foreground" />
              {booking.dropOffPoint ?? trip?.destinationName}
            </span>
          }
          fullWidth
        />
        <InfoCard
          label="Fare"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          value={<span className="font-semibold tabular-nums">{formatMwk(booking.fareMwk)}</span>}
        />
        <InfoCard
          label="Boarding Code"
          icon={<KeyRound className="h-4 w-4 text-muted-foreground" />}
          value={
            booking.codeAvailable && booking.boardingCode ? (
              <span className="font-mono text-lg font-bold tracking-widest text-primary">
                {booking.boardingCode}
              </span>
            ) : booking.codeUsed ? (
              <span className="text-xs text-muted-foreground">Code used</span>
            ) : (
              <span className="text-xs text-muted-foreground">Not yet available</span>
            )
          }
        />
        <InfoCard
          label="Booked At"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          value={<span className="text-xs">{formatDateTime(booking.createdAt)}</span>}
        />
      </div>

      <Separator />

      {/* Passenger Section */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-muted-foreground" />
          Passenger
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label="Name" value={passenger?.fullName ?? "-"} />
          <InfoCard
            label="Phone"
            value={
              passenger?.phone ? (
                <a
                  href={`tel:${passenger.phone}`}
                  className="text-primary hover:underline"
                >
                  {passenger.phone}
                </a>
              ) : (
                "-"
              )
            }
          />
          <InfoCard label="Email" value={passenger?.email ?? "-"} />
          {passenger?.rating && (
            <InfoCard
              label="Rating"
              value={
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  {Number(passenger.rating).toFixed(1)}
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* Driver Section */}
      {driver && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Driver
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="Name" value={driver.user.fullName} />
              <InfoCard
                label="Phone"
                value={
                  <a href={`tel:${driver.user.phone}`} className="text-primary hover:underline">
                    {driver.user.phone}
                  </a>
                }
              />
              <InfoCard label="Email" value={driver.user.email ?? "-"} />
              <InfoCard label="Driver ID" value={<span className="font-mono text-xs">{driver.id}</span>} />
            </div>
          </div>
        </>
      )}

      {/* Trip Section */}
      {trip && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              Trip
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                label="Route"
                value={`${trip.originName} → ${trip.destinationName}`}
                fullWidth
              />
              <InfoCard label="Departure time" value={formatDateTime(trip.departureTime)} />
              <InfoCard
                label="Trip Status"
                value={<StatusPill status={trip.status} />}
              />
              <InfoCard label="Trip ID" value={<span className="font-mono text-xs">{trip.id}</span>} />
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
              <InfoCard label="Make & Model" value={`${vehicle.make} ${vehicle.model}`} />
              <InfoCard label="Plate Number" value={vehicle.plateNumber} />
              <InfoCard label="Class" value={<Badge variant="outline" className="uppercase">{vehicle.comfortClass}</Badge>} />
              {vehicle.color && <InfoCard label="Color" value={vehicle.color} />}
            </div>
          </div>
        </>
      )}

      {/* Payment / Transaction Section */}
      <Separator />
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Transaction
        </h3>
        {payment ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard
              label="Transaction ID"
              value={<span className="font-mono text-xs">{payment.id}</span>}
            />
            <InfoCard
              label="Status"
              value={<StatusPill status={payment.status as PaymentStatus} />}
            />
            <InfoCard
              label="Customer Paid"
              value={
                <span className="font-semibold tabular-nums">
                  {formatMwk(payment.customerAmountMwk)}
                </span>
              }
            />
            <InfoCard
              label="Driver Receives"
              value={
                <span className="tabular-nums text-green-600">
                  {formatMwk(payment.netAmountMwk)}
                </span>
              }
            />
            {payment.gatewayRef && (
              <InfoCard
                label="Gateway Ref"
                value={<span className="font-mono text-xs">{payment.gatewayRef}</span>}
              />
            )}
            <InfoCard
              label="Transaction Date"
              value={formatDateTime(payment.createdAt)}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No transaction record for this booking.</p>
        )}
      </div>

      {/* Close */}
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
  icon,
  fullWidth,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3",
        fullWidth && "sm:col-span-2",
      )}
    >
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5">{value}</div>
      </div>
    </div>
  );
}

