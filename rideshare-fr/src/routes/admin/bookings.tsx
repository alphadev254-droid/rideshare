import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { CalendarClock, Eye, MapPin, RotateCcw, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  bookingService,
  type AdminBookingCancelPreview,
  type Booking,
  type BookingPaymentStatus,
  type BookingStatus,
  type PaymentMethod,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AdminPagination } from "@/components/admin-pagination";
import { toast } from "sonner";

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

const DEFAULT_PAGE_SIZE = 70;

function AdminBookings() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<BookingPaymentStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [overrideDestination, setOverrideDestination] = useState(false);
  const [overridePhone, setOverridePhone] = useState("");
  const [overridePaymentMethod, setOverridePaymentMethod] = useState<PaymentMethod>("airtel_money");
  const [overrideReason, setOverrideReason] = useState("");

  const qc = useQueryClient();

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["bookings", "admin", debouncedSearch, status, paymentStatus, page, limit],
    queryFn: () =>
      bookingService.admin({
        page,
        limit,
        search: debouncedSearch || undefined,
        status,
        paymentStatus,
      }),
  });

  const bookings = data?.data ?? [];
  const totalBookings = data?.meta.total ?? 0;
  const cancelPreview = useQuery({
    queryKey: ["bookings", "admin", cancelBooking?.id, "cancel-preview"],
    queryFn: () => bookingService.adminCancelPreview(cancelBooking!.id),
    enabled: Boolean(cancelBooking),
    retry: false,
  });

  const cancelOnly = useMutation({
    mutationFn: () =>
      bookingService.adminCancelOnly(cancelBooking!.id, {
        reason: cancelReason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      setCancelBooking(null);
      qc.invalidateQueries({ queryKey: ["bookings", "admin"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not cancel booking"),
  });

  const cancelAndRefund = useMutation({
    mutationFn: () =>
      bookingService.adminCancelAndRefund(cancelBooking!.id, {
        reason: cancelReason.trim() || undefined,
        overridePhone: overrideDestination ? overridePhone.trim() : undefined,
        overridePaymentMethod: overrideDestination ? overridePaymentMethod : undefined,
        overrideReason: overrideDestination ? overrideReason.trim() : undefined,
      }),
    onSuccess: () => {
      toast.success("Refund payout started. Booking will cancel after refund confirmation.");
      setCancelBooking(null);
      qc.invalidateQueries({ queryKey: ["bookings", "admin"] });
      qc.invalidateQueries({ queryKey: ["payouts", "admin"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not start refund"),
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, paymentStatus]);

  function changeLimit(nextLimit: number) {
    setLimit(nextLimit);
    setPage(1);
  }

  function openCancelDialog(booking: Booking) {
    setCancelBooking(booking);
    setCancelReason("");
    setOverrideDestination(false);
    setOverridePhone("");
    setOverridePaymentMethod("airtel_money");
    setOverrideReason("");
  }

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
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
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
                        {booking.status !== "cancelled" && (
                          <Button
                            size="icon"
                            variant="outline"
                            title="Cancel booking"
                            onClick={() => openCancelDialog(booking)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
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
            total={totalBookings}
            isFetching={isFetching}
            onPageChange={setPage}
            onLimitChange={changeLimit}
          />
        </>
      )}

      <AdminCancelBookingDialog
        booking={cancelBooking}
        preview={cancelPreview.data}
        loading={cancelPreview.isLoading}
        error={cancelPreview.error instanceof Error ? cancelPreview.error.message : null}
        open={Boolean(cancelBooking)}
        onOpenChange={(open) => {
          if (!open && !cancelOnly.isPending && !cancelAndRefund.isPending) setCancelBooking(null);
        }}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        overrideDestination={overrideDestination}
        onOverrideDestinationChange={setOverrideDestination}
        overridePhone={overridePhone}
        onOverridePhoneChange={setOverridePhone}
        overridePaymentMethod={overridePaymentMethod}
        onOverridePaymentMethodChange={setOverridePaymentMethod}
        overrideReason={overrideReason}
        onOverrideReasonChange={setOverrideReason}
        onCancelOnly={() => cancelOnly.mutate()}
        onCancelAndRefund={() => cancelAndRefund.mutate()}
        busy={cancelOnly.isPending || cancelAndRefund.isPending}
      />
      <BookingViewDialog booking={viewBooking} open={viewOpen} loading={viewLoading} onOpenChange={setViewOpen} />
    </div>
  );
}

function AdminCancelBookingDialog({
  booking,
  preview,
  loading,
  error,
  open,
  onOpenChange,
  reason,
  onReasonChange,
  overrideDestination,
  onOverrideDestinationChange,
  overridePhone,
  onOverridePhoneChange,
  overridePaymentMethod,
  onOverridePaymentMethodChange,
  overrideReason,
  onOverrideReasonChange,
  onCancelOnly,
  onCancelAndRefund,
  busy,
}: {
  booking: Booking | null;
  preview?: AdminBookingCancelPreview;
  loading: boolean;
  error: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  overrideDestination: boolean;
  onOverrideDestinationChange: (value: boolean) => void;
  overridePhone: string;
  onOverridePhoneChange: (value: string) => void;
  overridePaymentMethod: PaymentMethod;
  onOverridePaymentMethodChange: (value: PaymentMethod) => void;
  overrideReason: string;
  onOverrideReasonChange: (value: string) => void;
  onCancelOnly: () => void;
  onCancelAndRefund: () => void;
  busy: boolean;
}) {
  const defaultPhone = preview?.payment?.providerMobileNumber ?? "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cancel booking</DialogTitle>
          <DialogDescription>
            Review payment and refund status before choosing how to cancel this booking.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <CancelDetail label="Passenger" value={preview.passenger.fullName} />
              <CancelDetail label="Route" value={preview.route} />
              <CancelDetail label="Booking status" value={preview.bookingStatus.replaceAll("_", " ")} />
              <CancelDetail label="Payment status" value={preview.paymentStatus.replaceAll("_", " ")} />
              <CancelDetail label="Seats" value={`${preview.seatsBooked}`} />
              <CancelDetail
                label="Amount paid"
                value={preview.payment ? formatMwk(preview.payment.customerAmountMwk) : "No payment"}
              />
            </div>

            {preview.refund ? (
              <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
                Refund already exists: <span className="font-semibold capitalize">{preview.refund.status}</span>
                {" "}for {formatMwk(preview.refund.refundAmountMwk)}.
              </div>
            ) : preview.failedRefund ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Last refund failed: {preview.failedRefund.failureReason ?? "No failure reason available"}.
              </div>
            ) : null}

            {preview.payment && !preview.refund ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Refund destination</div>
                    <div className="text-xs text-muted-foreground">
                      Default: {defaultPhone || "No saved payment number"} · {preview.payment.providerOperatorName ?? preview.payment.paymentMethod}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={overrideDestination ? "default" : "outline"}
                    onClick={() => onOverrideDestinationChange(!overrideDestination)}
                  >
                    Different number
                  </Button>
                </div>
                {overrideDestination ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Refund phone</Label>
                      <Input
                        value={overridePhone}
                        onChange={(event) => onOverridePhoneChange(event.target.value)}
                        placeholder="0990000000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Operator</Label>
                      <Select
                        value={overridePaymentMethod}
                        onValueChange={(value) => onOverridePaymentMethodChange(value as PaymentMethod)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="airtel_money">Airtel Money</SelectItem>
                          <SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Override reason</Label>
                      <Textarea
                        value={overrideReason}
                        onChange={(event) => onOverrideReasonChange(event.target.value)}
                        placeholder="Why should this refund go to a different number?"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Admin reason</Label>
              <Textarea
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Reason for cancellation"
              />
            </div>

            {!preview.canCancel && preview.cancelBlockedReason ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {preview.cancelBlockedReason}
              </div>
            ) : null}
          </div>
        ) : booking ? (
          <div className="text-sm text-muted-foreground">Preparing cancellation details...</div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              disabled={busy || !preview?.actions.cancelOnly}
              onClick={onCancelOnly}
            >
              Cancel only
            </Button>
            <Button
              disabled={busy || !preview?.actions.cancelAndRefund}
              onClick={onCancelAndRefund}
            >
              Cancel and refund
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
