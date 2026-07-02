import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa-install-context";

const DISMISS_KEY = "chepetsaride_install_prompt_dismissed";

export function PwaInstallBanner() {
  const { canInstall, isInstalled, isIosInstall, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (isInstalled || dismissed || (!canInstall && !isIosInstall)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md rounded-md border border-border bg-card p-3 shadow-xl sm:bottom-4">
      <div className="flex gap-3">
        <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Install ChepetsaRide</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add the app to your phone for faster access to trips and bookings.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void promptInstall()}>
              <Download className="h-3.5 w-3.5" />
              {canInstall ? "Install app" : "Add to Home Screen"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                window.sessionStorage.setItem(DISMISS_KEY, "1");
                setDismissed(true);
              }}
            >
              Later
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="ring-focus h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          aria-label="Dismiss install prompt"
          onClick={() => {
            window.sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
        >
          <X className="mx-auto h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PwaInstallButton({
  variant = "outline",
  size = "lg",
  className,
  showWhenUnavailable = false,
}: {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "lg";
  className?: string;
  showWhenUnavailable?: boolean;
}) {
  const { canInstall, isInstalled, isIosInstall, promptInstall } = usePwaInstall();

  if (isInstalled || (!showWhenUnavailable && !canInstall && !isIosInstall)) return null;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => void promptInstall()}
    >
      <Download className="h-4 w-4" />
      Install app
    </Button>
  );
}

export function PwaInstallSidebarAction() {
  const { canInstall, isInstalled, isIosInstall } = usePwaInstall();

  if (isInstalled || (!canInstall && !isIosInstall)) return null;

  return (
    <div className="border-t border-sidebar-border px-4 py-3">
      <PwaInstallButton variant="outline" size="sm" className="w-full justify-start gap-2" />
    </div>
  );
}
