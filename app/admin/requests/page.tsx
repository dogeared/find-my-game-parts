"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

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
  game: { id: string; title: string };
  requester: { email: string };
  createdAt: string;
  items: AdminItem[];
};

export default function AdminRequestsPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  // Double-approve nudge (Architecture Review AR-1 / D2): other still-pending
  // items for the same game as whatever was just marked available.
  const [nudge, setNudge] = useState<{
    approvedId: string;
    others: Array<{ id: string; partDescription: string; createdAt: string }>;
  } | null>(null);

  async function loadOrders() {
    const res = await fetch("/api/admin/requests");
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount for a single-admin panel; not worth a data-fetching library for this MVP.
    if (session?.user?.isAdmin) loadOrders();
  }, [session]);

  async function patchItem(id: string, body: Record<string, unknown>) {
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
      loadOrders();
    }
  }

  async function markNotAvailable(id: string) {
    await patchItem(id, { status: "NOT_AVAILABLE" });
    setNudge((prev) =>
      prev ? { ...prev, others: prev.others.filter((o) => o.id !== id) } : prev
    );
  }

  function markAvailable(item: AdminItem) {
    const price = window.prompt("Price?");
    if (price === null) return;
    let quantityAvailable = item.quantityRequested;
    if (item.quantityRequested > 1) {
      const qtyInput = window.prompt(
        `How many of the ${item.quantityRequested} requested do you have?`,
        String(item.quantityRequested)
      );
      if (qtyInput === null) return;
      quantityAvailable = Number(qtyInput);
    }
    patchItem(item.id, { status: "AVAILABLE", price, quantityAvailable });
  }

  if (status === "loading") return <main className="panel">Loading…</main>;
  if (!session?.user?.isAdmin) return <main className="panel">Admin access required.</main>;

  // Grouped by game, in the order the API already returns (gameId asc, then
  // createdAt asc) — no automatic part-bucket grouping (office-hours R3-1);
  // the admin reads this chronologically and uses judgment.
  const byGame = orders.reduce<Record<string, { title: string; orders: AdminOrder[] }>>(
    (acc, order) => {
      acc[order.gameId] ??= { title: order.game.title, orders: [] };
      acc[order.gameId].orders.push(order);
      return acc;
    },
    {}
  );

  return (
    <main className="panel">
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

      {Object.entries(byGame).map(([gameId, { title, orders: gameOrders }]) => (
        <div key={gameId} className="panel">
          <h3>{title}</h3>
          {gameOrders.map((order) => (
            <div key={order.id} className="game-row game-row--stacked">
              <div>
                {order.requester.email} — {new Date(order.createdAt).toLocaleString()}
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
                        {item.price && <> — ${item.price}</>}
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
                      <button className="btn-ghost" onClick={() => markAvailable(item)}>
                        Mark available
                      </button>
                      <button className="btn-ghost" onClick={() => markNotAvailable(item.id)}>
                        Mark not available
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}
