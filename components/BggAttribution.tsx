// Required by BGG's XML API terms wherever the app surfaces BGG-sourced
// game search results. The official "Powered by BGG" logo (provided
// directly, not the earlier text placeholder) — self-hosted rather than
// hotlinked to BGG's CDN, same reasoning as the OG image's bundled font.
// Native aspect ratio is 200x59; 28px height is the smallest that keeps
// the logo's own "POWERED BY BGG" text legible — checked visually against
// 20/24/28/32px renders before picking this.
export function BggAttribution() {
  return (
    <p className="bgg-attribution">
      <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed static logo asset, next/image's overhead isn't worth it here */}
        <img src="/bgg-powered-by.png" alt="Powered by BGG" width={95} height={28} />
      </a>
    </p>
  );
}
