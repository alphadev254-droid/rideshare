import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { bookingService, tripService, type Trip, type TripLocation } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatMwk, formatDistanceKm, formatDuration } from "@/lib/format";
import { API_CONFIG } from "@/lib/api/config";
import { createAuthedSocket } from "@/lib/socket";
import { ArrowLeft, CheckCircle2, CircleDot, Copy, ExternalLink, Flag, KeyRound, MapPin, Maximize2, Navigation, Pencil, Play, Plus, Share2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/trips/$id")({
  component: DriverTripDetail,
});

function DriverTripDetail() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const qc = useQueryClient();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [gpsPromptOpen, setGpsPromptOpen] = useState(false);
  const [gpsAllowed, setGpsAllowed] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState<TripLocation | null>(null);
  const [copiedTrip, setCopiedTrip] = useState(false);
  const [copiedDriver, setCopiedDriver] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => tripService.byId(id),
    refetchInterval: 15_000,
  });
  const { data: bookings } = useQuery({
    queryKey: ["bookings", "trip", id],
    queryFn: () => bookingService.byTrip(id),
  });

  const start = useMutation({
    mutationFn: () => tripService.start(id),
    onSuccess: () => {
      toast.success("Trip started — GPS tracking active");
      qc.invalidateQueries({ queryKey: ["trip", id] });
      checkGpsPermission();
    },
  });
  const complete = useMutation({
    mutationFn: () => tripService.complete(id),
    onSuccess: () => {
      toast.success("Trip completed — payout released");
      qc.invalidateQueries({ queryKey: ["trip", id] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => tripService.cancel(id),
    onSuccess: () => {
      toast.success("Trip cancelled");
      qc.invalidateQueries({ queryKey: ["trip", id] });
    },
  });
  const setStatus = useMutation({
    mutationFn: (s: "boarding") => tripService.setStatus(id, s),
    onSuccess: () => {
      toast.success("Passengers notified that you are at the boarding point");
      qc.invalidateQueries({ queryKey: ["trip", id] });
    },
  });
  const verify = useMutation({
    mutationFn: ({ bookingId, code }: { bookingId: string; code: string }) =>
      bookingService.verifyCode(bookingId, code),
    onSuccess: (res) => {
      toast.success(`${res.seatsBooked} passenger${res.seatsBooked === 1 ? "" : "s"} checked in`);
      qc.invalidateQueries({ queryKey: ["bookings", "trip", id] });
    },
  });

  // ── GPS Permission ────────────────────────────────────────────
  function checkGpsPermission() {
    if (!("permissions" in navigator)) {
      (navigator as Navigator).geolocation.getCurrentPosition(
        () => setGpsAllowed(true),
        () => setGpsPromptOpen(true),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
      return;
    }
    (navigator as Navigator & { permissions?: { query: (opts: { name: string }) => Promise<{ state: string }> } }).permissions
      ?.query({ name: "geolocation" })
      .then((result: { state: string }) => {
        if (result.state === "granted") {
          setGpsAllowed(true);
        } else if (result.state === "prompt") {
          setGpsPromptOpen(true);
        } else {
          setGpsError("Location permission denied. Enable GPS in your device settings.");
          setGpsPromptOpen(true);
        }
      })
      .catch(() => {
        setGpsPromptOpen(true);
      });
  }

  function requestGpsPermission() {
    setGpsPromptOpen(false);
    setGpsError(null);
    (navigator as Navigator).geolocation.getCurrentPosition(
      () => {
        setGpsAllowed(true);
        toast.success("GPS enabled");
      },
      (err) => {
        setGpsError(`GPS unavailable: ${err.message}. Enable location services in settings.`);
        setGpsPromptOpen(true);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  // ── GPS Watch ──────────────────────────────────────────────────
  useEffect(() => {
    if (trip?.status !== "in_transit") return;
    checkGpsPermission();
  }, [trip?.status]);

  useEffect(() => {
    if (!gpsAllowed || trip?.status !== "in_transit") return;

    const socket = createAuthedSocket();
    socket.emit("trip:join", id);

    let watchId: number | null = null;
    let lastSent = 0;

    if ("geolocation" in navigator) {
      watchId = (navigator as Navigator).geolocation.watchPosition(
        (position) => {
          const now = Date.now();
          if (now - lastSent < 3_000) return;
          lastSent = now;

          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          socket.emit("driver:location", {
            tripId: id,
            ...coords,
            timestamp: now,
          });
          setLiveLocation((prev) => ({
            tripId: id,
            status: trip!.status,
            gpsTrackingActive: true,
            lat: coords.lat,
            lng: coords.lng,
            address: prev?.address ?? null,
            areaName: prev?.areaName ?? null,
            addressUpdatedAt: prev?.addressUpdatedAt ?? null,
            updatedAt: new Date().toISOString(),
          }));
        },
        (err) => {
          if (err.code === 1) {
            setGpsPromptOpen(true);
            setGpsAllowed(false);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5_000,
          timeout: 20_000,
        },
      );
    }

    return () => {
      if (watchId !== null) (navigator as Navigator).geolocation.clearWatch(watchId);
      socket.emit("trip:leave", id);
      socket.disconnect();
    };
  }, [gpsAllowed, trip?.status, id]);

  // ── Map ────────────────────────────────────────────────────────
  const hasPoint = typeof liveLocation?.lat === "number" && typeof liveLocation?.lng === "number";
  const mapboxAccessToken = API_CONFIG.mapboxAccessToken;

  useEffect(() => {
    if (!hasPoint || trip?.status !== "in_transit") return;
    let cancelled = false;
    const container = mapContainerRef.current;
    if (!container) return;

    async function initMap() {
      if (mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container) return;

      const point = liveLocation!;
      mapRef.current = new maplibregl.Map({
        container,
        center: [point.lng!, point.lat!],
        zoom: 15,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            mapbox: {
              type: "raster",
              tiles: [
                `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxAccessToken}`,
              ],
              tileSize: 256,
              attribution: "(c) Mapbox",
            },
          },
          layers: [{ id: "base-map", type: "raster", source: "mapbox" }],
        },
      });

      mapRef.current.addControl(
        new maplibregl.NavigationControl({ visualizePitch: false }),
        "top-right",
      );

      const el = document.createElement("div");
      el.className = "driver-location-marker";
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([point.lng!, point.lat!])
        .addTo(mapRef.current);
    }

    void initMap();
    return () => { cancelled = true; };
  }, [hasPoint, trip?.status, mapboxAccessToken]);

  useEffect(() => {
    if (!hasPoint) return;
    const point = liveLocation!;
    const lngLat: [number, number] = [point.lng!, point.lat!];
    if (markerRef.current) {
      markerRef.current.setLngLat(lngLat);
    }
    if (mapRef.current) {
      mapRef.current.easeTo({
        center: lngLat,
        zoom: Math.max(mapRef.current.getZoom(), 14),
        duration: 700,
      });
    }
  }, [liveLocation?.lat, liveLocation?.lng, hasPoint]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      mapRef.current?.remove();
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────
  if (pathname.endsWith("/edit")) return <Outlet />;
  if (isLoading) return <LoadingState />;
  if (!trip)
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Trip not found.
      </div>
    );

  return (
    <div className="space-y-5">
      <Link
        to="/driver/trips"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All trips
      </Link>

      <PageHeader
        eyebrow={trip.comfortClass}
        title={`${trip.originName} → ${trip.destinationName}`}
        description={formatDateTime(trip.departureTime)}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <StatusPill status={trip.status} />
            {/* Share this trip */}
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/t/${trip.id}`;
                navigator.clipboard.writeText(url).then(() => {
                  setCopiedTrip(true);
                  setTimeout(() => setCopiedTrip(false), 2000);
                });
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:flex-none"
              title="Copy shareable trip link"
            >
              {copiedTrip ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Copied!</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copy trip link</>
              )}
            </button>
            {/* Share all my trips */}
            <button
              type="button"
              onClick={() => {
                const driverProfileId = trip.driverId ?? trip.driver?.id;
                if (!driverProfileId) return;
                const url = `${window.location.origin}/d/${driverProfileId}`;
                navigator.clipboard.writeText(url).then(() => {
                  setCopiedDriver(true);
                  setTimeout(() => setCopiedDriver(false), 2000);
                });
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:flex-none"
              title="Copy link to all your trips"
            >
              {copiedDriver ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Copied!</>
              ) : (
                <><Users className="h-3.5 w-3.5" /> Share all my trips</>
              )}
            </button>
          </div>
        }
      />

      {/* ── GPS Permission Prompt ──────────────────────────── */}
      {gpsPromptOpen && (
        <div className="rounded-md border border-gold/50 bg-gold/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div className="flex-1">
              <h3 className="font-display text-base font-semibold text-gold">
                {gpsError ? "GPS Required" : "Enable Location Sharing"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {gpsError ?? "Passengers need to see your live location during the trip. Allow GPS access to share your position."}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button onClick={requestGpsPermission}>
                  {gpsError ? "Try again" : "Enable GPS"}
                </Button>
                <Button variant="outline" onClick={() => setGpsPromptOpen(false)}>
                  Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Live Map (in_transit) ───────────────────────────── */}
      {trip.status === "in_transit" && (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {gpsAllowed && hasPoint ? "Live GPS active" : "Waiting for GPS signal..."}
              </span>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/trips/$id/location" params={{ id }}>
                <Maximize2 className="h-3.5 w-3.5" />
                View full map
              </Link>
            </Button>
          </div>
          <div className="relative h-[40vh] min-h-[280px] w-full bg-surface-2">
            <div ref={mapContainerRef} className="h-full w-full" />
            {!hasPoint && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-sm text-muted-foreground">
                  <Navigation className="mx-auto mb-2 h-8 w-8" />
                  <p>GPS location pending</p>
                  <p className="mt-1 text-xs">
                    {gpsAllowed
                      ? "Acquiring satellite signal..."
                      : "Enable GPS to share your location"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────── */}
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {(trip.status === "scheduled" || trip.status === "boarding") && !trip.startedAt && (
          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link to="/driver/trips/$id/edit" params={{ id }}>
              <Pencil className="h-4 w-4" />
              Edit trip
            </Link>
          </Button>
        )}
        {trip.status === "scheduled" && (
          <Button
            onClick={() => setStatus.mutate("boarding")}
            disabled={setStatus.isPending}
            className="w-full gap-2 animate-pulse sm:w-auto"
          >
            <KeyRound className="h-4 w-4" />
            Notify passengers you are at the boarding point
          </Button>
        )}
        {trip.status === "boarding" && (
          <Button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="w-full gap-2 animate-pulse sm:w-auto"
          >
            <Play className="h-4 w-4" />
            Start trip and share GPS
          </Button>
        )}
        {trip.status === "in_transit" && (
          <Button onClick={() => complete.mutate()} disabled={complete.isPending} className="w-full gap-2 sm:w-auto">
            <CheckCircle2 className="h-4 w-4" />
            Mark complete
          </Button>
        )}
        {trip.status !== "completed" && trip.status !== "cancelled" && (
          <Button
            variant="outline"
            className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 sm:w-auto"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        )}
      </div>

      {/* ── Trip info + manifest ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="rounded-md border border-border bg-card p-4 sm:p-5">
          <h3 className="label-eyebrow">Trip</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Fare/seat</dt>
              <dd className="tabular font-medium">{formatMwk(trip.farePerSeatMwk)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Seats</dt>
              <dd className="tabular">{trip.availableSeats}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Distance</dt>
              <dd className="tabular">{formatDistanceKm(trip.distanceKm)}</dd>
            </div>
            {trip.estimatedDurationMinutes && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Approx. duration</dt>
                <dd className="tabular">{formatDuration(trip.estimatedDurationMinutes)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd>{trip.vehicle?.plateNumber}</dd>
            </div>
            {trip.startedAt && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Started</dt>
                <dd>{formatDateTime(trip.startedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        <RouteManifestView trip={trip} />

        <div className="rounded-md border border-border bg-card p-4 sm:p-5 lg:col-span-3">
          <h3 className="label-eyebrow">Passenger manifest</h3>
          {(bookings ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <>
            <div className="mt-3 space-y-3 md:hidden">
              {(bookings ?? []).map((b) => {
                const seats = b.seatsBooked ?? 1;
                const travelers = b.travelers ?? [];
                const bookedRoute = b.segment
                  ? `${b.segment.fromStop?.name ?? b.boardingPoint} to ${b.segment.toStop?.name ?? b.dropOffPoint ?? "Drop-off"}`
                  : `${b.trip?.originName ?? trip.originName} to ${b.trip?.destinationName ?? trip.destinationName}`;
                const travelerSummary = travelers.length > 0
                  ? travelers.map((traveler) => traveler.fullName).join(", ")
                  : b.passenger?.fullName ?? "Passenger";

                return (
                  <div key={b.id} className="rounded-md border border-border bg-surface-2/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{b.passenger?.fullName}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground">{b.passenger?.phone}</div>
                      </div>
                      <StatusPill status={b.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <MobileManifestDetail label="Route" value={bookedRoute} wide />
                      <MobileManifestDetail label="Boarding" value={b.boardingPoint} />
                      <MobileManifestDetail label="Drop-off" value={b.dropOffPoint ?? b.segment?.toStop?.name ?? trip.destinationName} />
                      <MobileManifestDetail label="Seats" value={String(seats)} />
                      <MobileManifestDetail label="Fare" value={formatMwk(b.fareMwk)} />
                      <MobileManifestDetail label="Payment" value={b.paymentStatus} />
                      <MobileManifestDetail label="Travelers" value={travelerSummary} wide />
                    </div>
                    {b.status === "confirmed" && (
                      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                        <Input
                          placeholder="Code"
                          value={codes[b.id] ?? ""}
                          onChange={(e) => setCodes((c) => ({ ...c, [b.id]: e.target.value.toUpperCase() }))}
                          className="h-9 font-mono uppercase"
                          maxLength={6}
                        />
                        <Button
                          size="sm"
                          onClick={() => verify.mutate({ bookingId: b.id, code: codes[b.id] ?? "" })}
                          disabled={!codes[b.id] || verify.isPending}
                        >
                          Verify
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Passenger</th>
                    <th className="px-3 py-2 font-medium">Booked route</th>
                    <th className="px-3 py-2 font-medium">Boarding</th>
                    <th className="px-3 py-2 font-medium">Drop-off</th>
                    <th className="px-3 py-2 font-medium">Seats</th>
                    <th className="px-3 py-2 font-medium">Travelers</th>
                    <th className="px-3 py-2 font-medium">Fare</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(bookings ?? []).map((b) => {
                    const seats = b.seatsBooked ?? 1;
                    const travelers = b.travelers ?? [];
                    const bookedRoute = b.segment
                      ? `${b.segment.fromStop?.name ?? b.boardingPoint} to ${b.segment.toStop?.name ?? b.dropOffPoint ?? "Drop-off"}`
                      : `${b.trip?.originName ?? trip.originName} to ${b.trip?.destinationName ?? trip.destinationName}`;
                    const travelerSummary = travelers.length > 0
                      ? travelers.map((traveler) => traveler.fullName).join(", ")
                      : b.passenger?.fullName ?? "Passenger";

                    return (
                      <tr key={b.id} className="align-middle">
                        <td className="max-w-[190px] px-3 py-2">
                          <div className="truncate font-medium">{b.passenger?.fullName}</div>
                          <div className="truncate font-mono text-xs text-muted-foreground">{b.passenger?.phone}</div>
                        </td>
                        <td className="max-w-[210px] px-3 py-2">
                          <div className="truncate font-medium">{bookedRoute}</div>
                        </td>
                        <td className="max-w-[170px] px-3 py-2">
                          <div className="truncate text-xs text-muted-foreground">{b.boardingPoint}</div>
                        </td>
                        <td className="max-w-[170px] px-3 py-2">
                          <div className="truncate text-xs text-muted-foreground">{b.dropOffPoint ?? b.segment?.toStop?.name ?? trip.destinationName}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" /> {seats}
                          </span>
                        </td>
                        <td className="max-w-[220px] px-3 py-2">
                          <div className="truncate text-xs text-muted-foreground" title={travelerSummary}>{travelerSummary}</div>
                        </td>
                        <td className="px-3 py-2 font-medium tabular-nums">{formatMwk(b.fareMwk)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <StatusPill status={b.status} />
                            <span className="text-[10px] text-muted-foreground">{b.paymentStatus}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            {b.status === "confirmed" && (
                              <>
                                <Input
                                  placeholder="Code"
                                  value={codes[b.id] ?? ""}
                                  onChange={(e) => setCodes((c) => ({ ...c, [b.id]: e.target.value.toUpperCase() }))}
                                  className="h-8 w-24 font-mono uppercase"
                                  maxLength={6}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => verify.mutate({ bookingId: b.id, code: codes[b.id] ?? "" })}
                                  disabled={!codes[b.id] || verify.isPending}
                                >
                                  Verify
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileManifestDetail({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium text-foreground">{value || "Not set"}</div>
    </div>
  );
}

function RouteManifestView({ trip }: { trip: Trip }) {
  const stops = getRouteStops(trip);
  const segments = getRouteSegments(trip);
  const extraSegments = segments.filter((segment) => !(segment.fromOrder === 0 && segment.toOrder === stops.length - 1));

  return (
    <div className="rounded-md border border-border bg-card lg:col-span-2">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="label-eyebrow text-primary">Route manifest</div>
          <h3 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-normal sm:text-2xl">
            <span>{trip.originName}</span>
            <span className="text-muted-foreground">to</span>
            <span>{trip.destinationName}</span>
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Full trip: depart {formatClock(trip.departureTime)}
            {trip.estimatedDurationMinutes ? ` - ${formatDuration(trip.estimatedDurationMinutes)}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-56 sm:gap-3">
          <MiniMetric label="Routes" value={String(segments.length || 1)} />
          <MiniMetric label="Capacity" value={`${trip.totalSeats} seats`} />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="relative space-y-4 pl-9 sm:pl-11">
          <div className="absolute bottom-6 left-[13px] top-5 w-px bg-border sm:left-[17px]" />
          <TimelineEndpoint tone="start" title={stops[0]?.name ?? trip.originName} subtitle={`Depart - ${formatClock(trip.departureTime)}`} />

          {extraSegments.length > 0 ? (
            <div className="space-y-3">
              {extraSegments.map((segment, index) => (
                <div key={segment.id ?? `${segment.fromOrder}-${segment.toOrder}-${index}`} className="relative rounded-md border border-border bg-card p-3">
                  <span className="absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground sm:-left-[38px] sm:h-8 sm:w-8">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {segment.fromStop.name} to {segment.toStop.name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Bookable route passengers can reserve
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                      <MiniMetric label="Vacancy" value={`${segment.maxSeats} seats`} />
                      <MiniMetric label="Amount" value={formatMwk(segment.farePerSeatMwk)} />
                      <MiniMetric label="Distance" value={segment.distanceKm ? formatDistanceKm(segment.distanceKm) : "Not set"} />
                      <MiniMetric
                        label="Drive"
                        value={segment.estimatedDurationMinutes ? formatDuration(segment.estimatedDurationMinutes) : "Not set"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative rounded-md border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              <span className="absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border bg-card text-muted-foreground sm:-left-[38px] sm:h-8 sm:w-8">
                <Plus className="h-4 w-4" />
              </span>
              No extra bookable routes added.
            </div>
          )}

          <TimelineEndpoint
            tone="end"
            title={stops.at(-1)?.name ?? trip.destinationName}
            subtitle={`Arrive - ${formatArrival(trip, stops.at(-1)?.arrivalOffsetMinutes)}`}
          />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-2.5 py-2 sm:px-3">
      <div className="label-eyebrow text-[10px]">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TimelineEndpoint({ tone, title, subtitle }: { tone: "start" | "end"; title: string; subtitle: string }) {
  const Icon = tone === "start" ? CircleDot : Flag;
  return (
    <div className="relative">
      <span
        className={`absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full sm:-left-[38px] sm:h-8 sm:w-8 ${
          tone === "start" ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function getRouteStops(trip: Trip) {
  if (trip.routeStops && trip.routeStops.length >= 2) {
    return [...trip.routeStops].sort((a, b) => a.stopOrder - b.stopOrder);
  }
  return [
    { name: trip.originName, stopOrder: 0, departureOffsetMinutes: 0, arrivalOffsetMinutes: null },
    { name: trip.destinationName, stopOrder: 1, departureOffsetMinutes: null, arrivalOffsetMinutes: trip.estimatedDurationMinutes ?? null },
  ];
}

function getRouteSegments(trip: Trip) {
  if (trip.routeSegments && trip.routeSegments.length > 0) return trip.routeSegments;
  const stops = getRouteStops(trip);
  return [
    {
      id: "main",
      fromOrder: 0,
      toOrder: stops.length - 1,
      farePerSeatMwk: trip.farePerSeatMwk,
      maxSeats: trip.totalSeats,
      distanceKm: trip.distanceKm,
      estimatedDurationMinutes: trip.estimatedDurationMinutes,
      fromStop: stops[0],
      toStop: stops.at(-1) ?? stops[0],
    },
  ];
}

function formatClock(value?: string | Date | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatArrival(trip: Trip, offset?: number | null) {
  if (offset === null || offset === undefined) {
    if (!trip.estimatedDurationMinutes) return "Not set";
    return formatClock(new Date(new Date(trip.departureTime).getTime() + trip.estimatedDurationMinutes * 60_000));
  }
  return formatClock(new Date(new Date(trip.departureTime).getTime() + offset * 60_000));
}
