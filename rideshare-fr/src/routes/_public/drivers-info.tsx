import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Wallet, Calendar, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_public/drivers-info")({
  head: () => ({
    meta: [
      { title: "Drive with ChepetsaRide - Earn from Planned Trips" },
      { name: "description", content: "Already driving between Malawi places? Publish your planned trip, let passengers book available seats and get paid to your Airtel Money or TNM Mpamba wallet." },
      { name: "keywords", content: "earn money driving Malawi, rideshare driver Malawi, intercity driver Malawi, make money from car Malawi, driver app Malawi, rideshare income Malawi, Airtel Money driver payout, TNM Mpamba driver, list trips Malawi, carry passengers Malawi" },
      { property: "og:title", content: "Drive with ChepetsaRide - Earn from Planned Trips" },
      { property: "og:description", content: "Publish planned trips, accept verified passengers and get paid to mobile money." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DriversInfo,
});

function DriversInfo() {
  const { openModal } = useAuthModal();
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageHeader
        eyebrow="For drivers"
        title="Share your planned trip. Get paid."
        description="If you are already driving between towns, cities, districts or other destinations, publish your route, set your seats and let passengers book in advance."
        actions={
          <Button size="lg" onClick={() => openModal({ mode: "register", role: "driver" })}>
            Apply to drive
          </Button>
        }
      />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Wallet,
            t: "Mobile-money payouts",
            d: "Withdraw your wallet balance to Airtel Money or TNM Mpamba anytime.",
          },
          {
            icon: Calendar,
            t: "You control the schedule",
            d: "Publish trips when and where you're already driving. No quotas.",
          },
          {
            icon: Users,
            t: "Verified passengers",
            d: "Passengers verify their phone and pay upfront before a booking is confirmed.",
          },
        ].map((f) => (
          <div key={f.t} className="rounded-md border border-border bg-card p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <f.icon className="h-4 w-4" />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold">{f.t}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border bg-card p-8">
        <h2 className="font-display text-xl font-semibold">What you need</h2>
        <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>· Valid Malawian driver's licence</li>
          <li>· Roadworthy vehicle with valid plates</li>
          <li>· Smartphone with mobile-money account</li>
          <li>· Clean criminal record</li>
        </ul>
        <Button
          className="mt-6 gap-2"
          onClick={() => openModal({ mode: "register", role: "driver" })}
        >
          Start application <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
