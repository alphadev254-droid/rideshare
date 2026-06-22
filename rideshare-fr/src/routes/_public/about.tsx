import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_public/about")({
  head: () => ({
    meta: [
      { title: "About — RideShare Malawi" },
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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader eyebrow="About" title="Travel in Malawi, reimagined" />
      <div className="prose prose-invert mt-8 max-w-none text-muted-foreground">
        <p className="text-base leading-relaxed">
          RideShare Malawi was started by a small team in Lilongwe who were tired of long waits at
          the minibus stage, unclear fares, and journeys nobody could plan around. We believe people
          who are already driving across the country shouldn't roll with three empty seats — and
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
            <p className="mt-2 text-foreground">2024</p>
          </div>
        </div>
      </div>
    </div>
  );
}
