import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, User as UserIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home" },
  { to: "/trips", label: "Trips" },
  { to: "/safety", label: "Safety" },
  { to: "/drivers-info", label: "For drivers" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

function dashboardPath(role: string) {
  return role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/app";
}

function profilePath(role: string) {
  return role === "driver" ? "/driver/profile" : "/app/profile";
}

export function SiteHeader() {
  const { openModal } = useAuthModal();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setOpen(false), [path]);

  async function handleLogout() {
    await logout();
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="ring-focus rounded">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              activeProps={{ className: "text-foreground bg-surface-2" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <UserIcon className="h-3.5 w-3.5" />
                  {user.fullName.split(" ")[0]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email ?? user.phone}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={dashboardPath(user.role)} className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={profilePath(user.role)} className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" /> My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => openModal({ mode: "login" })}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => openModal({ mode: "register" })}>
                Get started
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="ring-focus rounded p-2 lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border bg-background lg:hidden",
          open ? "max-h-125" : "max-h-0",
        )}
      >
        <div className="space-y-1 px-6 py-4">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="block rounded px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {user ? (
              <>
                <div className="px-1 pb-1">
                  <p className="truncate text-sm font-medium">{user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email ?? user.phone}
                  </p>
                </div>
                <Link to={dashboardPath(user.role)}>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Button>
                </Link>
                <Link to={profilePath(user.role)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <UserIcon className="h-4 w-4" /> My profile
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => openModal({ mode: "login" })}>
                  Sign in
                </Button>
                <Button onClick={() => openModal({ mode: "register" })}>Get started</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

