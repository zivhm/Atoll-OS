import { cn } from "@/lib/utils";
import atollLockup from "@/assets/logo/atoll-lockup.svg";

interface AtollLogoProps {
  className?: string;
  size?: "header" | "compact";
}

export function AtollLogo({ className, size = "header" }: AtollLogoProps) {
  return (
    <img
      src={atollLockup}
      alt="atoll"
      className={cn(
        "w-auto object-contain",
        size === "compact" ? "h-5" : "h-6",
        className
      )}
    />
  );
}
