"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { bggGameUrl, isValidBggId } from "@/lib/bgg";
import { CLAIM_WINDOW_MS } from "@/lib/constants";
import { formatExtendedPrice } from "@/lib/pricing";

type MyItem = {
  id: string;
  partDescription: string;
  quantityRequested: number;
  quantityAvailable: number | null;
  status: "PENDING" | "AVAILABLE" | "NOT_AVAILABLE";
  price: string | null;
  claimedAt: string | null;
  updatedAt: string;
};

type MyOrder = {
  id: string;
  createdAt: string;
  game: { id: string; title: string; bggId: string | null };
  items: MyItem[];
};

function statusLabel(item: MyItem): string {
  if (item.status === "PENDING") return "Still checking";
  if (item.status === "NOT_AVAILABLE") return "Not available";
  const qty =
    item.quantityAvailable != null && item.quantityAvailable < item.quantityRequested
      ? `${item.quantityAvailable} of ${item.quantityRequested} available`
      : "Available";
  const price = formatExtendedPrice(item.price, item.quantityAvailable ?? item.quantityRequested);
  return price ? `${qty} — ${price}` : qty;
}

export function MyRequestsPageClient() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch("/api/my-requests");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
      setLoading(false);
    })();
  }, [session]);

  if (status === "loading") {
    return <main className="panel">Loading…</main>;
  }

  if (!session) {
    return (
      <main className="panel">
        <h2>Sign in to see your requests</h2>
        <button className="btn btn-primary" onClick={() => signIn("keycloak")}>
          Sign in →
        </button>
      </main>
    );
  }

  return (
    <main className="panel">
      <h2>My requests</h2>

      {loading && <p>Loading…</p>}
      {!loading && orders.length === 0 && <p>You haven&apos;t sent any requests yet.</p>}

      {orders.map((order) => (
        <div key={order.id} className="panel">
          <h3>
            {order.game.title}
            {isValidBggId(order.game.bggId) && (
              <>
                {" "}
                <a href={bggGameUrl(order.game.bggId)} target="_blank" rel="noopener noreferrer">
                  (BGG #{order.game.bggId})
                </a>
              </>
            )}
          </h3>
          <div>Submitted {new Date(order.createdAt).toLocaleString()}</div>

          {order.items.map((item) => (
            <div key={item.id} className="panel panel-dashed">
              <div>
                <b>{item.partDescription}</b> (qty {item.quantityRequested})
              </div>
              <div>{statusLabel(item)}</div>
              <div>Last updated {new Date(item.updatedAt).toLocaleString()}</div>
              {item.status === "AVAILABLE" && item.claimedAt && (
                <div>
                  Claim by {new Date(new Date(item.claimedAt).getTime() + CLAIM_WINDOW_MS).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}
