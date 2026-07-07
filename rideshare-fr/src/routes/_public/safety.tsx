import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ShieldCheck, KeyRound, MapPin, Phone, BadgeCheck, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_public/safety")({
  head: () => ({
    meta: [
      { title: "Safety - How ChepetsaRide Protects Every Trip" },
      { name: "description", content: "Every ChepetsaRide trip uses verified drivers, mobile-money escrow, one-time boarding codes and live GPS. A safer way to travel between Malawi places." },
      { name: "keywords", content: "safe rideshare Malawi, verified drivers Malawi, escrow payment rideshare Malawi, boarding code shared ride Malawi, GPS tracking rideshare Malawi, trusted shared rides Malawi, safe intercity travel Malawi, driver passenger safety Malawi" },
      { property: "og:title", content: "Safety - How ChepetsaRide Protects Every Trip" },
      { property: "og:description", content: "Verified drivers, GPS tracking, mobile-money escrow and boarding codes - built for safer shared trips." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Safety,
});

const features = [
  { icon: BadgeCheck, tKey: "safety.verified.title", dKey: "safety.verified.description", color: "bg-primary/10 text-primary" },
  { icon: KeyRound, tKey: "safety.code.title", dKey: "safety.code.description", color: "bg-info/10 text-info" },
  { icon: MapPin, tKey: "safety.gps.title", dKey: "safety.gps.description", color: "bg-info/10 text-info" },
  { icon: Wallet, tKey: "safety.escrow.title", dKey: "safety.escrow.description", color: "bg-gold/10 text-gold" },
  { icon: Phone, tKey: "safety.emergency.title", dKey: "safety.emergency.description", color: "bg-destructive/10 text-destructive" },
  { icon: ShieldCheck, tKey: "safety.ratings.title", dKey: "safety.ratings.description", color: "bg-violet/10 text-violet" },
];

function Safety() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageHeader
        eyebrow={t("safety.eyebrow")}
        title={t("safety.title")}
        description={t("safety.description")}
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.tKey} className="rounded-md border border-border bg-card p-5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-md ${f.color}`}>
              <f.icon className="h-4 w-4" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold">{t(f.tKey)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(f.dKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
