import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getSessionProfile, type SessionProfile } from "@/lib/api";

interface AuthContextType {
  session: SessionProfile | null;
  loading: boolean;
  error: string;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  error: "",
  isAuthenticated: false,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const nextSession = await getSessionProfile();
      setSession(nextSession);
    } catch (nextError) {
      setSession(null);
      setError(nextError instanceof Error ? nextError.message : "Could not load local auth session");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    window.location.reload();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        isAuthenticated: Boolean(session),
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
