import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/85 p-6 shadow-sm backdrop-blur">
          <h1 className="text-lg font-semibold tracking-tight">Local auth session unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Atoll OS could not load the local auth profile. Check local credentials and retry.
          </p>
          {error ? (
            <pre className="mt-4 overflow-auto rounded-2xl border border-border/60 bg-muted/40 p-3 text-xs leading-5">
              {error}
            </pre>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => {
                window.location.reload();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
