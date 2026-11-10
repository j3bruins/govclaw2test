import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { ensureSeeded } from "@/lib/db";
import { currentViewer, deskSide } from "@/lib/viewer";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const sans = Public_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "GovClaw", template: "%s · GovClaw" },
  description: "Capture desk for federal grants and contracts. Profiles, fit scoring, checklists, projects, and proposal versions.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>
        <Suspense fallback={<p className="loading">Opening the desk…</p>}>
          <Frame>{children}</Frame>
        </Suspense>
      </body>
    </html>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  await ensureSeeded();
  const [viewer, side] = await Promise.all([currentViewer(), deskSide()]);
  return (
    <Shell viewer={viewer} side={side}>
      {children}
    </Shell>
  );
}
