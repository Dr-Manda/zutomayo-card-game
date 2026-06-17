import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RULES",
};

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
