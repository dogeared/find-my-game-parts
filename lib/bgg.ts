// Shared BGG lookup helper (Code Quality Review, plan-eng-review): used by
// both the buyer request form and the admin add-game form so the fallback
// behavior only needs to be right once.

export type BggSearchResult = {
  bggId: string;
  title: string;
};

const BGG_API_BASE = process.env.BGG_API_BASE ?? "https://boardgamegeek.com/xmlapi2";
const LOOKUP_TIMEOUT_MS = 4000;

// The BGG XML API is known to be slow or rate-limited (docs/designs/find-my-game-parts.md,
// Dependencies). Callers must always be able to fall back to manual free-text
// entry — this helper signals that by returning an empty array rather than throwing.
export async function searchBggGames(query: string): Promise<BggSearchResult[]> {
  if (!query.trim()) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${BGG_API_BASE}/search?type=boardgame&query=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    );
    if (!response.ok) return [];

    const xml = await response.text();
    return parseBggSearchXml(xml);
  } catch {
    // Timeout, network failure, or malformed response — caller falls back
    // to manual free-text game-name entry per the design doc's Dependencies.
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function parseBggSearchXml(xml: string): BggSearchResult[] {
  const results: BggSearchResult[] = [];
  const itemRegex = /<item[^>]*id="(\d+)"[^>]*>[\s\S]*?<name[^>]*value="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    results.push({ bggId: match[1], title: match[2] });
  }
  return results;
}
