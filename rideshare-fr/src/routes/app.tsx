import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Search, Ticket, User as UserIcon } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app")({
  component: PassengerShell,
});

function PassengerShell() {
  const { t } = useI18n();
  return (
    <DashboardLayout
      role="passenger"
      items={[
        { to: "/app", label: t("passengerNav.findRide"), icon: Search, exact: true },
        { to: "/app/bookings", label: t("passengerNav.bookings"), icon: Ticket },
        { to: "/app/transactions", label: t("passengerNav.transactions"), icon: CreditCard },
        { to: "/app/profile", label: t("passengerNav.profile"), icon: UserIcon },
      ]}
    />
  );
}
