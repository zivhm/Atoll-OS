import { Link } from "react-router-dom";
import { AtollLogo } from "@/components/AtollLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  return (
    <nav className="fixed top-0 z-50 w-full h-16 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <AtollLogo />
          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#customization" className="transition-colors hover:text-foreground">Personalize</a>
            <a href="#integrations" className="transition-colors hover:text-foreground">Connect</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Dashboard
          </Link>
          <Link to="/dashboard">
            <Button className="rounded-full px-5 text-sm font-bold shadow-sm">
              Open Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
