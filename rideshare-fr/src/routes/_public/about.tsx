import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

const aboutRouteImageUrl =
  (import.meta.env.VITE_LANDING_ROUTE_IMAGE_URL as string | undefined) ??
  "https://media.aircnc.co.ke/media-images/1ece3bde-c4a6-4428-8f4d-cab1a4f1d59b.webp";

export const Route = createFileRoute("/_public/about")({
  head: () => ({
    meta: [
      { title: "About - RideShare Malawi" },
      {
        name: "description",
        content:
          "We're building safer, faster intercity travel for Malawi by connecting drivers with spare seats to passengers who need them.",
      },
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
            alt="RideShare Malawi route map"
            className="h-auto w-full object-contain"
            loading="lazy"
          />
        </div>

        <div className="order-1 lg:order-2">
          <PageHeader eyebrow="About" title="Travel in Malawi, reimagined" />
          <div className="prose prose-invert mt-8 max-w-none text-muted-foreground">
            <p className="text-base leading-relaxed">
              RideShare Malawi was started by a small team in Lilongwe who were tired of long waits at
              the minibus stage, unclear fares, and journeys nobody could plan around. We believe people
              who are already driving across the country shouldn't roll with three empty seats - and
              people who need to get somewhere shouldn't have to gamble on departure times.
            </p>
            <p className="mt-4 text-base leading-relaxed">
              So we built a platform that does three things very well: verifies drivers, holds payments
              safely in escrow, and makes boarding tamper-proof with a one-time code. No middlemen, no
              surprises.
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
