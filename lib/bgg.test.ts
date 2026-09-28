import { afterEach, describe, expect, it, vi } from "vitest";
import { searchBggGames } from "./bgg";

const SAMPLE_XML = `<?xml version="1.0"?>
<items>
  <item type="boardgame" id="342942">
    <name type="primary" value="Lord of the Rings: Fate of the Fellowship"/>
  </item>
  <item type="boardgame" id="1234">
    <name type="primary" value="Some Other Game"/>
  </item>
</items>`;

describe("searchBggGames", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses successful BGG XML responses into results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_XML })
    );

    const results = await searchBggGames("fate of the fellowship");

    expect(results).toEqual([
      { bggId: "342942", title: "Lord of the Rings: Fate of the Fellowship" },
      { bggId: "1234", title: "Some Other Game" },
    ]);
  });

  it("decodes HTML/XML entities in titles (confirmed live — real BGG results are full of these)", async () => {
    const xml = `<?xml version="1.0"?>
<items>
  <item type="boardgame" id="17419">
    <name type="primary" value="Catan 3D Collector&#039;s Edition"/>
  </item>
  <item type="boardgame" id="27760">
    <name type="primary" value="Catan: Traders &amp; Barbarians"/>
  </item>
  <item type="boardgame" id="39624">
    <name type="primary" value="Catan Dice Game &quot;Extra&quot;"/>
  </item>
</items>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => xml }));

    const results = await searchBggGames("catan");

    expect(results).toEqual([
      { bggId: "17419", title: "Catan 3D Collector's Edition" },
      { bggId: "27760", title: "Catan: Traders & Barbarians" },
      { bggId: "39624", title: 'Catan Dice Game "Extra"' },
    ]);
  });

  it("falls back to an empty array (never throws) when the API returns non-OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const results = await searchBggGames("anything");

    expect(results).toEqual([]);
  });

  it("falls back to an empty array when the network call rejects (timeout/failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const results = await searchBggGames("anything");

    expect(results).toEqual([]);
  });

  it("falls back to an empty array on malformed XML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "<not-bgg-xml/>" })
    );

    const results = await searchBggGames("anything");

    expect(results).toEqual([]);
  });

  it("returns an empty array without calling fetch for an empty query", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const results = await searchBggGames("   ");

    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends no Authorization header when BGG_API_TOKEN is unset", async () => {
    delete process.env.BGG_API_TOKEN;
    vi.resetModules();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_XML });
    vi.stubGlobal("fetch", fetchSpy);

    const { searchBggGames: search } = await import("./bgg");
    await search("fate of the fellowship");

    expect(fetchSpy.mock.calls[0][1].headers).toBeUndefined();
  });

  it("sends a Bearer Authorization header when BGG_API_TOKEN is set", async () => {
    process.env.BGG_API_TOKEN = "test-bgg-token";
    vi.resetModules();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_XML });
    vi.stubGlobal("fetch", fetchSpy);

    const { searchBggGames: search } = await import("./bgg");
    await search("fate of the fellowship");

    expect(fetchSpy.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer test-bgg-token" });
    delete process.env.BGG_API_TOKEN;
  });
});
