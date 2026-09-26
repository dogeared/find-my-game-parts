"use client";

import { useSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { BggSearchResult } from "@/lib/bgg";

// BGG's XML API now requires a registered, approved token (bgg.ts returns
// an empty result for every search until BGG_API_TOKEN exists — see the
// Dependencies section of the design doc). Until that's approved, gating
// submission on a REAL BGG match would block every request. Flip this back
// to `true` once BGG_API_TOKEN is set and bgg.ts sends it — that's the only
// change needed here; the validity/tooltip logic below already branches on it.
const REQUIRE_BGG_MATCH = false;

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

  const isGameChosen = REQUIRE_BGG_MATCH ? Boolean(bggId) : Boolean(gameTitle.trim());
  const isQuantityValid = Number.isFinite(quantity) && quantity >= 1;
  const isPartDescriptionValid = Boolean(partDescription.trim());
  const isFormValid = isGameChosen && isPartDescriptionValid && isQuantityValid;

  const disabledReason = !isGameChosen
    ? REQUIRE_BGG_MATCH
      ? "Select a game from the BGG search results to continue"
      : "Enter or select a game to continue"
    : !isPartDescriptionValid
      ? "Describe the part you need to continue"
      : !isQuantityValid
        ? "Enter a valid quantity (1 or more) to continue"
        : "";

  async function submit() {
    setError(null);
    if (!isFormValid) {
      setError("Please fill in the required fields.");
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
        <label>Game (required)</label>
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
        <label>What part do you need? (required, freeform, be specific)</label>
        <textarea
          rows={3}
          value={partDescription}
          onChange={(e) => setPartDescription(e.target.value)}
          placeholder="e.g. Stealth Rohan card, or Shadow Troop meeple"
        />
      </div>

      <div className="field">
        <label>Quantity (required)</label>
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

      <button
        className="btn"
        onClick={submit}
        disabled={!isFormValid}
        title={disabledReason || undefined}
        style={!isFormValid ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
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
