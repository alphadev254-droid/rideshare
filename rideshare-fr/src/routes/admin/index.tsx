import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { LoadingState } from "@/components/loading-state";
import { Users, Car, Route as RouteIcon, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const drivers = useQuery({
    queryKey: ["admin", "drivers", { limit: 100 }],
    queryFn: () => adminService.listDrivers({ limit: 100 }),
  });
  const trips = useQuery({
    queryKey: ["admin", "trips", { limit: 100 }],
    queryFn: () => adminService.listTrips({ limit: 100 }),
  });

  const driverList = drivers.data ?? [];
  const tripList = trips.data ?? [];
  const approved = driverList.filter((d) => d.isApproved).length;
  const pendingApproval = driverList.filter((d) => !d.isApproved && d.reviewRequestedAt).length;
  const activeTrips = tripList.filter(
    (t) => t.status === "in_transit" || t.status === "boarding",
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin console"
        title="Platform overview"
        description="Operational health of RideShare Malawi at a glance."
      />

      {drivers.isLoading || trips.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Drivers"
            value={driverList.length}
            hint={`${approved} approved`}
            icon={<Car className="h-4 w-4" />}
            accent="primary"
          />
          <StatCard
            label="Pending approval"
            value={pendingApproval}
            hint="Awaiting review"
            icon={<ShieldCheck className="h-4 w-4" />}
            accent="gold"
          />
          <StatCard
            label="Trips"
            value={tripList.length}
            icon={<RouteIcon className="h-4 w-4" />}
          />
          <StatCard
            label="Active now"
            value={activeTrips}
            hint="Boarding or in transit"
            icon={<Users className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <QuickLink
          to="/admin/drivers"
          title="Driver approvals"
          desc="Review licences and approve new drivers."
        />
        <QuickLink to="/admin/users" title="Manage users" desc="Activate or deactivate accounts." />
        <QuickLink
          to="/admin/trips"
          title="All trips"
          desc="Inspect every published trip on the platform."
        />
        <QuickLink
          to="/admin/payments"
          title="Payments"
          desc="Issue refunds for disputed bookings."
        />
      </div>
    </div>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-md border border-border bg-card p-5 transition-colors hover:border-border-strong"
    >
      <div>
        <div className="font-display text-base font-semibold">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
