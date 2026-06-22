import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Car, Route as RouteIcon, CreditCard, Ticket } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin")({
  component: AdminShell,
});

function AdminShell() {
  const { user, isLoading } = useAuth();

  // Only admins may access — others get redirected to their own dashboard.
  if (!isLoading && user && user.role !== "admin") {
    return <Navigate to={user.role === "driver" ? "/driver" : "/app"} />;
  }

  return (
    <DashboardLayout
      role="admin"
      items={[
        { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
        { to: "/admin/users", label: "Users", icon: Users },
        { to: "/admin/drivers", label: "Drivers", icon: Car },
        { to: "/admin/trips", label: "Trips", icon: RouteIcon },
        { to: "/admin/bookings", label: "Bookings", icon: Ticket },
        { to: "/admin/payments", label: "Payments", icon: CreditCard },
      ]}
    />
  );
}
