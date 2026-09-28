"use client";

import { useRef, useState } from "react";
import { BggAttribution } from "@/components/BggAttribution";
import type { BggSearchResult } from "@/lib/bgg";
import { BGG_SEARCH_AVAILABLE } from "@/lib/constants";

export type GameChoice = { bggId: string | null; title: string };

// Shared BGG type-ahead: used by both the buyer request form and the
// admin's add-game form, so the "favor BGG search, freeform is an explicit
// fallback" behavior only needs to be right once (and stays consistent
// between the two). onChoose fires only on a deliberate action — clicking
// a real match, or clicking "use this title anyway" — never on a bare
// keystroke, so an unconfirmed search-in-progress can never silently
// become the resolved game (the bug that motivated building this).
export function GameSearchField({
  onChoose,
  placeholder = "Start typing a title…",
}: {
  onChoose: (choice: GameChoice) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BggSearchResult[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  // Typing fast fires a fetch per keystroke, and responses can arrive out
  // of order over the network — without this, a slower response for an
  // earlier, shorter query could land after the response for what's
  // actually typed now and silently overwrite it with stale results
  // (reported live: results appeared "stuck" mid-word). Aborting the
  // previous in-flight request on every new keystroke guarantees only the
  // latest query's response can ever land.
  const pendingSearch = useRef<AbortController | null>(null);

  async function search(value: string) {
    setQuery(value);
    setConfirmed(false);
    pendingSearch.current?.abort();
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    pendingSearch.current = controller;
    try {
      const res = await fetch(`/api/games/search?query=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        throw error;
      }
    }
  }

  function choose(result: BggSearchResult) {
    setQuery(result.title);
    setResults([]);
    setConfirmed(true);
    onChoose({ bggId: result.bggId, title: result.title });
  }

  function useAnyway() {
    setResults([]);
    setConfirmed(true);
    onChoose({ bggId: null, title: query });
  }

  if (!BGG_SEARCH_AVAILABLE) {
    // BGG search switched off entirely — plain freeform input, no search
    // call, no messaging of any kind.
    return (
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChoose({ bggId: null, title: e.target.value });
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder={placeholder}
      />
      {results.length > 0 && (
        <ul>
          {results.map((r) => (
            <li key={r.bggId}>
              <button className="btn-ghost" onClick={() => choose(r)}>
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.length === 0 && query.trim().length >= 2 && !confirmed && (
        <p>
          No match found —{" "}
          <button className="btn-ghost" onClick={useAnyway}>
            use &quot;{query}&quot; anyway
          </button>
        </p>
      )}
      <BggAttribution />
    </>
  );
}
