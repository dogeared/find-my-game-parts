"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { MarkdownContent } from "@/components/MarkdownContent";

type Game = { id: string; title: string; bggId: string | null; inStock: boolean };
type Tab = "inventory" | "about";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("inventory");

  if (status === "loading") return <main className="panel">Loading…</main>;
  if (!session?.user?.isAdmin) return <main className="panel">Admin access required.</main>;

  return (
    <main className="panel">
      <div className="tabs">
        <button
          className={`tab ${tab === "inventory" ? "tab-active" : ""}`}
          onClick={() => setTab("inventory")}
        >
          Inventory
        </button>
        <button className={`tab ${tab === "about" ? "tab-active" : ""}`} onClick={() => setTab("about")}>
          About
        </button>
      </div>

      {tab === "inventory" ? <InventoryTab /> : <AboutTab />}
    </main>
  );
}

function InventoryTab() {
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
    loadGames();
  }, []);

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

  return (
    <>
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
    </>
  );
}

function AboutTab() {
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/about");
      if (res.ok) {
        const data = await res.json();
        setMarkdown(data.markdown ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setStatus(null);
    const res = await fetch("/api/about", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    });
    setStatus(res.ok ? "Saved." : "Save failed — check the content and try again.");
  }

  if (loading) return <p>Loading…</p>;

  return (
    <>
      <h2>Edit the About page</h2>

      {previewing ? (
        <div className="about-preview panel-dashed">
          <MarkdownContent markdown={markdown} />
        </div>
      ) : (
        <div className="field">
          <label>Markdown content</label>
          <textarea rows={20} value={markdown} onChange={(e) => setMarkdown(e.target.value)} />
        </div>
      )}

      <button className="btn btn-ghost" onClick={() => setPreviewing((p) => !p)}>
        {previewing ? "Edit" : "Preview"}
      </button>
      {!previewing && (
        <button className="btn" onClick={save}>
          Save
        </button>
      )}
      {status && <p className={status === "Saved." ? undefined : "error-text"}>{status}</p>}
    </>
  );
}
