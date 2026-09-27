"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type AdminRequest = {
  id: string;
  gameId: string;
  game: { id: string; title: string };
  requester: { email: string };
  partDescription: string;
  quantity: number;
  editionNote: string | null;
  maxPrice: string | null;
  criticalityTag: "UNSET" | "UNIQUE" | "FUNGIBLE";
  status: "PENDING" | "AVAILABLE" | "NOT_AVAILABLE";
  price: string | null;
  createdAt: string;
};

export default function AdminRequestsPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  // Double-approve nudge (Architecture Review AR-1 / D2): other still-pending
  // requests for the same game as whatever was just marked available.
  const [nudge, setNudge] = useState<{
    approvedId: string;
    others: Array<{ id: string; partDescription: string; createdAt: string }>;
  } | null>(null);

  async function loadRequests() {
    const res = await fetch("/api/admin/requests");
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount for a single-admin panel; not worth a data-fetching library for this MVP.
    if (session?.user?.isAdmin) loadRequests();
  }, [session]);

  async function patchRequest(id: string, body: Record<string, unknown>) {
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
      loadRequests();
    }
  }

  async function markNotAvailable(id: string) {
    await patchRequest(id, { status: "NOT_AVAILABLE" });
    setNudge((prev) =>
      prev ? { ...prev, others: prev.others.filter((o) => o.id !== id) } : prev
    );
  }

  if (status === "loading") return <main className="panel">Loading…</main>;
  if (!session?.user?.isAdmin) return <main className="panel">Admin access required.</main>;

  // Grouped by game, in the order the API already returns (gameId asc, then
  // createdAt asc) — no automatic part-bucket grouping (office-hours R3-1);
  // the admin reads this chronologically and uses judgment.
  const byGame = requests.reduce<Record<string, { title: string; items: AdminRequest[] }>>(
    (acc, r) => {
      acc[r.gameId] ??= { title: r.game.title, items: [] };
      acc[r.gameId].items.push(r);
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

      {Object.entries(byGame).map(([gameId, { title, items }]) => (
        <div key={gameId} className="panel">
          <h3>{title}</h3>
          {items.map((r) => (
            <div key={r.id} className="game-row game-row--stacked">
              <div>
                <b>{r.partDescription}</b> (qty {r.quantity})
                {r.editionNote && <span> — {r.editionNote}</span>}
                {r.maxPrice && <span> — up to ${r.maxPrice}</span>}
              </div>
              <div>
                {r.requester.email} — {new Date(r.createdAt).toLocaleString()} — status:{" "}
                {r.status}
              </div>
              <div>
                <label>
                  Criticality:{" "}
                  <select
                    value={r.criticalityTag}
                    onChange={(e) => patchRequest(r.id, { criticalityTag: e.target.value })}
                  >
                    <option value="UNSET">Unset</option>
                    <option value="UNIQUE">Unique</option>
                    <option value="FUNGIBLE">Fungible</option>
                  </select>
                </label>
              </div>
              {r.status === "PENDING" && (
                <div>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      const price = window.prompt("Price?");
                      if (price !== null) patchRequest(r.id, { status: "AVAILABLE", price });
                    }}
                  >
                    Mark available
                  </button>
                  <button className="btn-ghost" onClick={() => markNotAvailable(r.id)}>
                    Mark not available
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}
