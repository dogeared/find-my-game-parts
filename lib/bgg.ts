// Shared BGG lookup helper (Code Quality Review, plan-eng-review): used by
// both the buyer request form and the admin add-game form so the fallback
// behavior only needs to be right once.

export type BggSearchResult = {
  bggId: string;
  title: string;
};

const BGG_API_BASE = process.env.BGG_API_BASE ?? "https://boardgamegeek.com/xmlapi2";
const LOOKUP_TIMEOUT_MS = 4000;

// BGG's XML API has required a registered, approved application token since
// July 2, 2025 — anonymous requests get a flat 401. Without a token, every
// call below falls through the !response.ok branch to an empty result,
// same graceful-degradation path as any other BGG failure.
const BGG_API_TOKEN = process.env.BGG_API_TOKEN;

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
      {
        signal: controller.signal,
        headers: BGG_API_TOKEN ? { Authorization: `Bearer ${BGG_API_TOKEN}` } : undefined,
      }
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
    results.push({ bggId: match[1], title: decodeXmlEntities(match[2]) });
  }
  return results;
}

// BGG's real search results are full of titles like "Catan: Traders &amp;
// Barbarians" and "Collector&#039;s Edition" — confirmed live once the API
// token was working and real (non-empty) results started flowing through.
// The regex above pulls the raw XML attribute value, entities and all.
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
