import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Inventory changes in real time (admin toggles availability) — never
// statically prerender this at build time, always render per-request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Public, unauthenticated — explicit select, never joins PartRequest
  // (Architecture Review AR-4 / TODOS.md: PII-safe public read model).
  const games = await prisma.game.findMany({
    where: { inStock: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <main className="panel panel-centered">
      <h1>FIND MY GAME · PARTS</h1>
      <p>missing a piece? We may have it. Or, we can get it.</p>

      <div className="panel panel-dashed">
        <b>Don&apos;t see your game?</b> Let me know if there&apos;s a game you need
        parts for, even if I don&apos;t currently have it available. If enough
        people need parts, I&apos;ll get it.
        <br />
        <br />
        <Link href="/request" className="btn btn-ghost">
          Request a part →
        </Link>
      </div>

      <h2>In stock right now</h2>
      {games.length === 0 ? (
        <p>No games in stock yet — request a part anyway, it still counts as demand.</p>
      ) : (
        games.map((game) => (
          <div className="game-row" key={game.id}>
            <span>{game.title}</span>
            <Link
              href={`/request?gameId=${game.id}&title=${encodeURIComponent(game.title)}`}
              className="btn btn-ghost"
            >
              Request a part
            </Link>
          </div>
        ))
      )}
    </main>
  );
}
