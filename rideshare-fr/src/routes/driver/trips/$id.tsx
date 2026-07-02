import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { bookingService, tripService, type Booking, type Trip, type TripLocation } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMwk, formatDistanceKm, formatDuration } from "@/lib/format";
import { API_CONFIG } from "@/lib/api/config";
import { createAuthedSocket } from "@/lib/socket";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Copy,
  ExternalLink,
  Flag,
  KeyRound,
  MapPin,
  Maximize2,
  Navigation,
  Pencil,
  Play,
  Plus,
  Share2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/trips/$id")({
  component: DriverTripDetail,
});

function DriverTripDetail() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const qc = useQueryClient();
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
      toast.success("Passengers notified that you've arrived");
      qc.invalidateQueries({ queryKey: ["trip", id] });
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
    (
      navigator as Navigator & {
        permissions?: { query: (opts: { name: string }) => Promise<{ state: string }> };
      }
    ).permissions
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
    return () => {
      cancelled = true;
    };
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
  if (pathname.endsWith("/edit") || pathname.endsWith("/passengers")) return <Outlet />;
  if (isLoading) return <LoadingState />;
  if (!trip)
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Trip not found.
      </div>
    );

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow={trip.comfortClass}
        title={
          <span className="flex min-w-0 items-center gap-2">
            <Link
              to="/driver/trips"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              aria-label="All trips"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-0 truncate">
              {trip.originName} → {trip.destinationName}
            </span>
          </span>
        }
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
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy trip link
                </>
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
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Copied!
                </>
              ) : (
                <>
                  <Users className="h-3.5 w-3.5" /> Share all my trips
                </>
              )}
            </button>
          </div>
        }
      />

      {/* ── GPS Permission Prompt ──────────────────────────── */}
      {gpsPromptOpen && (
        <div className="rounded-md border border-gold/50 bg-gold/5 p-3 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div className="flex-1">
              <h3 className="font-display text-base font-semibold text-gold">
                {gpsError ? "GPS Required" : "Enable Location Sharing"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {gpsError ??
                  "Passengers need to see your live location during the trip. Allow GPS access to share your position."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-row">
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
          <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2 sm:px-4">
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
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button asChild variant="outline" className="order-2 w-full gap-2 sm:order-none sm:w-auto">
          <Link to="/driver/trips/$id/passengers" params={{ id }}>
            <Users className="h-4 w-4" />
            View passengers
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              {bookings?.length ?? 0}
            </span>
          </Link>
        </Button>
        {(trip.status === "scheduled" || trip.status === "boarding") && !trip.startedAt && (
          <Button
            asChild
            variant="outline"
            className="order-2 w-full gap-2 sm:order-none sm:w-auto"
          >
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
            className="order-1 w-full gap-2 animate-pulse sm:order-none sm:w-auto"
          >
            <KeyRound className="h-4 w-4" />
            <span>Notify passengers you've arrived</span>
          </Button>
        )}
        {trip.status === "boarding" && (
          <Button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="order-1 col-span-2 w-full gap-2 animate-pulse sm:order-none sm:w-auto"
          >
            <Play className="h-4 w-4" />
            Start trip and share GPS
          </Button>
        )}
        {trip.status === "in_transit" && (
          <Button
            onClick={() => complete.mutate()}
            disabled={complete.isPending}
            className="order-1 w-full gap-2 sm:order-none sm:w-auto"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark complete
          </Button>
        )}
        {trip.status !== "completed" && trip.status !== "cancelled" && (
          <Button
            variant="outline"
            className="order-3 w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 sm:order-none sm:w-auto"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:gap-6">
        <RouteManifestView trip={trip} bookings={bookings ?? []} />
      </div>
    </div>
  );
}

function RouteManifestView({ trip, bookings }: { trip: Trip; bookings: Booking[] }) {
  const stops = getRouteStops(trip);
  const segments = getRouteSegments(trip);
  const mainSegment =
    segments.find((segment) => segment.fromOrder === 0 && segment.toOrder === stops.length - 1) ??
    getMainRouteSegment(trip, stops);
  const extraSegments = segments.filter((segment) => segment !== mainSegment);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="label-eyebrow text-primary">Route manifest</div>
          <h3 className="mt-1.5 flex flex-wrap items-center gap-2 text-lg font-semibold tracking-normal sm:mt-2 sm:text-2xl">
            <span>{trip.originName}</span>
            <span className="text-muted-foreground">to</span>
            <span>{trip.destinationName}</span>
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
            Full trip: depart {formatClock(trip.departureTime)}
            {trip.estimatedDurationMinutes
              ? ` - ${formatDuration(trip.estimatedDurationMinutes)}`
              : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-56 sm:gap-3">
          <MiniMetric label="Routes" value={String(segments.length || 1)} />
          <MiniMetric label="Capacity" value={`${trip.totalSeats} seats`} />
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <div className="relative space-y-3 pl-8 sm:space-y-4 sm:pl-11">
          <div className="absolute bottom-6 left-[13px] top-5 w-px bg-border sm:left-[17px]" />
          <TimelineEndpoint
            tone="start"
            title={stops[0]?.name ?? trip.originName}
            subtitle={`Depart - ${formatClock(trip.departureTime)}`}
          />

          <RouteSegmentCard
            segment={mainSegment}
            index={0}
            variant="main"
            bookedSeats={bookedSeatsForSegment(mainSegment, bookings)}
          />

          {extraSegments.length > 0 ? (
            <div className="space-y-3">
              {extraSegments.map((segment, index) => (
                <RouteSegmentCard
                  key={segment.id ?? `${segment.fromOrder}-${segment.toOrder}-${index}`}
                  segment={segment}
                  index={index + 1}
                  variant="extra"
                  bookedSeats={bookedSeatsForSegment(segment, bookings)}
                />
              ))}
            </div>
          ) : (
            <div className="relative rounded-md border border-dashed border-border bg-background px-3 py-2.5 text-xs text-muted-foreground sm:px-4 sm:py-3 sm:text-sm">
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

function RouteSegmentCard({
  segment,
  index,
  variant,
  bookedSeats,
}: {
  segment: ReturnType<typeof getRouteSegments>[number];
  index: number;
  variant: "main" | "extra";
  bookedSeats: number;
}) {
  const isMain = variant === "main";

  return (
    <div
      className={`relative rounded-md border p-2.5 sm:p-3 ${isMain ? "border-primary/35 bg-primary/5" : "border-border bg-card"}`}
    >
      <span
        className={`absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold sm:-left-[38px] sm:h-8 sm:w-8 ${
          isMain
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground"
        }`}
      >
        {isMain ? <CircleDot className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : index}
      </span>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold sm:text-base">
            {segment.fromStop.name} to {segment.toStop.name}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {isMain ? "Main route passengers can book" : "Bookable route passengers can reserve"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs sm:gap-2 md:grid-cols-5">
          <MiniMetric label="Vacancy" value={`${segment.maxSeats} seats`} />
          <MiniMetric label="Booked" value={`${bookedSeats} seats`} />
          <MiniMetric label="Amount" value={formatMwk(segment.farePerSeatMwk)} />
          <MiniMetric
            label="Distance"
            value={segment.distanceKm ? formatDistanceKm(segment.distanceKm) : "Not set"}
          />
          <MiniMetric
            label="Drive"
            value={
              segment.estimatedDurationMinutes
                ? formatDuration(segment.estimatedDurationMinutes)
                : "Not set"
            }
          />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-2 py-1.5 sm:px-3 sm:py-2">
      <div className="label-eyebrow text-[9px] sm:text-[10px]">{label}</div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums sm:mt-1 sm:text-sm">{value}</div>
    </div>
  );
}

function TimelineEndpoint({
  tone,
  title,
  subtitle,
}: {
  tone: "start" | "end";
  title: string;
  subtitle: string;
}) {
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
      <div className="text-sm font-semibold sm:text-base">{title}</div>
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
    {
      name: trip.destinationName,
      stopOrder: 1,
      departureOffsetMinutes: null,
      arrivalOffsetMinutes: trip.estimatedDurationMinutes ?? null,
    },
  ];
}

function getRouteSegments(trip: Trip) {
  if (trip.routeSegments && trip.routeSegments.length > 0) return trip.routeSegments;
  const stops = getRouteStops(trip);
  return [getMainRouteSegment(trip, stops)];
}

function getMainRouteSegment(trip: Trip, stops: ReturnType<typeof getRouteStops>) {
  return {
    id: "main",
    fromOrder: 0,
    toOrder: stops.length - 1,
    farePerSeatMwk: trip.farePerSeatMwk,
    maxSeats: trip.totalSeats,
    distanceKm: trip.distanceKm,
    estimatedDurationMinutes: trip.estimatedDurationMinutes,
    fromStop: stops[0],
    toStop: stops.at(-1) ?? stops[0],
  };
}

function bookedSeatsForSegment(
  segment: ReturnType<typeof getRouteSegments>[number],
  bookings: Booking[],
) {
  return bookings.reduce((total, booking) => {
    if (booking.status === "cancelled" || booking.status === "no_show") return total;

    const seats = booking.seatsBooked ?? 1;
    if (booking.segmentId && segment.id && booking.segmentId === segment.id) {
      return total + seats;
    }

    const fromOrder = booking.segment?.fromOrder;
    const toOrder = booking.segment?.toOrder;
    if (fromOrder === undefined || toOrder === undefined) return total;

    return fromOrder === segment.fromOrder && toOrder === segment.toOrder ? total + seats : total;
  }, 0);
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
    return formatClock(
      new Date(new Date(trip.departureTime).getTime() + trip.estimatedDurationMinutes * 60_000),
    );
  }
  return formatClock(new Date(new Date(trip.departureTime).getTime() + offset * 60_000));
}
