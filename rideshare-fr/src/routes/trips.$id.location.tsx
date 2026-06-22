import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { tripService } from "@/lib/api";
import type { TripLocation } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { API_CONFIG } from "@/lib/api/config";
import { createAuthedSocket } from "@/lib/socket";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/trips/$id/location")({
  component: DriverLocationPage,
});

function DriverLocationPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [liveLocation, setLiveLocation] = useState<TripLocation | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<{ lat: number; lng: number; updatedAt: string } | null>(null);
  const [passengerFetching, setPassengerFetching] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["trip", id, "location"],
    queryFn: () => tripService.location(id),
    refetchInterval: 15000,
  });

  useEffect(() => {
    setLiveLocation(null);
    setPassengerLocation(null);
  }, [id]);

  useEffect(() => {
    if (!data?.areaName && !data?.address) return;
    setLiveLocation((current) => {
      if (!current) return current;
      return {
        ...current,
        areaName: current.areaName ?? data.areaName ?? null,
        address: current.address ?? data.address ?? null,
        addressUpdatedAt: current.addressUpdatedAt ?? data.addressUpdatedAt ?? null,
      };
    });
  }, [data?.address, data?.addressUpdatedAt, data?.areaName]);

  useEffect(() => {
    const socket = createAuthedSocket();
    socket.emit("trip:join", id);
    socket.on("location:update", (payload: TripLocation & { timestamp?: number }) => {
      if (payload.tripId !== id) return;
      setLiveLocation((current) => ({
        tripId: id,
        status: current?.status ?? data?.status ?? "in_transit",
        gpsTrackingActive: true,
        lat: payload.lat,
        lng: payload.lng,
        address: payload.address ?? current?.address ?? data?.address ?? null,
        areaName: payload.areaName ?? current?.areaName ?? data?.areaName ?? null,
        addressUpdatedAt: payload.addressUpdatedAt ?? current?.addressUpdatedAt ?? data?.addressUpdatedAt ?? null,
        updatedAt: payload.updatedAt ?? new Date(payload.timestamp ?? Date.now()).toISOString(),
      }));
    });

    let watchId: number | null = null;
    if (user?.role === "driver" && "geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          console.log(
            "[GPS:driver]",
            "lat:", position.coords.latitude,
            "lng:", position.coords.longitude,
            "accuracy:", position.coords.accuracy,
            "timestamp:", position.timestamp,
          );
          socket.emit("driver:location", {
            tripId: id,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now(),
          });
        },
        (err) => {
          console.warn("[GPS:driver:error]", err.code, err.message);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
      );
    } else if (user?.role === "passenger" && "geolocation" in navigator) {
      setPassengerFetching(true);
      let bestAccuracy = Infinity;

      const timeoutId = setTimeout(() => {
        if (bestAccuracy > 100) {
          setPassengerFetching(false);
          toast.info("GPS signal weak — using approximate location. Move outdoors or enable GPS.", {
            duration: 6000,
          });
        }
      }, 15_000);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const acc = position.coords.accuracy;
          console.log("[GPS:passenger]", "lat:", position.coords.latitude, "lng:", position.coords.longitude, "accuracy:", acc, "timestamp:", position.timestamp);

          if (acc > bestAccuracy) return;
          bestAccuracy = acc;

          if (acc <= 50) {
            clearTimeout(timeoutId);
            setPassengerLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              updatedAt: new Date().toISOString(),
            });
            setPassengerFetching(false);
          }
        },
        (err) => {
          console.warn("[GPS:passenger:error]", err.code, err.message);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
      );
    } else {
      console.warn("[GPS]", "geolocation not available");
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      socket.emit("trip:leave", id);
      socket.disconnect();
    };
  }, [data?.status, id, user?.role]);

  const location = liveLocation ?? data ?? null;

  return (
    <div className="space-y-4 md:space-y-6">
      <Button variant="outline" size="sm" className="gap-2" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="hidden md:block">
        <PageHeader
          eyebrow="Live tracking"
          title="View driver location"
          description="Location appears while the trip is active and the driver is sharing GPS."
          actions={location ? <StatusPill status={location.status} /> : undefined}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading driver location" />
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          Driver location is not available for this trip.
        </div>
      ) : (
        <div className="grid gap-0 md:gap-4 lg:grid-cols-[1fr_320px]">
          <div className="-mx-4 overflow-hidden border-y border-border bg-card md:mx-0 md:rounded-md md:border">
            <DriverLocationMap key={id} location={location} passengerLocation={passengerLocation} passengerFetching={passengerFetching} />
          </div>

          <aside className="hidden rounded-md border border-border bg-card p-5 md:block">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-4 w-4" />
              <span className="label-eyebrow">Driver GPS</span>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Sharing</dt>
                <dd className="font-medium">{location?.gpsTrackingActive ? "Active" : "Inactive"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Area</dt>
                <dd className="text-right font-medium">{location?.areaName ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="max-w-[180px] text-right">{location?.address ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Latitude</dt>
                <dd className="font-mono tabular">{location?.lat ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Longitude</dt>
                <dd className="font-mono tabular">{location?.lng ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-right">{location?.updatedAt ? formatDateTime(location.updatedAt) : "-"}</dd>
              </div>
              {passengerLocation && (
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <dt className="text-muted-foreground">Your location</dt>
                  <dd className="text-right text-primary">Visible on map</dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}

function DriverLocationMap({
  location,
  passengerLocation,
  passengerFetching,
}: {
  location: TripLocation | null;
  passengerLocation: { lat: number; lng: number; updatedAt: string } | null;
  passengerFetching: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const passengerMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const hasPoint = typeof location?.lat === "number" && typeof location?.lng === "number";
  const hasPassengerPoint = typeof passengerLocation?.lat === "number" && typeof passengerLocation?.lng === "number";
  const mapboxAccessToken = API_CONFIG.mapboxAccessToken;

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        center: hasPoint ? [location.lng!, location.lat!] : [34.3015, -13.2543],
        zoom: hasPoint ? 14 : 5.5,
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
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );
      mapRef.current.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

      if (hasPoint) {
        const el = document.createElement("div");
        el.className = "driver-location-marker";
        markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([location.lng!, location.lat!])
          .addTo(mapRef.current);
      }
    }

    void initMap();

    return () => {
      cancelled = true;
    };
  }, [hasPoint, location?.lat, location?.lng, mapboxAccessToken]);

  useEffect(() => {
    if (!hasPoint) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!mapRef.current) return;

    async function updateMarker() {
      const maplibregl = await import("maplibre-gl");
      const lngLat: [number, number] = [location!.lng!, location!.lat!];

      if (!markerRef.current) {
        const el = document.createElement("div");
        el.className = "driver-location-marker";
        markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(mapRef.current!);
      } else {
        markerRef.current.setLngLat(lngLat);
      }

      mapRef.current!.easeTo({ center: lngLat, zoom: Math.max(mapRef.current!.getZoom(), 14), duration: 700 });
    }

    void updateMarker();
  }, [hasPoint, location?.lat, location?.lng]);

  useEffect(() => {
    if (!hasPassengerPoint) {
      passengerMarkerRef.current?.remove();
      passengerMarkerRef.current = null;
      return;
    }
    if (!mapRef.current) return;

    async function updatePassengerMarker() {
      const maplibregl = await import("maplibre-gl");
      const lngLat: [number, number] = [passengerLocation!.lng, passengerLocation!.lat];

      if (!passengerMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "passenger-location-marker";
        passengerMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(mapRef.current!);
      } else {
        passengerMarkerRef.current.setLngLat(lngLat);
      }

      if (hasPoint && location?.lat !== null && location?.lng !== null) {
        const bounds = new maplibregl.LngLatBounds()
          .extend([location!.lng!, location!.lat!])
          .extend(lngLat);
        mapRef.current!.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 700 });
      } else {
        mapRef.current!.easeTo({ center: lngLat, zoom: Math.max(mapRef.current!.getZoom(), 14), duration: 700 });
      }
    }

    void updatePassengerMarker();
  }, [hasPassengerPoint, hasPoint, location?.lat, location?.lng, passengerLocation?.lat, passengerLocation?.lng]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      passengerMarkerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = null;
      passengerMarkerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-[calc(100svh-112px)] min-h-[520px] w-full md:h-[60vh] md:min-h-[360px]">
      <div ref={containerRef} className="h-full w-full" />
      {!hasPoint && (
        <div className="absolute inset-x-4 top-4 rounded-md border border-border bg-card/95 p-3 text-sm text-muted-foreground shadow-lg">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin align-middle" />
          Waiting for driver GPS...
        </div>
      )}
      {!hasPassengerPoint && passengerFetching && (
        <div className="absolute bottom-4 left-4 rounded-md border border-border bg-card/95 px-4 py-3 text-sm shadow-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-muted-foreground">Fetching your location...</span>
          </div>
        </div>
      )}
      {hasPoint && (location?.areaName || location?.address) && (
        <div className="absolute inset-x-3 top-3 rounded-md border border-border bg-card/95 p-3 shadow-lg md:inset-x-4 md:top-4 md:max-w-md">
          <div className="truncate text-sm font-medium">{location.areaName ?? location.address}</div>
          {location.address && location.address !== location.areaName && (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{location.address}</div>
          )}
        </div>
      )}
      {hasPassengerPoint && (
        <button
          type="button"
          className="absolute bottom-4 left-4 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-lg hover:bg-card transition-colors cursor-pointer"
          onClick={() => {
            if (passengerLocation && mapRef.current) {
              mapRef.current.flyTo({
                center: [passengerLocation.lng, passengerLocation.lat],
                zoom: 15,
                duration: 800,
              });
            }
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-gold align-middle" /> Your location
        </button>
      )}
    </div>
  );
}
