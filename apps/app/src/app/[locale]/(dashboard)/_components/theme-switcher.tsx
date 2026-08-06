import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@v1/ui/select";
import { cn } from "@v1/ui/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher({ triggerClass }: { triggerClass?: string }) {
  const { theme: currentTheme, setTheme, themes } = useTheme();
  // Fix React #418: useTheme() returns undefined on the server but the resolved
  // theme on the client, so the icon/label mismatch. Gate on mounted so both
  // server and first client render agree (show the System/monitor placeholder).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const theme = mounted ? currentTheme : undefined;
  return (
    <Select
      value={theme}
      onValueChange={(t) => setTheme(t as (typeof themes)[number])}
    >
      <SelectTrigger
        className={cn(
          "h-6 rounded border-primary/20 bg-secondary !px-2 hover:border-primary/40",
          triggerClass,
        )}
      >
        <div className="flex items-start gap-2">
          {theme === "light" ? (
            <Sun className="h-[14px] w-[14px]" />
          ) : theme === "dark" ? (
            <Moon className="h-[14px] w-[14px]" />
          ) : (
            <Monitor className="h-[14px] w-[14px]" />
          )}
          {theme && (
            <span className="text-xs font-medium">
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </span>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {themes.map((t) => (
          <SelectItem
            key={t}
            value={t}
            className={`text-sm font-medium text-primary/60 ${t === theme && "text-primary"}`}
          >
            {t && t.charAt(0).toUpperCase() + t.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
