import type { Metadata, Viewport } from "next";
import {
  Yusei_Magic,
  Noto_Sans_JP,
  JetBrains_Mono,
  Barlow_Condensed,
} from "next/font/google";
import { SfxProvider } from "@/components/SfxProvider";
import SoundToggle from "@/components/SoundToggle";
import { BASE_PATH } from "@/lib/basePath";
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
  // metadataBase is the URL the production site lives at. Once set, every
  // relative URL in openGraph / twitter / etc. resolves against it — so
  // shared links on Discord/Twitter/LINE render the real card metadata
  // instead of bare text. The repo username is hardcoded since this is
  // the only place it appears in the codebase.
  metadataBase: new URL("https://dr-manda.github.io/zutomayo-card-game"),
  title: {
    default: "ZUTOMAYO CARD — THE BATTLE BEGINS",
    template: "%s — ZUTOMAYO CARD",
  },
  description:
    "ずとまよカードゲーム — 非公式ファンメイド / Unofficial fanmade Zutomayo Card Game",
  // Next does NOT apply basePath to metadata.manifest — verified empirically
  // in the built HTML. Without manual prefixing the link tag emits
  // href="/manifest.json", which 404s on Pages under /zutomayo-card-game.
  manifest: `${BASE_PATH}/manifest.json`,
  openGraph: {
    title: "ZUTOMAYO CARD — THE BATTLE BEGINS",
    description:
      "ずとまよカードゲーム — 非公式ファンメイド / Unofficial fanmade Zutomayo Card Game",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ZUTOMAYO CARD — THE BATTLE BEGINS",
    description:
      "ずとまよカードゲーム — 非公式ファンメイド / Unofficial fanmade Zutomayo Card Game",
  },
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
        <SfxProvider>
          {children}
          <SoundToggle />
        </SfxProvider>
      </body>
    </html>
  );
}
