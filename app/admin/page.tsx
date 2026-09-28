"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { bggGameUrl } from "@/lib/bgg";
import { formatExtendedPrice } from "@/lib/pricing";

type Game = { id: string; title: string; bggId: string | null; inStock: boolean };
type Tab = "inventory" | "requests" | "about";

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
        <button
          className={`tab ${tab === "requests" ? "tab-active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Requests
        </button>
        <button className={`tab ${tab === "about" ? "tab-active" : ""}`} onClick={() => setTab("about")}>
          About
        </button>
      </div>

      {tab === "inventory" ? <InventoryTab /> : tab === "requests" ? <RequestsTab /> : <AboutTab />}
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

type AdminItem = {
  id: string;
  partDescription: string;
  quantityRequested: number;
  quantityAvailable: number | null;
  editionNote: string | null;
  maxPrice: string | null;
  criticalityTag: "UNSET" | "UNIQUE" | "FUNGIBLE";
  status: "PENDING" | "AVAILABLE" | "NOT_AVAILABLE";
  price: string | null;
  createdAt: string;
};

type AdminOrder = {
  id: string;
  gameId: string;
  game: { id: string; title: string; bggId: string | null };
  requester: { email: string };
  createdAt: string;
  items: AdminItem[];
};

type AvailabilityDraft = { price: string; quantityAvailable: number };

function RequestsTab() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  // Double-approve nudge (Architecture Review AR-1 / D2): other still-pending
  // items for the same game as whatever was just marked available.
  const [nudge, setNudge] = useState<{
    approvedId: string;
    others: Array<{ id: string; partDescription: string; createdAt: string }>;
  } | null>(null);
  // Draft price/quantity per pending item, keyed by item id — lets the admin
  // adjust both before submitting a single "mark available" action instead
  // of two sequential window.prompt() calls.
  const [drafts, setDrafts] = useState<Record<string, AvailabilityDraft>>({});
  // Per-order feedback for both the manual "Send notification" button and
  // the automatic send that fires once an order's last item is decided —
  // persists until overwritten by the next notify action on that order.
  const [notifyFeedback, setNotifyFeedback] = useState<Record<string, string>>({});

  function draftFor(item: AdminItem): AvailabilityDraft {
    return drafts[item.id] ?? { price: "", quantityAvailable: item.quantityRequested };
  }

  function updateDraft(item: AdminItem, patch: Partial<AvailabilityDraft>) {
    setDrafts((prev) => ({ ...prev, [item.id]: { ...draftFor(item), ...patch } }));
  }

  async function loadOrders() {
    const res = await fetch("/api/admin/requests");
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount for a single-admin panel; not worth a data-fetching library for this MVP.
    loadOrders();
  }, []);

  async function patchItem(id: string, body: Record<string, unknown>, orderId?: string) {
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.otherPendingForGame?.length > 0) {
        setNudge({ approvedId: id, others: data.otherPendingForGame });
      }
      if (orderId && data.orderNotified) {
        setNotifyFeedback((prev) => ({ ...prev, [orderId]: "Buyer notified — every item is decided." }));
      }
      loadOrders();
    }
  }

  async function markNotAvailable(id: string, orderId?: string) {
    await patchItem(id, { status: "NOT_AVAILABLE" }, orderId);
    setNudge((prev) =>
      prev ? { ...prev, others: prev.others.filter((o) => o.id !== id) } : prev
    );
  }

  function markAvailable(item: AdminItem, orderId: string) {
    const draft = draftFor(item);
    patchItem(
      item.id,
      { status: "AVAILABLE", price: draft.price, quantityAvailable: draft.quantityAvailable },
      orderId
    );
    setDrafts((prev) => {
      const { [item.id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  async function sendNotification(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/notify`, { method: "POST" });
    const data = res.ok ? await res.json() : { sent: false };
    setNotifyFeedback((prev) => ({
      ...prev,
      [orderId]: data.sent ? "Notification sent." : "Notification failed to send.",
    }));
  }

  // Grouped by game, in the order the API already returns (gameId asc, then
  // createdAt asc) — no automatic part-bucket grouping (office-hours R3-1);
  // the admin reads this chronologically and uses judgment.
  const byGame = orders.reduce<
    Record<string, { title: string; bggId: string | null; orders: AdminOrder[] }>
  >((acc, order) => {
    acc[order.gameId] ??= { title: order.game.title, bggId: order.game.bggId, orders: [] };
    acc[order.gameId].orders.push(order);
    return acc;
  }, {});

  return (
    <>
      <h2>Triage requests</h2>

      {nudge && (
        <div className="panel panel-dashed">
          <b>You just approved a request.</b> Other pending requests for the same game —
          check if any of these are for the same physical part:
          <ul>
            {nudge.others.map((o) => (
              <li key={o.id}>
                {o.partDescription}{" "}
                <button className="btn-ghost" onClick={() => markNotAvailable(o.id)}>
                  Mark not available
                </button>
              </li>
            ))}
          </ul>
          <button className="btn-ghost" onClick={() => setNudge(null)}>
            Dismiss
          </button>
        </div>
      )}

      {Object.entries(byGame).map(([gameId, { title, bggId, orders: gameOrders }]) => (
        <div key={gameId} className="panel">
          <h3>
            {title}
            {bggId && (
              <>
                {" "}
                <a href={bggGameUrl(bggId)} target="_blank" rel="noopener noreferrer">
                  (BGG #{bggId})
                </a>
              </>
            )}
          </h3>
          {gameOrders.map((order) => (
            <div key={order.id} className="game-row game-row--stacked">
              <div>
                {order.requester.email} — {new Date(order.createdAt).toLocaleString()}{" "}
                <button className="btn-ghost" onClick={() => sendNotification(order.id)}>
                  Send notification
                </button>
                {notifyFeedback[order.id] && <span> — {notifyFeedback[order.id]}</span>}
              </div>
              {order.items.map((item) => (
                <div key={item.id} className="panel panel-dashed">
                  <div>
                    <b>{item.partDescription}</b> (qty {item.quantityRequested})
                    {item.editionNote && <span> — {item.editionNote}</span>}
                    {item.maxPrice && <span> — up to ${item.maxPrice}</span>}
                  </div>
                  <div>
                    status: {item.status}
                    {item.status === "AVAILABLE" && item.quantityAvailable != null && (
                      <span>
                        {" "}
                        — {item.quantityAvailable} of {item.quantityRequested} available
                        {formatExtendedPrice(item.price, item.quantityAvailable) && (
                          <> — {formatExtendedPrice(item.price, item.quantityAvailable)}</>
                        )}
                      </span>
                    )}
                  </div>
                  <div>
                    <label>
                      Criticality:{" "}
                      <select
                        value={item.criticalityTag}
                        onChange={(e) => patchItem(item.id, { criticalityTag: e.target.value })}
                      >
                        <option value="UNSET">Unset</option>
                        <option value="UNIQUE">Unique</option>
                        <option value="FUNGIBLE">Fungible</option>
                      </select>
                    </label>
                  </div>
                  {item.status === "PENDING" && (
                    <div>
                      <label>
                        Price per item:{" "}
                        <input
                          type="text"
                          value={draftFor(item).price}
                          onChange={(e) => updateDraft(item, { price: e.target.value })}
                          placeholder="$2"
                        />
                      </label>{" "}
                      {item.quantityRequested > 1 && (
                        <label>
                          Qty available (of {item.quantityRequested}):{" "}
                          <input
                            type="number"
                            min={1}
                            max={item.quantityRequested}
                            value={draftFor(item).quantityAvailable}
                            onChange={(e) => updateDraft(item, { quantityAvailable: Number(e.target.value) })}
                          />
                        </label>
                      )}
                      <div>
                        <button
                          className="btn-ghost"
                          onClick={() => markAvailable(item, order.id)}
                          disabled={!draftFor(item).price.trim()}
                        >
                          Mark available
                        </button>
                        <button className="btn-ghost" onClick={() => markNotAvailable(item.id, order.id)}>
                          Mark not available
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
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
