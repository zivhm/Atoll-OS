import { ATOLL_GITHUB_URL } from "@/constants";

import { AtollLogo } from "@/components/AtollLogo";

const footerGroups = {
  Product: [
    { label: "Overview", href: "#top" },
    { label: "Features", href: "#features" },
    { label: "Personalize", href: "#customization" },
    { label: "Questions", href: "#faq" },
  ],
  Explore: [
    { label: "Repository", href: ATOLL_GITHUB_URL },
    { label: "README", href: `${ATOLL_GITHUB_URL}#readme` },
    { label: "Issues", href: `${ATOLL_GITHUB_URL}/issues` },
  ],
  "Open Source": [
    { label: "Contributing", href: `${ATOLL_GITHUB_URL}/blob/main/CONTRIBUTING.md` },
    { label: "License", href: `${ATOLL_GITHUB_URL}/blob/main/LICENSE` },
    { label: "Discussions", href: `${ATOLL_GITHUB_URL}/discussions` },
  ],
} as const;

export function FooterSection() {
  return (
    <footer className="border-t border-border px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2">
            <div className="mb-8 flex items-center gap-3">
              <AtollLogo />
              <span className="text-lg font-semibold tracking-tight text-foreground">Atoll</span>
            </div>
            <p className="max-w-xs leading-relaxed text-muted-foreground">
              Open-source alpha for running helper operations with explicit runtime controls and operator-first workflows.
            </p>
          </div>
          {Object.entries(footerGroups).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-8 text-[11px] font-black uppercase tracking-[0.3em]">{category}</h4>
              <ul className="space-y-5 text-sm font-medium text-muted-foreground">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="transition-colors hover:text-primary"
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-6 border-t border-border pt-12 text-sm font-medium text-muted-foreground md:flex-row">
          <p>© 2026 Atoll contributors.</p>
          <p>Open-source, self-hosted by default.</p>
        </div>
      </div>
    </footer>
  );
}
