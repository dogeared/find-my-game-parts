import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";
import { CloudflareAnalytics } from "@/components/CloudflareAnalytics";
import { Footer } from "@/components/Footer";
import { NavAuth } from "@/components/NavAuth";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";
import { ThemePicker } from "@/components/ThemePicker";
import { UserBadge } from "@/components/UserBadge";
import "./globals.css";

const TITLE = "Find My Game Parts";
const DESCRIPTION = "Missing a piece? We may have it. Or, we can get it.";

export const metadata: Metadata = {
  // Needed to resolve opengraph-image.tsx's output into an absolute URL —
  // without it, Next.js falls back to the request's own origin, which is
  // wrong for a link shared from a preview/staging deploy.
  metadataBase: new URL("https://findmygame.parts"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <div className="topbar">
            <nav className="topbar-nav">
              <UserBadge />
              <Link href="/" className="btn-ghost">
                Home
              </Link>
              <NavAuth />
              <Link href="/about" className="btn-ghost">
                About
              </Link>
            </nav>
            <div className="topbar-utility">
              <ThemePicker />
              <AccessibilityToggle />
            </div>
          </div>
          {children}
          <Footer />
        </SessionProviderWrapper>
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
