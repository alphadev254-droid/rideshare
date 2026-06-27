import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { AuthModalProvider } from "@/lib/auth-modal-context";
import { AuthModal } from "@/components/auth-modal";

import appCss from "../styles.css?url";

const siteOgImageUrl =
  (import.meta.env.VITE_SITE_OG_IMAGE_URL as string | undefined) ??
  (import.meta.env.VITE_LANDING_HERO_IMAGE_URL as string | undefined) ??
  "https://media.aircnc.co.ke/media-images/eef78f3e-8d81-4b17-956a-40ec0c71b708.webp";

const siteLogoImageUrl =
  (import.meta.env.VITE_SITE_LOGO_IMAGE_URL as string | undefined) ?? siteOgImageUrl;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="label-eyebrow">Error 404</div>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The route you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-strong"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="label-eyebrow text-destructive">Unexpected error</div>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-strong"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-medium hover:bg-surface-2"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ChepetsaRide - Book seats on shared trips across Malawi" },
      {
        name: "description",
        content:
          "Drivers publish planned trips between Malawi places, passengers book available seats and share the travel cost. Verified drivers, mobile-money payments and boarding codes.",
      },
      { name: "author", content: "ChepetsaRide" },
      { property: "og:title", content: "ChepetsaRide - Book seats on shared trips across Malawi" },
      {
        property: "og:description",
        content: "Drivers going your way publish planned trips. You book a seat and split the travel cost across Malawi.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: siteOgImageUrl },
      { property: "og:logo", content: siteLogoImageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: siteOgImageUrl },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthModalProvider>
          <Outlet />
          <AuthModal />
          <Toaster />
        </AuthModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
