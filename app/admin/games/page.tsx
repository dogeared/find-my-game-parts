"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type Game = { id: string; title: string; bggId: string | null; inStock: boolean };

export default function AdminGamesPage() {
  const { data: session, status } = useSession();
  const [games, setGames] = useState<Game[]>([]);
  const [title, setTitle] = useState("");

  async function loadGames() {
    const res = await fetch("/api/games");
    if (res.ok) {
      const data = await res.json();
      setGames(data.games ?? []);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount for a single-admin panel; not worth a data-fetching library for this MVP.
    if (session?.user?.isAdmin) loadGames();
  }, [session]);

  async function addGame() {
    if (!title.trim()) return;
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setTitle("");
      loadGames();
    }
  }

  async function toggleGame(id: string, inStock: boolean) {
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inStock: !inStock }),
    });
    loadGames();
  }

  if (status === "loading") return <main className="panel">Loading…</main>;
  if (!session?.user?.isAdmin) return <main className="panel">Admin access required.</main>;

  return (
    <main className="panel">
      <h2>Manage inventory</h2>

      <div className="field">
        <label>Add a game (BGG lookup, with manual fallback)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Game title"
        />
      </div>
      <button className="btn" onClick={addGame}>
        Add game →
      </button>

      <h3>Games</h3>
      {games.map((game) => (
        <div className="game-row" key={game.id}>
          <span>
            {game.title} {game.bggId ? `(BGG #${game.bggId})` : "(manual entry — no BGG match)"}
          </span>
          <button className="btn btn-ghost" onClick={() => toggleGame(game.id, game.inStock)}>
            {game.inStock ? "Mark unavailable" : "Mark available"}
          </button>
        </div>
      ))}
    </main>
  );
}
