"use client";

import { useEffect, useState } from "react";

// Same behavior as the approved wireframe: a needs-based override, kept
// separate from cosmetic theming, best-effort persisted so a sight-impaired
// visitor doesn't have to re-toggle every visit.
export function AccessibilityToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    // localStorage doesn't exist during SSR — this must run post-mount, not
    // as a lazy useState initializer, or it would crash the server render.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with a browser-only external API (localStorage) is exactly what effects are for; can't be a lazy initializer without breaking SSR.
      setOn(localStorage.getItem("gb_a11y") === "1");
    } catch {
      // ignore — storage may be blocked
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-a11y", on ? "on" : "off");
  }, [on]);

  return (
    <button
      className="a11y-toggle"
      onClick={() => {
        const next = !on;
        setOn(next);
        try {
          localStorage.setItem("gb_a11y", next ? "1" : "0");
        } catch {
          // ignore — storage may be blocked
        }
      }}
    >
      ◆ High contrast / large text
    </button>
  );
}
