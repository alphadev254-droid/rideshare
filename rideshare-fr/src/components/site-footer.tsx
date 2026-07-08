import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border bg-sidebar">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-7 px-6 py-8 sm:grid-cols-4 sm:py-10">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground sm:text-sm">
            {t("footer.summary")}
          </p>
        </div>

        <Section
          title={t("footer.product")}
          links={[
            { to: "/safety", label: t("nav.safety") },
            { to: "/app", label: t("footer.findRide") },
          ]}
        />
        <Section
          title={t("footer.drivers")}
          links={[
            { to: "/drivers-info", label: t("footer.driveWithUs") },
            { to: "/driver", label: t("footer.driverDashboard") },
          ]}
        />
        <Section
          title={t("footer.company")}
          links={[
            { to: "/about", label: t("nav.about") },
            { to: "/contact", label: t("nav.contact") },
            { to: "/terms", label: t("footer.terms") },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-row flex-wrap justify-between gap-x-4 gap-y-1 px-6 py-4 text-[11px] text-muted-foreground sm:text-xs">
          <span>© {new Date().getFullYear()} ChepetsaRide. {t("footer.rights")}</span>
          <span className="font-mono">v1.0 · Lilongwe · Blantyre · Mzuzu · Zomba</span>
        </div>
      </div>
    </footer>
  );
}

function Section({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="label-eyebrow mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
