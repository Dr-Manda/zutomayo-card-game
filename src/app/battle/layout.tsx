import type { Metadata } from "next";

// Server layout so the page.tsx can stay 'use client' and still contribute
// per-route metadata.title to the parent template ("%s — ZUTOMAYO CARD").
export const metadata: Metadata = {
  title: "BATTLE",
};

export default function BattleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
