"use client";

import { useEffect, useState } from "react";

const THEMES = ["parchment", "arcade", "seafoam", "mono"] as const;
type Theme = (typeof THEMES)[number];

const COOKIE_NAME = "gb_theme";
const COOKIE_MAX_AGE_DAYS = 365;

function setCookie(name: string, value: string, days: number) {
  try {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {
    // ignore — cookies may be blocked
  }
}

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

// Cosmetic, cookie-backed, works whether or not the visitor is signed in —
// independent of the accessibility toggle, which is a needs-based override
// and always wins regardless of which theme is picked (see globals.css).
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("parchment");

  useEffect(() => {
    const saved = getCookie(COOKIE_NAME);
    if (saved && (THEMES as readonly string[]).includes(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with a browser-only external API (cookies) is exactly what effects are for; can't be a lazy initializer without breaking SSR.
      setTheme(saved as Theme);
    }
  }, []);

  useEffect(() => {
    if (theme === "parchment") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    setCookie(COOKIE_NAME, next, COOKIE_MAX_AGE_DAYS);
  }

  return (
    <div className="theme-picker">
      <span className="theme-label">Theme:</span>
      {THEMES.map((t) => (
        <button
          key={t}
          className={`swatch${theme === t ? " active" : ""}`}
          data-swatch={t}
          title={t}
          onClick={() => choose(t)}
        />
      ))}
    </div>
  );
}
