import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ComponentType, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { LogOut, Loader2, Menu, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface DashboardLayoutProps {
  role: "passenger" | "driver" | "admin";
  items: NavItem[];
  children?: ReactNode;
  sidebarExtra?: ReactNode;
}

export function DashboardLayout({ role, items, sidebarExtra }: DashboardLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const { openModal } = useAuthModal();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const modalRole: "passenger" | "driver" = role === "driver" ? "driver" : "passenger";

  useEffect(() => {
    if (isLoading) return;
    if (!user) openModal({ mode: "login", role: modalRole });
  }, [isLoading, user, openModal, modalRole]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm rounded-md border border-border bg-card p-8 text-center">
          <UserIcon className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-3 font-display text-lg font-semibold">Sign in to continue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You need an account to access this dashboard.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={() => openModal({ mode: "login", role: modalRole })}
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        items={items}
        role={role}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sidebarExtra={sidebarExtra}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="ring-focus rounded p-2 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="lg:hidden">
            <Logo />
          </Link>
          <div className="hidden lg:flex lg:items-center lg:gap-3">
            <span className="label-eyebrow">
              {role === "driver"
                ? "Driver console"
                : role === "admin"
                  ? "Admin console"
                  : "Passenger app"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{user.fullName}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{user.phone}</div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
              {user.fullName
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <button
              onClick={async () => {
                await logout();
                navigate({ to: "/" });
              }}
              className="ring-focus rounded p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  items,
  role,
  mobileOpen,
  onClose,
  sidebarExtra,
}: {
  items: NavItem[];
  role: "passenger" | "driver" | "admin";
  mobileOpen: boolean;
  onClose: () => void;
  sidebarExtra?: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (item: NavItem) =>
    item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-sidebar transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="border-b border-sidebar-border px-5 py-4">
          <div className="label-eyebrow">Mode</div>
          <div className="mt-1 font-display text-sm font-semibold capitalize">{role}</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "ring-focus flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {sidebarExtra && (
          <div className="border-t border-sidebar-border px-4 py-3">{sidebarExtra}</div>
        )}
        <div className="border-t border-sidebar-border p-4">
          <Link
            to="/"
            className="block rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-surface-2"
          >
            ← Back to homepage
          </Link>
        </div>
      </aside>
    </>
  );
}
