import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ShieldCheck, KeyRound, MapPin, Phone, BadgeCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/_public/safety")({
  head: () => ({
    meta: [
      { title: "Safety — How ChepetsaRide Protects Every Trip" },
      { name: "description", content: "Every ChepetsaRide trip uses verified drivers, mobile-money escrow, one-time boarding codes and live GPS. A safer way to travel between Malawi places." },
      { name: "keywords", content: "safe rideshare Malawi, verified drivers Malawi, escrow payment rideshare Malawi, boarding code shared ride Malawi, GPS tracking rideshare Malawi, trusted shared rides Malawi, safe intercity travel Malawi, driver passenger safety Malawi" },
      { property: "og:title", content: "Safety — How ChepetsaRide Protects Every Trip" },
      { property: "og:description", content: "Verified drivers, GPS tracking, mobile-money escrow and boarding codes - built for safer shared trips." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Safety,
});

const features = [
  {
    icon: BadgeCheck,
    t: "Verified drivers",
    d: "Every driver submits licence and vehicle documents. Approved drivers and approved vehicles are required before they can publish trips.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: KeyRound,
    t: "Boarding code",
    d: "A unique 6-character code is SMSed to passengers after payment — only valid for that trip.",
    color: "bg-info/10 text-info",
  },
  {
    icon: MapPin,
    t: "Live GPS",
    d: "Trips in transit broadcast live GPS to the operations dashboard.",
    color: "bg-info/10 text-info",
  },
  {
    icon: Wallet,
    t: "Escrow payments",
    d: "Drivers are paid after the trip completes — never before you board.",
    color: "bg-gold/10 text-gold",
  },
  {
    icon: Phone,
    t: "Emergency contact",
    d: "Add a trusted contact so support can reach the right person if there is an incident.",
    color: "bg-destructive/10 text-destructive",
  },
  {
    icon: ShieldCheck,
    t: "Two-way ratings",
    d: "Passengers rate drivers and vice-versa, with low-rated accounts reviewed.",
    color: "bg-violet/10 text-violet",
  },
];

function Safety() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageHeader
        eyebrow="Trust & safety"
        title="Built so every seat is a safe seat"
        description="Safety is built into every booking, payment and shared trip."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="rounded-md border border-border bg-card p-5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-md ${f.color}`}>
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
