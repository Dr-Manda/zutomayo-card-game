import type { Metadata, Viewport } from "next";
import {
  Yusei_Magic,
  Noto_Sans_JP,
  JetBrains_Mono,
  Barlow_Condensed,
} from "next/font/google";
import { SfxProviderClient } from "@/components/SfxProviderClient";
import "./globals.css";

const yuseiMagic = Yusei_Magic({
  variable: "--font-yusei-magic",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZUTOMAYO CARD — THE BATTLE BEGINS",
  description:
    "ずとまよカードゲーム — 非公式ファンメイド / Unofficial fanmade Zutomayo Card Game",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f1ece2",
  width: "device-width",
  initialScale: 1,
  // WCAG 1.4.4: do not disable pinch-zoom. `maximumScale: 1` / `userScalable:
  // false` blocked low-vision users from compensating for the small UI; iOS
  // ignores them anyway, so only Android was penalized. Removed.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ja"
      className={`${yuseiMagic.variable} ${notoSansJP.variable} ${jetBrainsMono.variable} ${barlowCondensed.variable}`}
    >
      <body className="antialiased">
        <SfxProviderClient>{children}</SfxProviderClient>
      </body>
    </html>
  );
}
