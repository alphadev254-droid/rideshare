import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Clock, Car, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { tripService, type Trip } from "@/lib/api";
import { formatMwk, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_public/")({
  head: () => ({
    meta: [
      { title: "RideShare Malawi — Shared rides between cities" },
      {
        name: "description",
        content:
          "Find a seat on intercity rides across Malawi. Vetted drivers, escrow payments, secret boarding codes.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { openModal } = useAuthModal();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);

  // After authentication, redirect to the pending trip
  useEffect(() => {
    if (isAuthenticated && pendingTripId) {
      const tripId = pendingTripId;
      setPendingTripId(null);
      navigate({ to: "/app/trips/$id", params: { id: tripId } });
    }
  }, [isAuthenticated, pendingTripId, navigate]);

  const { data: publicTrips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["trips", "public", "landing"],
    queryFn: () =>
      tripService.publicList({
        page: 1,
        limit: 6,
      }),
    refetchInterval: 60_000,
  });
  const trips = publicTrips?.items ?? [];

  function handleBookTrip(trip: Trip) {
    if (isAuthenticated) {
      navigate({ to: "/app/trips/$id", params: { id: trip.id } });
    } else {
      setPendingTripId(trip.id);
      openModal({ mode: "register", role: "passenger" });
    }
  }

  function handleCtaFindRide() {
    openModal({ mode: "register", role: "passenger" });
  }

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-7">
            <div className="label-eyebrow">Lilongwe ↔ Blantyre · Mzuzu · Zomba</div>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Cross Malawi <br />
              <span className="text-primary">on someone's spare seat.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Real intercity rides from verified drivers. Pay with Airtel Money or TNM Mpamba — we
              hold the fare in escrow until you board with your secret code.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={handleCtaFindRide} className="gap-2">
                Find a ride <ArrowRight className="h-4 w-4" />
              </Button>
              <Link to="/drivers-info">
                <Button size="lg" variant="outline">
                  Drive with us
                </Button>
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                { k: "Trips run", v: "12,400+" },
                { k: "Driver rating", v: "4.87★" },
                { k: "Cities", v: "11" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="font-display text-2xl font-semibold tabular">{s.v}</div>
                  <div className="label-eyebrow mt-1">{s.k}</div>
                </div>
              ))}
            </dl>
          </div>

          {/* RIGHT — booking visual */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">Today's pick</span>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                  Confirmed
                </span>
              </div>
              <div className="mt-5 flex items-start gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
                  <span className="my-1 h-10 w-px bg-border-strong" />
                  <span className="h-2.5 w-2.5 rounded-sm bg-gold" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="font-display text-lg font-semibold">Lilongwe</div>
                    <div className="text-xs text-muted-foreground">Area 18 roundabout · 06:30</div>
                  </div>
                  <div>
                    <div className="font-display text-lg font-semibold">Blantyre</div>
                    <div className="text-xs text-muted-foreground">CBD · arrives ~12:00</div>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5">
                <Detail label="Vehicle" value="Toyota HiAce" sub="MW-1234" />
                <Detail label="Fare / seat" value="MK 5,000" sub="Airtel · TNM · Visa" />
                <Detail label="Driver" value="Joseph M." sub="4.90 ★ · 312 trips" />
                <Detail label="Class" value="Economy" sub="14 seats · 4 free" />
              </div>
              <Button className="mt-6 w-full gap-2" onClick={handleCtaFindRide}>
                Reserve seat <MoveRight className="h-4 w-4" />
              </Button>
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
                          {trip.distanceKm} km
                        </span>
                        {trip.vehicle && (
                          <span className="flex items-center gap-1.5">
                            <Car className="h-3 w-3" />
                            {trip.vehicle.make} {trip.vehicle.model}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto flex items-end justify-between pt-4">
                        <div>
                          <div className="font-display text-xl font-semibold tabular">
                            {formatMwk(trip.farePerSeatMwk)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {trip.availableSeats}/{trip.totalSeats} seats
                          </div>
                        </div>
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-10 text-center sm:p-16">
            <div className="label-eyebrow text-primary">Get started</div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your next trip is one phone number away.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Sign up with your phone — we'll text a one-time code to verify your account.
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

function Detail({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className="mt-1 font-display text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}