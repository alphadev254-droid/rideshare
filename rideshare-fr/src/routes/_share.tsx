import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Shared layout for shareable public trip/driver pages.
// Unlike _public, this does NOT redirect authenticated users away —
// both guests and logged-in passengers can view and book from these pages.
export const Route = createFileRoute("/_share")({
  component: ShareLayout,
});

function ShareLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
