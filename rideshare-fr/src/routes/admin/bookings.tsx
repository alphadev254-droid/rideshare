import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { CalendarClock, Eye, MapPin, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  bookingService,
  type Booking,
  type BookingPaymentStatus,
  type BookingStatus,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatMwk } from "@/lib/format";
import { BookingViewDialog } from "@/components/booking-view-dialog";

export const Route = createFileRoute("/admin/bookings")({
  component: AdminBookings,
});

const BOOKING_STATUSES: (BookingStatus | "all")[] = [
  "all",
  "pending",
  "confirmed",
  "authenticated",
  "completed",
  "cancelled",
  "no_show",
];

const PAYMENT_STATUSES: (BookingPaymentStatus | "all")[] = [
  "all",
  "unpaid",
  "held_in_escrow",
  "released",
  "refunded",
];

function AdminBookings() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<BookingPaymentStatus | "all">("all");
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const qc = useQueryClient();

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", "admin", debouncedSearch, status, paymentStatus],
    queryFn: () =>
      bookingService.admin({
        limit: 70,
        search: debouncedSearch || undefined,
        status,
        paymentStatus,
      }),
  });

  const bookings = data?.data ?? [];

  async function openBookingView(
    booking: Booking,
    qc: ReturnType<typeof useQueryClient>,
    setLoading: (v: boolean) => void,
    setOpen: (v: boolean) => void,
    setBooking: (b: Booking) => void,
  ) {
    setLoading(true);
    setOpen(true);
    try {
      const full = await qc.fetchQuery({
        queryKey: ["booking", booking.id],
        queryFn: () => bookingService.byId(booking.id),
      });
      setBooking(full);
    } catch {
      setBooking(booking);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Bookings"
        description="Passenger reservations, boarding state, payment state and trip ownership."
      />

      <div className="grid gap-3 md:grid-cols-[1fr_190px_210px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by passenger name/phone/email · driver name/phone/email · route (origin/destination)"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as BookingStatus | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOKING_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "All bookings" : item.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={paymentStatus}
          onValueChange={(value) => setPaymentStatus(value as BookingPaymentStatus | "all")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "All payments" : item.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-5 w-5" />}
          title="No bookings found"
          description="Try changing the search or filters."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Passenger</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Fare</TableHead>
              <TableHead>Booked</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <div className="font-medium">{booking.passenger?.fullName ?? "Passenger"}</div>
                  <div className="text-xs text-muted-foreground">{booking.passenger?.phone}</div>
                </TableCell>
                <TableCell>{booking.trip?.driver?.user?.fullName ?? "Driver"}</TableCell>
                <TableCell>
                  <div className="font-medium">{booking.trip?.originName}</div>
                  <div className="text-xs text-muted-foreground">{booking.trip?.destinationName}</div>
                </TableCell>
                <TableCell>
                  <StatusPill status={booking.status} />
                </TableCell>
                <TableCell>
                  <StatusPill status={booking.paymentStatus} />
                </TableCell>
                <TableCell className="text-right tabular">{formatMwk(booking.fareMwk)}</TableCell>
                <TableCell>{formatDateTime(booking.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {booking.trip?.status === "in_transit" && (
                      <Button asChild size="icon" variant="outline" title="View driver location">
                        <Link to="/trips/$id/location" params={{ id: booking.tripId }}>
                          <MapPin className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => openBookingView(booking, qc, setViewLoading, setViewOpen, setViewBooking)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}


      <BookingViewDialog booking={viewBooking} open={viewOpen} loading={viewLoading} onOpenChange={setViewOpen} />
    </div>
  );
}
