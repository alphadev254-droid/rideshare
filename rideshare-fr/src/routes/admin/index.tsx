import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { LoadingState } from "@/components/loading-state";
import { Users, Car, Route as RouteIcon, ShieldCheck, ArrowRight, CreditCard, UserCheck } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminService.stats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin console"
        title="Platform overview"
        description="Operational health of ChepetsaRide at a glance."
      />

      {isLoading ? (
        <LoadingState />
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total users"
              value={stats.totalUsers}
              icon={<Users className="h-4 w-4" />}
              accent="primary"
            />
            <StatCard
              label="Drivers"
              value={stats.totalDrivers}
              hint={`${stats.approvedDrivers} approved`}
              icon={<Car className="h-4 w-4" />}
              accent="violet"
            />
            <StatCard
              label="Pending review"
              value={stats.pendingReview}
              hint="Awaiting approval"
              icon={<ShieldCheck className="h-4 w-4" />}
              accent="gold"
            />
            <StatCard
              label="Active now"
              value={stats.activeTrips}
              hint="Boarding or in transit"
              icon={<UserCheck className="h-4 w-4" />}
              accent="info"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
            <StatCard
              label="Total trips"
              value={stats.totalTrips}
              icon={<RouteIcon className="h-4 w-4" />}
            />
            <StatCard
              label="Completed payments"
              value={stats.totalPayments}
              hint="Released to drivers"
              icon={<CreditCard className="h-4 w-4" />}
              accent="primary"
            />
          </div>
        </>
      ) : null}

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
