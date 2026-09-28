import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";
import { NavAuth } from "@/components/NavAuth";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";
import { ThemePicker } from "@/components/ThemePicker";
import { UserBadge } from "@/components/UserBadge";
import "./globals.css";

export const metadata: Metadata = {
  title: "Find My Game Parts",
  description: "Missing a piece? We may have it. Or, we can get it.",
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
              <Link href="/about" className="btn-ghost">
                About
              </Link>
              <NavAuth />
            </nav>
            <div className="topbar-utility">
              <ThemePicker />
              <AccessibilityToggle />
            </div>
          </div>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
