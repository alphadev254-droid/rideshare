import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ShieldCheck, KeyRound, MapPin, Phone, BadgeCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/_public/safety")({
  head: () => ({
    meta: [
      { title: "Safety — RideShare Malawi" },
      {
        name: "description",
        content:
          "Vetted drivers, GPS tracking, mobile-money escrow and boarding codes — built to keep every trip safe.",
      },
    ],
  }),
  component: Safety,
});

const features = [
  {
    icon: BadgeCheck,
    t: "Verified drivers",
    d: "Every driver submits licence and vehicle docs and is manually approved by our ops team.",
  },
  {
    icon: KeyRound,
    t: "Boarding code",
    d: "A unique 6-character code is SMSed to passengers after payment — only valid for that trip.",
  },
  {
    icon: MapPin,
    t: "Live GPS",
    d: "Trips in transit broadcast live GPS to the operations dashboard.",
  },
  {
    icon: Wallet,
    t: "Escrow payments",
    d: "Drivers are paid after the trip completes — never before you board.",
  },
  {
    icon: Phone,
    t: "Emergency contact",
    d: "Add a trusted contact to your profile, shown to ops on any incident.",
  },
  {
    icon: ShieldCheck,
    t: "Two-way ratings",
    d: "Passengers rate drivers and vice-versa, with low-rated accounts reviewed.",
  },
];

function Safety() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageHeader
        eyebrow="Trust & safety"
        title="Built so every seat is a safe seat"
        description="Safety is not a slogan — it's wired into every booking, payment and trip."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="rounded-md border border-border bg-card p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <f.icon className="h-4 w-4" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
