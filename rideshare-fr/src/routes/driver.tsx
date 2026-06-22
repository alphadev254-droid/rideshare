import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Route as RouteIcon,
  Car,
  Wallet,
  CreditCard,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { driverService, isDriverNotOnboardedError } from "@/lib/api";

export const Route = createFileRoute("/driver")({
  component: DriverShell,
});

function DriverShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["driver", "profile"],
    queryFn: () => driverService.profile(),
    retry: false,
    meta: { silent: true },
  });

  const hasProfile = !!profile && !error;
  const isApproved = profile?.isApproved ?? false;
  const isOnboardingRoute = location.pathname === "/driver/onboarding";

  useEffect(() => {
    if (isOnboardingRoute || isLoading) return;

    if (isDriverNotOnboardedError(error) || (hasProfile && !isApproved)) {
      navigate({ to: "/driver/onboarding", replace: true });
    }
  }, [error, hasProfile, isApproved, isLoading, isOnboardingRoute, navigate]);

  let badge = null;
  if (isLoading) {
    badge = (
      <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  } else if (hasProfile && isApproved) {
    badge = (
      <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </div>
    );
  } else if (hasProfile && !isApproved && profile?.reviewRequestedAt) {
    badge = (
      <div className="flex items-center gap-1.5 rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
        <ShieldAlert className="h-3 w-3" />
        Waiting approval
      </div>
    );
  } else if (hasProfile && !isApproved) {
    badge = (
      <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <ShieldAlert className="h-3 w-3" />
        Setup in progress
      </div>
    );
  }

  return (
    <DashboardLayout
      role="driver"
      items={[
        { to: "/driver", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { to: "/driver/trips", label: "My trips", icon: RouteIcon },
        { to: "/driver/vehicles", label: "Vehicles", icon: Car },
        { to: "/driver/transactions", label: "Transactions", icon: CreditCard },
        { to: "/driver/wallet", label: "Wallet", icon: Wallet },
        { to: "/driver/onboarding", label: "Onboarding", icon: UserIcon },
        { to: "/driver/profile", label: "Profile", icon: UserIcon },
      ]}
      sidebarExtra={badge}
    />
  );
}
