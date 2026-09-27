import { NextResponse } from "next/server";
import { searchBggGames } from "@/lib/bgg";

// Live search-as-you-type for the request form. Returns an empty array on
// any BGG failure — the request page's "use this title anyway" manual
// fallback covers that case (Dependencies in the design doc).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const results = await searchBggGames(query);
  return NextResponse.json({ results });
}
