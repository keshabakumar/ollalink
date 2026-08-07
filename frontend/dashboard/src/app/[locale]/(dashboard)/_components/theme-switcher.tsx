import { cn } from "@v1/ui/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["light", "dark", "system"] as const;
type Theme = (typeof ORDER)[number];

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeSwitcher({ triggerClass }: { triggerClass?: string }) {
  const { theme: currentTheme, setTheme } = useTheme();
  // Fix React #418: useTheme() returns undefined on the server but the resolved
  // theme on the client. Gate on mounted so both server and first client render
  // agree (show the System/monitor placeholder).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const theme = (mounted ? currentTheme : "system") as Theme;
  const Icon = ICONS[theme] ?? Monitor;

  const cycle = () => {
    const idx = ORDER.indexOf(theme as Theme);
    const next = ORDER[(idx + 1) % ORDER.length];
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Switch theme (current: ${LABELS[theme]})`}
      title={`Theme: ${LABELS[theme]} (click to change)`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-primary/60 hover:bg-primary/5 hover:text-primary",
        triggerClass,
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">{LABELS[theme]}</span>
    </button>
  );
}

export function ThemeSwitcherHome() {
  const { setTheme, themes } = useTheme();
  return (
    <div className="flex gap-3">
      {themes.map((theme) => (
        <button
          key={theme}
          name="theme"
          onClick={() => setTheme(theme)}
          type="button"
        >
          {theme === "light" ? (
            <Sun className="h-4 w-4 text-primary/80 hover:text-primary" />
          ) : theme === "dark" ? (
            <Moon className="h-4 w-4 text-primary/80 hover:text-primary" />
          ) : (
            <Monitor className="h-4 w-4 text-primary/80 hover:text-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
