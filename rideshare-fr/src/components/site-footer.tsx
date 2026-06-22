import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sidebar">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Shared rides between Malawi's cities. Vetted drivers, mobile-money escrow, boarding
            codes — safer than the bus, simpler than driving.
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
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} RideShare Malawi. All rights reserved.</span>
          <span className="font-mono">v1.0 · Lilongwe · Blantyre · Mzuzu · Zomba</span>
        </div>
      </div>
    </footer>
  );
}

function Section({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="label-eyebrow mb-3">{title}</h3>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
