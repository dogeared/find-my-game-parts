import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";
import { ThemePicker } from "@/components/ThemePicker";
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
            <ThemePicker />
            <AccessibilityToggle />
          </div>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
