import atollLockup from "@/assets/logo/atoll-lockup.svg";

export function AtollLogo({ className = "" }: { className?: string }) {
  return <img src={atollLockup} alt="Atoll" className={`h-6 w-auto object-contain ${className}`.trim()} />;
}
