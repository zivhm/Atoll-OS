import { AtollLogo } from "@/components/AtollLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ATOLL_GITHUB_URL } from "@/components/landing/constants";

export function LandingNav() {
  return (
    <nav className="fixed top-0 z-50 w-full h-16 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <a href="#top" className="flex items-center gap-3">
            <AtollLogo />
            <span className="text-base font-semibold tracking-tight text-foreground">Atoll</span>
          </a>
          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#customization" className="transition-colors hover:text-foreground">Personalize</a>
            <a href="#faq" className="transition-colors hover:text-foreground">Questions</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <a href={ATOLL_GITHUB_URL} target="_blank" rel="noreferrer">
            <Button className="rounded-full px-5 text-sm font-bold shadow-sm">
              GitHub
            </Button>
          </a>
        </div>
      </div>
    </nav>
  );
}
