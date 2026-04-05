import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
});

const DARK_VARS = `
  :root {
    --background: 0 0% 6% !important;
    --foreground: 0 0% 96% !important;
    --card: 0 0% 10% !important;
    --card-foreground: 0 0% 96% !important;
    --popover: 0 0% 10% !important;
    --popover-foreground: 0 0% 96% !important;
    --secondary: 0 0% 14% !important;
    --secondary-foreground: 0 0% 90% !important;
    --muted: 0 0% 14% !important;
    --muted-foreground: 0 0% 65% !important;
    --destructive: 0 62% 50% !important;
    --destructive-foreground: 0 0% 100% !important;
    --border: 0 0% 15% !important;
    --input: 0 0% 15% !important;
    --sidebar-background: 0 0% 5% !important;
    --sidebar-foreground: 0 0% 90% !important;
    --sidebar-accent: 0 0% 12% !important;
    --sidebar-accent-foreground: 0 0% 90% !important;
    --sidebar-border: 0 0% 12% !important;
    color-scheme: dark;
  }
`;

const STYLE_ID = "atoll-theme-override";

function applyDarkStyles(isDark: boolean) {
  let el = document.getElementById(STYLE_ID);
  if (isDark) {
    document.documentElement.classList.add("dark");
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = DARK_VARS;
  } else {
    document.documentElement.classList.remove("dark");
    el?.remove();
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("atoll-theme") as Theme;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("atoll-theme", newTheme);
    applyDarkStyles(newTheme === "dark");
  };

  useEffect(() => {
    applyDarkStyles(theme === "dark");
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
