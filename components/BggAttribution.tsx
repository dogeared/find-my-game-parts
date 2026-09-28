// Required by BGG's XML API terms wherever the app surfaces BGG-sourced
// game search results. Text-based placeholder — BGG's terms/logo-asset
// pages block automated fetching, so the exact required wording/image
// couldn't be confirmed directly; swap in the real asset once available.
export function BggAttribution() {
  return (
    <p className="bgg-attribution">
      Game search powered by{" "}
      <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer">
        BoardGameGeek
      </a>
    </p>
  );
}
