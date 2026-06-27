import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, MapPin, Clock, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/status-pill";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { tripService, type Trip } from "@/lib/api";
import { setPendingTripId } from "@/lib/pending-trip";
import { SecureImage } from "@/components/secure-image";
import { formatMwk, formatDateTime, formatDistanceKm } from "@/lib/format";

const landingHeroImageUrl =
  (import.meta.env.VITE_LANDING_HERO_IMAGE_URL as string | undefined) ??
  "https://media.aircnc.co.ke/media-images/eef78f3e-8d81-4b17-956a-40ec0c71b708.webp";

const landingRouteImageUrl =
  (import.meta.env.VITE_LANDING_ROUTE_IMAGE_URL as string | undefined) ??
  "https://media.aircnc.co.ke/media-images/1ece3bde-c4a6-4428-8f4d-cab1a4f1d59b.webp";
const popularRoutes = [
  { from: "Lilongwe", to: "Blantyre", note: "Shared rides on one of Malawi's busiest routes" },
  { from: "Blantyre", to: "Lilongwe", note: "Book a seat on planned trips to the capital" },
  { from: "Lilongwe", to: "Mzuzu", note: "Affordable shared travel heading north" },
  { from: "Mzuzu", to: "Lilongwe", note: "Find drivers returning through central Malawi" },
  { from: "Lilongwe", to: "Zomba", note: "Split the travel cost between Malawi locations" },
  { from: "Zomba", to: "Blantyre", note: "Shorter shared trips with available seats" },
  { from: "Blantyre", to: "Mangochi", note: "Book seats toward lakeshore destinations" },
  { from: "Lilongwe", to: "Salima", note: "Shared rides for central Malawi routes" },
] as const;

export const Route = createFileRoute("/_public/")({
  head: () => ({
    meta: [
      { title: "ChepetsaRide - Book seats on shared trips across Malawi" },
      { name: "description", content: "Drivers publish planned trips between Malawi places, passengers book available seats and everyone shares the travel cost. Lilongwe, Blantyre, Mzuzu, Zomba and more." },
      { name: "keywords", content: "shared rides Malawi, rideshare Malawi, affordable rides Malawi, cheap rides Malawi, shared car Lilongwe Blantyre, intercity car travel Malawi, Lilongwe to Blantyre ride, Lilongwe to Mzuzu ride, Lilongwe to Zomba ride, Blantyre to Lilongwe ride, Blantyre to Mangochi ride, Lilongwe to Salima ride, Malawi locations rides, Airtel Money rideshare, TNM Mpamba rideshare, split travel cost Malawi, driver passenger Malawi, book seat Malawi" },
      { property: "og:title", content: "ChepetsaRide - Book seats on shared trips across Malawi" },
      { property: "og:description", content: "Drivers publish planned trips, passengers book seats and share the cost. Pay with Airtel Money or TNM Mpamba." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ChepetsaRide - Book seats on shared trips across Malawi" },
      { name: "twitter:description", content: "A driver going your way publishes a planned trip. Book a seat, share the cost and pay with mobile money." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { openModal } = useAuthModal();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);

  const { data: publicTrips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["trips", "public", "landing"],
    queryFn: () =>
      tripService.publicList({
        page: 1,
        limit: 6,
      }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
  const trips = publicTrips?.items ?? [];

  function handleBookTrip(trip: Trip) {
    setPendingTripId(trip.id);
    if (isAuthenticated) {
      navigate({ to: "/app", search: {} });
    } else {
      openModal({ mode: "login", role: "passenger" });
    }
  }

  function handleCtaDrive() {
    openModal({ mode: "register", role: "driver" });
  }

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={landingHeroImageUrl}
          alt="ChepetsaRide road landscape"
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          width={1600}
          height={900}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,12,0.96)_0%,rgba(5,10,12,0.9)_52%,rgba(5,10,12,0.82)_100%)] lg:bg-[linear-gradient(90deg,rgba(5,10,12,0.96)_0%,rgba(5,10,12,0.9)_48%,rgba(5,10,12,0.46)_100%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-16 xl:py-20">
          <div className="lg:col-span-8">
            <div className="label-eyebrow">Lilongwe - Blantyre - Mzuzu - Zomba</div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              A driver going your way. <br />
              <span className="text-primary">You book a seat, share the cost.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Drivers travelling between places publish planned trips and open available seats to passengers. Book your seat, pay with Airtel Money or TNM Mpamba, and travel with people going the same way.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/trips">
                <Button size="lg" className="gap-2">
                  Find a ride <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" onClick={handleCtaDrive}>
                Drive with us
              </Button>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                { k: "Route cost", v: "Split fairly" },
                { k: "Payment", v: "Escrow held" },
                { k: "Verification", v: "Every driver" },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="label-eyebrow mt-1">{s.k}</dt>
                  <dd className="font-display text-2xl font-semibold tabular">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Route visual */}
          <div className="hidden lg:col-span-5 lg:-translate-y-12 xl:-translate-y-10">
            <div className="rounded-xl border border-border bg-card/95 p-0 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
              <img
                src={landingRouteImageUrl}
                alt="ChepetsaRide route preview"
                className="h-auto w-full rounded-xl object-contain"
                loading="eager"
                decoding="async"
                width={1200}
                height={900}
              />
            </div>
          </div>
        </div>
      </section>

      {/* AVAILABLE TRIPS */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="label-eyebrow">Available routes</div>
              <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Pick a trip and go.
              </h2>
            </div>
            {isAuthenticated && (
              <Link
                to="/app"
                search={{}}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                See all trips <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="mt-10">
            {isLoadingTrips ? (
              <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
                Loading available trips...
              </div>
            ) : trips.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No scheduled trips are available right now. Check back soon.
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {trips.map((trip) => (
                  <li key={trip.id}>
                    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong">
                      <div className="flex items-center gap-2">
                        <StatusPill status={trip.status} />
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          {trip.comfortClass}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 font-display text-base font-semibold">
                        <span className="truncate">{trip.originName}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{trip.destinationName}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(trip.departureTime)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          {formatDistanceKm(trip.distanceKm)}
                        </span>
                        {trip.vehicle && (
                          <span className="flex items-center gap-1.5">
                            <Car className="h-3 w-3" />
                            {trip.vehicle.make} {trip.vehicle.model}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <div>
                          <div className="font-display text-xl font-semibold tabular">
                            {formatMwk(trip.farePerSeatMwk)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {trip.availableSeats} available
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="outline" onClick={() => setViewTrip(trip)}>
                            View details
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={trip.availableSeats <= 0}
                            onClick={() => handleBookTrip(trip)}
                          >
                            {trip.availableSeats <= 0 ? "Full" : "Book"}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* POPULAR ROUTES */}
      <section className="border-b border-border bg-surface/30">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-3xl">
            <div className="label-eyebrow">Popular shared ride routes</div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Affordable rides between Malawi places.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Search planned trips from drivers travelling between towns, areas, cities and districts
              like Lilongwe, Blantyre, Mzuzu, Zomba, Mangochi and Salima. Book an available seat and
              share the cost instead of paying for the whole journey alone.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {popularRoutes.map((route) => (
              <Link
                key={`${route.from}-${route.to}`}
                to="/trips"
                className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/60 hover:bg-surface-2 sm:p-4"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold sm:gap-2 sm:text-sm">
                  <span className="truncate">{route.from}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                  <span className="truncate">{route.to}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">{route.note}</p>
                <span className="mt-3 inline-flex text-xs font-medium text-primary group-hover:underline">
                  Find seats
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
              These are some of the routes. You can search more towns, areas, districts and
              pickup places across Malawi.
            </p>
            <Link to="/trips" className="shrink-0">
              <Button size="sm" variant="outline" className="w-full gap-2 sm:w-auto">
                Explore more places <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LandingTripDetailsDialog
        trip={viewTrip}
        open={!!viewTrip}
        onOpenChange={(open) => {
          if (!open) setViewTrip(null);
        }}
        onBook={(trip) => {
          setViewTrip(null);
          handleBookTrip(trip);
        }}
      />

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-10 text-center sm:p-16">
            <div className="label-eyebrow text-primary">Get started</div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your next trip is one phone number away.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Sign up with your phone - we'll text a one-time code to verify your account.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => openModal({ mode: "register", role: "passenger" })}>
                Sign up as passenger
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => openModal({ mode: "register", role: "driver" })}
              >
                Sign up as driver
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function LandingTripDetailsDialog({
  trip,
  open,
  onOpenChange,
  onBook,
}: {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBook: (trip: Trip) => void;
}) {
  if (!trip) return null;
  const fullyBooked = trip.availableSeats <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {trip.originName} to {trip.destinationName}
          </DialogTitle>
          <DialogDescription>{formatDateTime(trip.departureTime)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-2 p-4 text-sm">
            <Detail label="Fare" value={formatMwk(trip.farePerSeatMwk)} sub="per passenger" />
            <Detail label="Available seats" value={String(trip.availableSeats)} sub="seats" />
            <Detail label="Distance" value={formatDistanceKm(trip.distanceKm)} sub="route estimate" />
            <Detail label="Class" value={trip.comfortClass} sub="ride comfort" />
          </div>

          <div className="rounded-md border border-border bg-card p-4">
            <div className="space-y-3">
              <RoutePoint label="From" value={trip.originName} />
              <div className="ml-2 h-6 border-l border-dashed border-border" />
              <RoutePoint label="To" value={trip.destinationName} />
            </div>
          </div>

          {trip.vehicle && (
            <div className="rounded-md border border-border bg-card p-4">
              <div className="label-eyebrow">Vehicle</div>
              <div className="mt-2 font-medium">
                {trip.vehicle.make} {trip.vehicle.model}
              </div>
              <div className="text-sm text-muted-foreground">
                {[trip.vehicle.color, trip.vehicle.plateNumber].filter(Boolean).join(" - ") || "Details pending"}
              </div>
            </div>
          )}

          {(trip.vehicle?.imageUrls?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="label-eyebrow">Vehicle photos</div>
              <div className="grid grid-cols-2 gap-2">
                {(trip.vehicle?.imageUrls ?? []).slice(0, 4).map((url) => (
                  <SecureImage
                    key={url}
                    src={url}
                    alt={`${trip.vehicle?.make ?? "Vehicle"} photo`}
                    className="aspect-[4/3] w-full rounded-md border border-border object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          <Button className="h-11 w-full" disabled={fullyBooked} onClick={() => onBook(trip)}>
            {fullyBooked ? "Fully booked" : "Sign in to book"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoutePoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <MapPin className="mt-0.5 h-4 w-4 text-primary" />
      <div>
        <div className="label-eyebrow">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
function Detail({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className="mt-1 font-display text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}




