"use client";

import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BggAttribution } from "@/components/BggAttribution";
import type { BggSearchResult } from "@/lib/bgg";

// BGG approved the application's API token 2026-09-28 (bgg.ts sends it as
// a Bearer header) — live search-as-you-type is favored, with "use this
// title anyway" as an explicit freeform fallback when BGG has no match or
// is slow/down. Both the search UI below and the submission gate branch
// on this single flag.
const BGG_SEARCH_AVAILABLE = true;

type RequestItem = {
  partDescription: string;
  quantity: number;
  editionNote: string;
  maxPrice: string;
};

function emptyItem(): RequestItem {
  return { partDescription: "", quantity: 1, editionNote: "", maxPrice: "" };
}

function RequestForm() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  // Prefill from the public inventory list (?gameId=&title=) via lazy
  // initializers — this is derived initial state, not a post-mount side
  // effect (react-hooks/set-state-in-effect: deriving state from props on
  // mount belongs in the initializer, not a useEffect).
  const [gameId, setGameId] = useState<string | null>(() => searchParams.get("gameId"));
  // Arriving with a real gameId means the buyer picked an existing
  // inventory game, not typed one freehand — lock it so it can't be edited
  // into a near-duplicate freeform title (e.g. "Catan" vs "catan " vs
  // "CATAN"), which would otherwise fragment demand across records for the
  // same game. Fixed at mount; the prefill only ever happens once.
  const [gameLocked] = useState(() => Boolean(searchParams.get("gameId")));
  const [bggId, setBggId] = useState<string | null>(null);
  const [gameQuery, setGameQuery] = useState(() => searchParams.get("title") ?? "");
  const [gameTitle, setGameTitle] = useState(() => searchParams.get("title") ?? "");
  const [gameResults, setGameResults] = useState<BggSearchResult[]>([]);
  // Bundled part requests: one submission (one game) can carry several line
  // items, e.g. a unique card + a stack of meeples, each triaged separately
  // by the admin.
  const [items, setItems] = useState<RequestItem[]>([emptyItem()]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<RequestItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

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

  // gameTitle (not bggId) is the one field every path sets: arriving
  // locked from the inventory list, picking a real BGG match, clicking
  // "use this title anyway", and fully-freeform mode all set gameTitle —
  // bggId only gets set on a real BGG pick, so checking it alone would
  // block the deliberate-freeform-override path this form needs to keep
  // working.
  const isGameChosen = Boolean(gameTitle.trim());
  const isItemValid = (item: RequestItem) =>
    Boolean(item.partDescription.trim()) && Number.isFinite(item.quantity) && item.quantity >= 1;
  const areItemsValid = items.length > 0 && items.every(isItemValid);
  const isFormValid = isGameChosen && areItemsValid;

  const disabledReason = !isGameChosen
    ? BGG_SEARCH_AVAILABLE
      ? "Select a game from the search results (or use your typed title if there's no match) to continue"
      : "Enter a game to continue"
    : !areItemsValid
      ? "Describe each part and give it a valid quantity (1 or more) to continue"
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
        items: items.map((item) => ({
          partDescription: item.partDescription,
          quantity: item.quantity,
          editionNote: item.editionNote,
          maxPrice: item.maxPrice || undefined,
        })),
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
        <p>
          <Link href="/my-requests">Track this request →</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="panel">
      <h2>Request a part</h2>

      <div className="field">
        <label>Game (required)</label>
        {gameLocked ? (
          <input type="text" value={gameTitle} disabled readOnly title="Selected from inventory — not editable" />
        ) : BGG_SEARCH_AVAILABLE ? (
          <>
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
            <BggAttribution />
          </>
        ) : (
          // BGG search is down (see BGG_SEARCH_AVAILABLE above) — plain
          // freeform input, no search call, no messaging of any kind.
          <input
            type="text"
            value={gameTitle}
            onChange={(e) => {
              setGameId(null);
              setBggId(null);
              setGameQuery(e.target.value);
              setGameTitle(e.target.value);
            }}
            placeholder="Type a game title…"
          />
        )}
      </div>

      {items.map((item, index) => (
        <div key={index} className="panel panel-dashed">
          <div className="field">
            <label>What part do you need? (required, freeform, be specific)</label>
            <textarea
              rows={3}
              value={item.partDescription}
              onChange={(e) => updateItem(index, { partDescription: e.target.value })}
              placeholder="e.g. Stealth Rohan card, or Shadow Troop meeple"
            />
          </div>

          <div className="field">
            <label>Quantity (required)</label>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
            />
          </div>

          <div className="field">
            <label>Edition / printing note (optional)</label>
            <input
              type="text"
              value={item.editionNote}
              onChange={(e) => updateItem(index, { editionNote: e.target.value })}
              placeholder="e.g. Kickstarter deluxe edition"
            />
          </div>

          <div className="field">
            <label>Max you&apos;d pay (optional)</label>
            <input
              type="text"
              value={item.maxPrice}
              onChange={(e) => updateItem(index, { maxPrice: e.target.value })}
              placeholder="$10"
            />
          </div>

          {items.length > 1 && (
            <button className="btn-ghost" onClick={() => removeItem(index)}>
              Remove this part
            </button>
          )}
        </div>
      ))}

      <button className="btn-ghost" onClick={addItem}>
        + Add another part for this game
      </button>

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn"
        onClick={submit}
        disabled={!isFormValid}
        title={disabledReason || undefined}
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
