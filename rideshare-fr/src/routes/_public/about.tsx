import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

const aboutRouteImageUrl =
  (import.meta.env.VITE_LANDING_ROUTE_IMAGE_URL as string | undefined) ??
  "https://media.aircnc.co.ke/media-images/1ece3bde-c4a6-4428-8f4d-cab1a4f1d59b.webp";

export const Route = createFileRoute("/_public/about")({
  head: () => ({
    meta: [
      { title: "About ChepetsaRide — How shared rides work" },
      { name: "description", content: "ChepetsaRide lets drivers going between Malawi places publish planned trips and open available seats to passengers. Everyone shares the travel cost. Verified drivers, mobile-money payments and boarding codes." },
      { name: "keywords", content: "about ChepetsaRide, how rideshare works Malawi, shared rides Malawi, cost sharing travel Malawi, driver passenger platform Malawi, intercity car travel Malawi, Lilongwe rideshare, safe shared travel Malawi" },
      { property: "og:title", content: "About ChepetsaRide — Shared rides, shared costs" },
      { property: "og:description", content: "Drivers publish planned trips, passengers book a seat and everyone shares the travel cost." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="order-2 overflow-hidden rounded-xl border border-border bg-card/80 shadow-sm lg:order-1">
          <img
            src={aboutRouteImageUrl}
            alt="ChepetsaRide route map"
            className="h-auto w-full object-contain"
            loading="lazy"
            decoding="async"
            width={1200}
            height={900}
          />
        </div>

        <div className="order-1 lg:order-2">
          <PageHeader eyebrow="About" title="Shared travel for planned trips between places" />
          <div className="prose prose-invert mt-8 max-w-none text-muted-foreground">
            <p className="text-base leading-relaxed">
              ChepetsaRide helps drivers who are already travelling between towns, cities and areas publish their
              planned trips and open available seats to passengers. Instead of travelling alone, drivers
              share the travel cost with people going the same way, while passengers get a clear route,
              price and departure time before they book.
            </p>
            <p className="mt-4 text-base leading-relaxed">
              The platform focuses on three things: verified drivers and vehicles, secure mobile-money
              payments held in escrow, and boarding codes that confirm the right passenger joins the
              right trip. The goal is simple: make shared travel across Malawi easier to plan and safer to use.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-8">
              <div>
                <div className="label-eyebrow">Headquarters</div>
                <p className="mt-2 text-foreground">Lilongwe, Malawi</p>
              </div>
              <div>
                <div className="label-eyebrow">Founded</div>
                <p className="mt-2 text-foreground">2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
