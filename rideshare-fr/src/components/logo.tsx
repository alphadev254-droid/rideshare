import { cn } from "@/lib/utils";

const logoImageUrl =
  (import.meta.env.VITE_SITE_LOGO_IMAGE_URL as string | undefined) ?? "/logo.png";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logoImageUrl}
        alt="ChepetsaRide"
        className="h-12 w-auto max-w-[210px] object-contain sm:h-14 sm:max-w-[240px]"
        loading="eager"
      />
    </div>
  );
}
