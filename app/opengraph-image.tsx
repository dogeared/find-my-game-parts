import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Auto-picked-up by Next.js's file convention — wires the og:image/
// twitter:image meta tags automatically, no manual metadata needed.
export const runtime = "nodejs";
export const alt = "Find My Game Parts — missing a piece? We may have it. Or, we can get it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Courier Prime (SIL OFL 1.1, via Google Fonts) — bundled locally rather
// than fetched at request time, so social-preview generation never
// depends on an external network call. Chosen as the closest open-license
// match to the site's actual "Courier New" look (see globals.css).
const FONTS_DIR = join(process.cwd(), "assets", "fonts");

export default async function OpengraphImage() {
  const [regular, bold] = await Promise.all([
    readFile(join(FONTS_DIR, "CourierPrime-Regular.ttf")),
    readFile(join(FONTS_DIR, "CourierPrime-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4ecd8",
          fontFamily: "Courier Prime",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "64px 96px",
            border: "8px solid #2c2137",
            boxShadow: "18px 18px 0 #2c2137",
            background: "#f4ecd8",
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#2c2137",
              letterSpacing: 2,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            FIND MY GAME · PARTS
          </div>
          <div style={{ width: 140, height: 8, background: "#e2703a", marginTop: 28 }} />
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              color: "#4d7c8a",
              textAlign: "center",
            }}
          >
            missing a piece? we may have it.
          </div>
          <div style={{ fontSize: 30, color: "#4d7c8a", textAlign: "center" }}>
            or, we can get it.
          </div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
      fonts: [
        { name: "Courier Prime", data: regular, weight: 400, style: "normal" },
        { name: "Courier Prime", data: bold, weight: 700, style: "normal" },
      ],
    }
  );
}
