import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, paymentService, tripService, userService, locationService, type ComfortClass, type PaymentMethod, type PendingPayment, type Trip, type User } from "@/lib/api";
import { formatMwk, formatDateTime } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { SecureImage } from "@/components/secure-image";
import { ArrowRight, Calendar, Car, Clock, MapPin, Search, ShieldCheck, Users, X, Zap } from "lucide-react";

export const Route = createFileRoute("/_public/trips")({ component: PublicTripsPage });

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(2026, i, 1).toLocaleDateString(undefined, { month: "short" }),
}));

function daysInMonth(y: string, m: string) { return (y && m) ? new Date(Number(y), Number(m), 0).getDate() : 31; }
function dateStr(y: string, m: string, d: string) { return y && m && d ? `${y}-${m}-${d}` : ""; }
function availDays(y: string, m: string) { return y && m ? Array.from({ length: daysInMonth(y, m) }, (_, i) => String(i + 1).padStart(2, "0")) : []; }

function PublicTripsPage() {
  const { user, setUser } = useAuth();
  const [page, setPage] = useState(1);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originSearch, setOriginSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const debouncedOriginSearch = useDebounce(originSearch, 200);
  const debouncedDestSearch = useDebounce(destSearch, 200);
  const [originOpen, setOriginOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [dateYear, setDateYear] = useState("");
  const [dateMonth, setDateMonth] = useState("");
  const [dateDay, setDateDay] = useState("");
  const [seats, setSeats] = useState("any");
  const [comfortClass, setComfortClass] = useState<string>("any");
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("airtel_money");
  const [paymentPhone, setPaymentPhone] = useState("");
  const date = dateStr(dateYear, dateMonth, dateDay);
  const years = Array.from({ length: 3 }, (_, i) => String(new Date().getFullYear() + i));

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

  const { data: publicTrips, isLoading: loading } = useQuery({
    queryKey: ["trips", "public", { page, origin, destination, date, seats, comfortClass }],
    queryFn: () => tripService.publicList({
      page, limit: 50, originName: origin, destName: destination,
      date: date || undefined, seats: seats === "any" ? undefined : Number(seats),
      comfortClass: comfortClass === "any" ? undefined : (comfortClass as ComfortClass),
    }),
  });

  const trips = publicTrips?.items ?? [];
  const totalPages = publicTrips ? Math.max(1, Math.ceil(publicTrips.total / publicTrips.limit)) : 1;
  const needsEmergency = user ? !user.emergencyContactPhone : false;

  useEffect(() => {
    if (user) {
      setEmergencyName(user.emergencyContactName ?? "");
      setEmergencyPhone(user.emergencyContactPhone ?? "");
      setPaymentPhone(user.phone ?? "");
    }
  }, [user]);

  const saveEmergency = useMutation({
    mutationFn: () => userService.updateMe({ emergencyContactName: emergencyName.trim() || undefined, emergencyContactPhone: emergencyPhone.trim() || undefined }),
    onSuccess: (u: User) => { setUser(u); toast.success("Emergency contact saved"); },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Could not save emergency contact"),
  });

  const book = useMutation({
    mutationFn: (t: Trip) => paymentService.initiateRide({ tripId: t.id, boardingPoint: t.originName, dropOffPoint: t.destinationName, method: paymentMethod, phone: paymentPhone }),
    onSuccess: (p: PendingPayment & { checkoutUrl?: string | null }) => {
      toast.success("Opening secure payment.");
      setViewTrip(null);
      if (p?.checkoutUrl) { window.location.assign(p.checkoutUrl); return; }
      toast.error("Could not open payment checkout");
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Payment failed"),
  });

  async function reserve() {
    if (!viewTrip || !user) return;
    if (!paymentPhone.trim()) { toast.error("Payment phone number is required"); return; }
    if (needsEmergency && !emergencyPhone.trim()) { toast.error("Emergency phone number is required"); return; }
    if (needsEmergency) { try { await saveEmergency.mutateAsync(); } catch { return; } }
    book.mutate(viewTrip);
  }

  function handleClick(trip: Trip) {
    if (!user) { window.location.href = "/login"; return; }
    setViewTrip(trip);
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <PageHeader title="Find trips" description="Search verified intercity trips. Pay securely with mobile money." />

      <div className="rounded-md border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
          <div className="space-y-1.5"><Label className="label-eyebrow">From</Label><SearchField val={origin} search={originSearch} onSearch={setOriginSearch} onPick={(d: string) => { setOrigin(d); setOriginSearch(""); setOriginOpen(false); setPage(1); }} onClear={() => { setOrigin(""); setOriginSearch(""); setPage(1); }} open={originOpen} setOpen={setOriginOpen} districts={filteredOrigin} placeholder="Search districts..." /></div>
          <div className="space-y-1.5"><Label className="label-eyebrow">To</Label><SearchField val={destination} search={destSearch} onSearch={setDestSearch} onPick={(d: string) => { setDestination(d); setDestSearch(""); setDestOpen(false); setPage(1); }} onClear={() => { setDestination(""); setDestSearch(""); setPage(1); }} open={destOpen} setOpen={setDestOpen} districts={filteredDest} placeholder="Search districts..." /></div>
          <div className="col-span-2 space-y-1.5 lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="label-eyebrow">Date</Label>
              {(dateYear || dateMonth || dateDay) && <button type="button" onClick={() => { setDateYear(""); setDateMonth(""); setDateDay(""); setPage(1); }} className="text-xs text-primary hover:underline">Clear</button>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={dateYear} onValueChange={(v) => { setDateYear(v); setPage(1); }}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
              <Select value={dateMonth} onValueChange={(v) => { setDateMonth(v); setPage(1); }}><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{monthOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
              <Select value={dateDay} onValueChange={(v) => { setDateDay(v); setPage(1); }}><SelectTrigger disabled={!dateYear || !dateMonth}><SelectValue placeholder="Day" /></SelectTrigger><SelectContent>{availDays(dateYear, dateMonth).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="label-eyebrow">Seats</Label><Select value={seats} onValueChange={(v) => { setSeats(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">All</SelectItem>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="label-eyebrow">Class</Label><Select value={comfortClass} onValueChange={(v) => { setComfortClass(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Any</SelectItem><SelectItem value="economy">Economy</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="comfort">Comfort</SelectItem></SelectContent></Select></div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-lg font-semibold">Available trips</h2>
          {publicTrips && <div className="text-xs text-muted-foreground">Page {publicTrips.page} of {totalPages} · {publicTrips.total} trips</div>}
        </div>
        {loading ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-12 text-center">
            <Car className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">No scheduled trips found.</p>
            <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <div key={trip.id} className="group flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-border-strong">
                <div className="flex items-center gap-2 mb-3">
                  <StatusPill status={trip.status} />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{trip.comfortClass}</span>
                </div>
                <div className="flex items-center gap-2 font-display text-base font-semibold mb-1">
                  <span className="truncate">{trip.originName}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{trip.destinationName}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(trip.departureTime)}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{trip.distanceKm} km</span>
                  {trip.vehicle && <span className="flex items-center gap-1"><Car className="h-3 w-3" />{trip.vehicle.make} {trip.vehicle.model}</span>}
                </div>
                <div className="mt-auto flex items-end justify-between pt-3 border-t border-border">
                  <div>
                    <div className="font-display text-xl font-semibold tabular text-primary">{formatMwk(trip.farePerSeatMwk)}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{trip.availableSeats}/{trip.totalSeats} seats</div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleClick(trip)}>
                    View details <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((c) => Math.max(1, c - 1))}>Previous</Button>
          <span className="text-xs text-muted-foreground">{publicTrips ? `${publicTrips.items.length} shown` : "0 shown"}</span>
          <Button variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((c) => c + 1)}>Next</Button>
        </div>
      </section>

      <TripDetailModal
        trip={viewTrip}
        open={!!viewTrip}
        emergencyName={emergencyName} emergencyPhone={emergencyPhone}
        paymentMethod={paymentMethod} paymentPhone={paymentPhone}
        needsEmergency={needsEmergency}
        isBooking={book.isPending} isSavingEmergency={saveEmergency.isPending}
        onEmergencyNameChange={setEmergencyName} onEmergencyPhoneChange={setEmergencyPhone}
        onPaymentMethodChange={setPaymentMethod} onPaymentPhoneChange={setPaymentPhone}
        onClose={() => setViewTrip(null)}
        onReserve={reserve}
      />
    </div>
  );
}

function TripDetailModal({ trip, open, emergencyName, emergencyPhone, paymentMethod, paymentPhone, needsEmergency, isBooking, isSavingEmergency, onEmergencyNameChange, onEmergencyPhoneChange, onPaymentMethodChange, onPaymentPhoneChange, onClose, onReserve }: {
  trip: Trip | null; open: boolean; emergencyName: string; emergencyPhone: string; paymentMethod: PaymentMethod; paymentPhone: string;
  needsEmergency: boolean; isBooking: boolean; isSavingEmergency: boolean;
  onEmergencyNameChange: (v: string) => void; onEmergencyPhoneChange: (v: string) => void;
  onPaymentMethodChange: (v: PaymentMethod) => void; onPaymentPhoneChange: (v: string) => void;
  onClose: () => void; onReserve: () => void;
}) {
  if (!trip) return null;
  const fullyBooked = trip.availableSeats <= 0;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92svh] overflow-y-auto p-0 sm:max-w-lg">
        <div className="bg-card p-6 border-b border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{trip.originName} → {trip.destinationName}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 mt-1"><Calendar className="h-3.5 w-3.5" />{formatDateTime(trip.departureTime)}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <InfoTile icon={<Zap className="h-4 w-4" />} label="Fare" value={formatMwk(trip.farePerSeatMwk)} />
            <InfoTile icon={<Users className="h-4 w-4" />} label="Seats" value={`${trip.availableSeats}/${trip.totalSeats}`} />
            <InfoTile icon={<MapPin className="h-4 w-4" />} label="Distance" value={`${trip.distanceKm} km`} />
            <InfoTile icon={<Clock className="h-4 w-4" />} label="Duration" value={trip.estimatedDurationMinutes ? `${Math.floor(trip.estimatedDurationMinutes / 60)}h ${trip.estimatedDurationMinutes % 60}m` : "Not set"} />
            <InfoTile icon={<ShieldCheck className="h-4 w-4" />} label="Class" value={trip.comfortClass} />
            <InfoTile icon={<Car className="h-4 w-4" />} label="Vehicle" value={trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "Pending"} />
            {trip.vehicle?.plateNumber && <InfoTile icon={<Car className="h-4 w-4" />} label="Plate" value={trip.vehicle.plateNumber} />}
            {trip.vehicle?.color && <InfoTile icon={<Car className="h-4 w-4" />} label="Color" value={trip.vehicle.color} />}
          </div>
          <div className="rounded-md border border-border bg-surface-2 p-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">A</div>
                <div><div className="text-sm font-medium">Boarding point</div><div className="text-xs text-muted-foreground">{trip.originName}</div></div>
              </div>
              <div className="ml-2.5 border-l-2 border-dashed border-border pl-3.5 h-6" />
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">B</div>
                <div><div className="text-sm font-medium">Drop-off point</div><div className="text-xs text-muted-foreground">{trip.destinationName}</div></div>
              </div>
            </div>
          </div>
          {needsEmergency && (
            <div className="rounded-md border border-gold/40 bg-gold/5 p-4">
              <div className="label-eyebrow text-gold">Emergency contact required</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="label-eyebrow">Contact name</Label><Input value={emergencyName} onChange={(e) => onEmergencyNameChange(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="label-eyebrow">Contact phone</Label><Input value={emergencyPhone} onChange={(e) => onEmergencyPhoneChange(e.target.value)} placeholder="+265..." /></div>
              </div>
            </div>
          )}
          <div className="rounded-md border border-border bg-card p-4">
            <div className="label-eyebrow">Payment</div>
            <p className="mt-1 text-xs text-muted-foreground">Your booking is created only after payment is confirmed.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="label-eyebrow">Method</Label><Select value={paymentMethod} onValueChange={(v) => onPaymentMethodChange(v as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="airtel_money">Airtel Money</SelectItem><SelectItem value="tnm_mpamba">TNM Mpamba</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="label-eyebrow">Payment phone</Label><Input value={paymentPhone} onChange={(e) => onPaymentPhoneChange(e.target.value)} /></div>
            </div>
          </div>
          <Button className="h-11 w-full" disabled={fullyBooked || isBooking || isSavingEmergency || !paymentPhone.trim()} onClick={onReserve}>
            {fullyBooked ? "Fully booked" : isBooking || isSavingEmergency ? "Processing payment..." : `Pay ${formatMwk(trip.farePerSeatMwk)} — Book now`}
          </Button>
          {(trip.vehicle?.imageUrls?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="label-eyebrow">Vehicle photos</div>
              <div className="grid grid-cols-2 gap-2">
                {(trip.vehicle?.imageUrls ?? []).slice(0, 4).map((url: string) => (
                  <SecureImage key={url} src={url} alt={`${trip.vehicle?.make ?? "Vehicle"} photo`} className="aspect-[4/3] w-full rounded-md border border-border object-cover" />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function SearchField({ val, search, onSearch, onPick, onClear, open, setOpen, districts, placeholder }: {
  val: string; search: string; onSearch: (v: string) => void; onPick: (d: string) => void; onClear: () => void;
  open: boolean; setOpen: (o: boolean) => void; districts: string[]; placeholder: string;
}) {
  return (
    <div className="relative">
      {val ? (
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm">{val}</span>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { onSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} className="pl-9" />
          {open && districts.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {districts.map((d) => (
                <button key={d} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => onPick(d)}><MapPin className="mr-2 inline h-3.5 w-3.5 text-muted-foreground" />{d}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}