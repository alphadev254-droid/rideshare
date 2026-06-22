import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Wallet, Calendar, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_public/drivers-info")({
  head: () => ({
    meta: [
      { title: "Drive with RideShare Malawi" },
      {
        name: "description",
        content:
          "Earn from your spare seats. Publish trips, accept passengers, and withdraw to mobile money.",
      },
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
        title="Fill your spare seats. Get paid."
        description="If you're already driving between cities, list your trip and we'll bring you verified passengers."
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
            d: "Every passenger pays upfront into escrow and verifies their phone.",
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
