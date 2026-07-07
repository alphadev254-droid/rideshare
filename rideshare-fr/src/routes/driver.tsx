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
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/driver")({
  component: DriverShell,
});

function DriverShell() {
  const { t } = useI18n();
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
        {t("driverStatus.verified")}
      </div>
    );
  } else if (hasProfile && !isApproved && profile?.reviewRequestedAt) {
    badge = (
      <div className="flex items-center gap-1.5 rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
        <ShieldAlert className="h-3 w-3" />
        {t("driverStatus.waitingApproval")}
      </div>
    );
  } else if (hasProfile && !isApproved) {
    badge = (
      <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <ShieldAlert className="h-3 w-3" />
        {t("driverStatus.setupProgress")}
      </div>
    );
  }

  return (
    <DashboardLayout
      role="driver"
      items={[
        { to: "/driver", label: t("driverNav.dashboard"), icon: LayoutDashboard, exact: true },
        { to: "/driver/trips", label: t("driverNav.trips"), icon: RouteIcon },
        { to: "/driver/vehicles", label: t("driverNav.vehicles"), icon: Car },
        { to: "/driver/transactions", label: t("driverNav.transactions"), icon: CreditCard },
        { to: "/driver/wallet", label: t("driverNav.wallet"), icon: Wallet },
        { to: "/driver/onboarding", label: t("driverNav.onboarding"), icon: UserIcon },
        { to: "/driver/profile", label: t("driverNav.profile"), icon: UserIcon },
      ]}
      sidebarExtra={badge}
    />
  );
}
