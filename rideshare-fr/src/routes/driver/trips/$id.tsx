import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { bookingService, tripService, type TripLocation } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatMwk, formatDistanceKm } from "@/lib/format";
import { API_CONFIG } from "@/lib/api/config";
import { createAuthedSocket } from "@/lib/socket";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, KeyRound, MapPin, Maximize2, Navigation, Pencil, Play, Share2, Users, XCircle } from "lucide-react";
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
    onSuccess: () => {
      toast.success("Passenger authenticated");
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
    <div className="space-y-6">
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
          <div className="flex flex-wrap items-center gap-2">
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
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
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
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
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
          <div className="flex items-start gap-3">
            <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div className="flex-1">
              <h3 className="font-display text-base font-semibold text-gold">
                {gpsError ? "GPS Required" : "Enable Location Sharing"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {gpsError ?? "Passengers need to see your live location during the trip. Allow GPS access to share your position."}
              </p>
              <div className="mt-4 flex gap-2">
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
      <div className="flex flex-wrap gap-2">
        {(trip.status === "scheduled" || trip.status === "boarding") && !trip.startedAt && (
          <Button asChild variant="outline" className="gap-2">
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
            className="gap-2 animate-pulse"
          >
            <KeyRound className="h-4 w-4" />
            Notify passengers you are at the boarding point
          </Button>
        )}
        {trip.status === "boarding" && (
          <Button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="gap-2 animate-pulse"
          >
            <Play className="h-4 w-4" />
            Start trip and share GPS
          </Button>
        )}
        {trip.status === "in_transit" && (
          <Button onClick={() => complete.mutate()} disabled={complete.isPending} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Mark complete
          </Button>
        )}
        {trip.status !== "completed" && trip.status !== "cancelled" && (
          <Button
            variant="outline"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        )}
      </div>

      {/* ── Trip info + manifest ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-5">
          <h3 className="label-eyebrow">Trip</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Fare/seat</dt>
              <dd className="tabular font-medium">{formatMwk(trip.farePerSeatMwk)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Seats</dt>
              <dd className="tabular">{trip.availableSeats}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Distance</dt>
              <dd className="tabular">{formatDistanceKm(trip.distanceKm)}</dd>
            </div>
            {trip.estimatedDurationMinutes && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Approx. duration</dt>
                <dd className="tabular">{formatDuration(trip.estimatedDurationMinutes)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd>{trip.vehicle?.plateNumber}</dd>
            </div>
            {trip.startedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Started</dt>
                <dd>{formatDateTime(trip.startedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-md border border-border bg-card p-5 lg:col-span-2">
          <h3 className="label-eyebrow">Passenger manifest</h3>
          {(bookings ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {(bookings ?? []).map((b) => (
                <li key={b.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{b.passenger?.fullName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{b.passenger?.phone}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Boarding: {b.boardingPoint}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={b.status} />
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
                          disabled={!codes[b.id]}
                        >
                          Verify
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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
