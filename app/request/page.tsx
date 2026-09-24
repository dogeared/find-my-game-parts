"use client";

import { useSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { BggSearchResult } from "@/lib/bgg";

function RequestForm() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  // Prefill from the public inventory list (?gameId=&title=) via lazy
  // initializers — this is derived initial state, not a post-mount side
  // effect (react-hooks/set-state-in-effect: deriving state from props on
  // mount belongs in the initializer, not a useEffect).
  const [gameId, setGameId] = useState<string | null>(() => searchParams.get("gameId"));
  const [bggId, setBggId] = useState<string | null>(null);
  const [gameQuery, setGameQuery] = useState(() => searchParams.get("title") ?? "");
  const [gameTitle, setGameTitle] = useState(() => searchParams.get("title") ?? "");
  const [gameResults, setGameResults] = useState<BggSearchResult[]>([]);
  const [partDescription, setPartDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [editionNote, setEditionNote] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchGames(query: string) {
    setGameQuery(query);
    setGameId(null);
    setBggId(null);
    if (query.trim().length < 2) {
      setGameResults([]);
      return;
    }
    const res = await fetch(`/api/games/search?query=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      setGameResults(data.results ?? []);
    }
  }

  async function submit() {
    setError(null);
    if (!gameTitle.trim() || !partDescription.trim()) {
      setError("Game and part description are required.");
      return;
    }

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        bggId,
        gameTitle: gameTitle.trim(),
        partDescription,
        quantity,
        editionNote,
        maxPrice: maxPrice || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setSubmitted(true);
  }

  if (status === "loading") {
    return <main className="panel">Loading…</main>;
  }

  if (!session) {
    return (
      <main className="panel">
        <h2>Sign in to send your request</h2>
        <p>Browsing is always free — sending a request needs an account.</p>
        <button className="btn btn-primary" onClick={() => signIn("keycloak")}>
          Sign in →
        </button>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="panel">
        <h2>Got it.</h2>
        <p>You&apos;ll get a reply once I check what&apos;s on hand.</p>
      </main>
    );
  }

  return (
    <main className="panel">
      <h2>Request a part</h2>

      <div className="field">
        <label>Game</label>
        <input
          type="text"
          value={gameQuery}
          onChange={(e) => searchGames(e.target.value)}
          placeholder="Start typing a title…"
        />
        {gameResults.length > 0 && (
          <ul>
            {gameResults.map((r) => (
              <li key={r.bggId}>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setGameId(null);
                    setBggId(r.bggId);
                    setGameTitle(r.title);
                    setGameQuery(r.title);
                    setGameResults([]);
                  }}
                >
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {gameResults.length === 0 && gameQuery.trim().length >= 2 && !gameId && !bggId && (
          <p>
            No match found —{" "}
            <button className="btn-ghost" onClick={() => setGameTitle(gameQuery)}>
              use &quot;{gameQuery}&quot; anyway
            </button>
          </p>
        )}
      </div>

      <div className="field">
        <label>What part do you need? (freeform, be specific)</label>
        <textarea
          rows={3}
          value={partDescription}
          onChange={(e) => setPartDescription(e.target.value)}
          placeholder="e.g. 1x Stealth Rohan card, or 3x Shadow Troop meeples"
        />
      </div>

      <div className="field">
        <label>Quantity</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Edition / printing note (optional)</label>
        <input
          type="text"
          value={editionNote}
          onChange={(e) => setEditionNote(e.target.value)}
          placeholder="e.g. Kickstarter deluxe edition"
        />
      </div>

      <div className="field">
        <label>Max you&apos;d pay (optional)</label>
        <input
          type="text"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="$10"
        />
      </div>

      {error && <p style={{ color: "var(--accent)" }}>{error}</p>}

      <button className="btn" onClick={submit}>
        Send request →
      </button>
    </main>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={<main className="panel">Loading…</main>}>
      <RequestForm />
    </Suspense>
  );
}
