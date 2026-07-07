import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Wallet, Calendar, Users, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const features = [
    { icon: Wallet, tKey: "drivers.payouts.title", dKey: "drivers.payouts.description" },
    { icon: Calendar, tKey: "drivers.schedule.title", dKey: "drivers.schedule.description" },
    { icon: Users, tKey: "drivers.passengers.title", dKey: "drivers.passengers.description" },
  ];
  const requirements = [
    "drivers.need.license",
    "drivers.need.vehicle",
    "drivers.need.phone",
    "drivers.need.record",
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageHeader
        eyebrow={t("drivers.eyebrow")}
        title={t("drivers.title")}
        description={t("drivers.description")}
        actions={
          <Button size="lg" onClick={() => openModal({ mode: "register", role: "driver" })}>
            {t("drivers.apply")}
          </Button>
        }
      />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.tKey} className="rounded-md border border-border bg-card p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <f.icon className="h-4 w-4" />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold">{t(f.tKey)}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{t(f.dKey)}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border bg-card p-8">
        <h2 className="font-display text-xl font-semibold">{t("drivers.needTitle")}</h2>
        <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {requirements.map((key) => (
            <li key={key}>· {t(key)}</li>
          ))}
        </ul>
        <Button
          className="mt-6 gap-2"
          onClick={() => openModal({ mode: "register", role: "driver" })}
        >
          {t("drivers.startApplication")} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
