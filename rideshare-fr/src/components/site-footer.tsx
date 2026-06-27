import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sidebar">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-7 px-6 py-8 sm:grid-cols-4 sm:py-10">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground sm:text-sm">
            Shared rides between Malawi places. Drivers publish planned trips, passengers book
            available seats, and everyone shares the travel cost securely.
          </p>
        </div>

        <Section
          title="Product"
          links={[
            { to: "/safety", label: "Safety" },
            { to: "/app", label: "Find a ride" },
          ]}
        />
        <Section
          title="Drivers"
          links={[
            { to: "/drivers-info", label: "Drive with us" },
            { to: "/driver", label: "Driver dashboard" },
          ]}
        />
        <Section
          title="Company"
          links={[
            { to: "/about", label: "About" },
            { to: "/contact", label: "Contact" },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-row flex-wrap justify-between gap-x-4 gap-y-1 px-6 py-4 text-[11px] text-muted-foreground sm:text-xs">
          <span>© {new Date().getFullYear()} ChepetsaRide. All rights reserved.</span>
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
