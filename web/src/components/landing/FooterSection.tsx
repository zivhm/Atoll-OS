import { Link } from "react-router-dom";

import { AtollLogo } from "@/components/AtollLogo";

type FooterLinkGroup = Record<string, { label: string; href: string }[]>;

const footerLinks: FooterLinkGroup = {
  Product: [
    { label: "Overview", href: "#top" },
    { label: "Features", href: "#features" },
    { label: "Personalize", href: "#customization" },
    { label: "Pricing", href: "#pricing" },
  ],
  Explore: [
    { label: "Connect", href: "#integrations" },
    { label: "Questions", href: "#faq" },
    { label: "Open Dashboard", href: "/dashboard" },
  ],
  "Open Source": [
    { label: "Contributing", href: "https://github.com/zivhm/Atoll-OS/blob/main/CONTRIBUTING.md" },
    { label: "License", href: "https://github.com/zivhm/Atoll-OS/blob/main/LICENSE" },
    { label: "Repository", href: "https://github.com/zivhm/Atoll-OS" },
    { label: "Dashboard", href: "/dashboard" },
  ],
};

export function FooterSection() {
  return (
    <footer className="px-6 py-20 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
          <div className="col-span-2">
            <AtollLogo className="mb-8" />
            <p className="text-muted-foreground max-w-xs leading-relaxed">
              Open-source alpha for running helper operations with explicit runtime controls and operator-first workflows.
            </p>
          </div>
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-black text-[11px] uppercase tracking-[0.3em] mb-8">{category}</h4>
              <ul className="space-y-5 text-sm font-medium text-muted-foreground">
                {links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-12 border-t border-border flex flex-col md:flex-row justify-between gap-6 text-sm font-medium text-muted-foreground">
          <p>© 2026 Atoll contributors.</p>
          <p>Open-source, self-hosted by default.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  const className = "transition-colors hover:text-primary";

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}
