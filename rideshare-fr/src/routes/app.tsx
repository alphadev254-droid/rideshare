import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Search, Ticket, User as UserIcon } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

export const Route = createFileRoute("/app")({
  component: PassengerShell,
});

function PassengerShell() {
  return (
    <DashboardLayout
      role="passenger"
      items={[
        { to: "/app", label: "Find a ride", icon: Search, exact: true },
        { to: "/app/bookings", label: "My bookings", icon: Ticket },
        { to: "/app/transactions", label: "Transactions", icon: CreditCard },
        { to: "/app/profile", label: "Profile", icon: UserIcon },
      ]}
    />
  );
}
