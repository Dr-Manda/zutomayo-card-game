import Link from 'next/link'
import StampBadge from '@/components/StampBadge'

interface SfxEntry {
  title: string
  attribution: string
  url: string
  author?: string
}

// CC-BY 4.0 — attribution is a license requirement, not a courtesy. These
// must appear here verbatim. Per public/sfx/CREDITS.txt.
const ccByEntries: SfxEntry[] = [
  {
    title: 'Card slap',
    attribution: 'by f4ngy',
    author: 'f4ngy',
    url: 'https://freesound.org/people/f4ngy/sounds/240776/',
  },
  {
    title: 'Sound #351567',
    attribution: 'from Freesound',
    url: 'https://freesound.org/s/351567/',
  },
]

// CC0 — credited as a courtesy to the original authors.
const cc0Entries: SfxEntry[] = [
  {
    title: 'card-flip.mp3',
    attribution: 'by Splashdust',
    author: 'Splashdust',
    url: 'https://freesound.org/people/Splashdust/sounds/84322/',
  },
  {
    title: 'impact.mp3',
    attribution: 'by Breviceps',
    author: 'Breviceps',
    url: 'https://freesound.org/people/Breviceps/sounds/449955/',
  },
  {
    title: 'clock-tick.mp3 / damage-tick.mp3',
    attribution: 'by modusmogulus',
    author: 'modusmogulus',
    url: 'https://freesound.org/people/modusmogulus/sounds/790486/',
  },
  {
    title: 'sting-start.mp3 / sting-end.mp3',
    attribution: 'by Erokia',
    author: 'Erokia',
    url: 'https://freesound.org/people/Erokia/sounds/387588/',
  },
]

export default function CreditsPage() {
  return (
    <main className="flex-1 w-full bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Top bar with back link */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="font-mono text-sm text-ink hover:text-accent-deep transition-colors"
          >
            ← 戻る / Back
          </Link>
          <span className="font-mono text-xs text-ink-dim">CREDITS // クレジット</span>
        </div>

        {/* Page header stamp */}
        <div className="flex justify-center mb-10">
          <StampBadge size="xl" variant="outline" offset jp="クレジット" en="CREDITS" />
        </div>

        {/* Section: CC-BY 4.0 attributions (required) */}
        <section className="mb-12">
          <div className="flex items-baseline gap-4 mb-4">
            <span className="font-display ink-offset text-6xl text-accent leading-none">
              01
            </span>
            <h2 className="font-display text-2xl text-ink">
              サウンド帰属
              <span className="block font-mono text-xs text-ink-dim mt-1">
                Sound attribution — CC BY 4.0 (required)
              </span>
            </h2>
          </div>

          <p className="font-mono text-xs text-ink-dim mb-4">
            These clips are licensed under{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent-deep"
            >
              CC BY 4.0
            </a>
            . Attribution is a license requirement.
          </p>

          <ul className="hairline-list flex flex-col">
            {ccByEntries.map((e, i) => (
              <li
                key={i}
                className="py-3 font-body text-sm text-ink flex flex-col gap-1"
              >
                <span className="font-display text-base">
                  &ldquo;{e.title}&rdquo; {e.attribution}
                </span>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-ink-secondary underline break-all hover:text-accent-deep"
                >
                  {e.url}
                </a>
                <span className="font-mono text-xs text-ink-dim">
                  licensed under CC BY 4.0
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section: CC0 courtesy credits */}
        <section className="mb-12">
          <div className="flex items-baseline gap-4 mb-4">
            <span className="font-display ink-offset text-6xl text-accent leading-none">
              02
            </span>
            <h2 className="font-display text-2xl text-ink">
              CC0 サウンド
              <span className="block font-mono text-xs text-ink-dim mt-1">
                CC0 sounds (no attribution required, credited as a courtesy)
              </span>
            </h2>
          </div>

          <ul className="hairline-list flex flex-col">
            {cc0Entries.map((e, i) => (
              <li
                key={i}
                className="py-3 font-body text-sm text-ink flex flex-col gap-1"
              >
                <span className="font-display text-base">
                  {e.title} <span className="text-ink-dim">{e.attribution}</span>
                </span>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-ink-secondary underline break-all hover:text-accent-deep"
                >
                  {e.url}
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Section: Processing chain */}
        <section className="mb-12">
          <div className="flex items-baseline gap-4 mb-4">
            <span className="font-display ink-offset text-6xl text-accent leading-none">
              03
            </span>
            <h2 className="font-display text-2xl text-ink">
              処理チェーン
              <span className="block font-mono text-xs text-ink-dim mt-1">
                Cassette processing chain
              </span>
            </h2>
          </div>
          <p className="font-body text-base mb-3">
            ソースサウンドはカセット感のあるFFmpegチェーンを通して処理：
            highpass 80Hz、lowpass 8kHz、ソフトコンプ、4Hzビブラート。
          </p>
          <pre className="font-mono text-xs text-ink-secondary border border-ink-secondary bg-paper-deep p-3 overflow-x-auto">
{`highpass=f=80, lowpass=f=8000,
acompressor=threshold=-15dB:ratio=4:attack=10:release=200,
vibrato=f=4:d=0.02`}
          </pre>
        </section>

        {/* Section: Disclaimer */}
        <section className="mb-12">
          <div className="flex items-baseline gap-4 mb-4">
            <span className="font-display ink-offset text-6xl text-accent leading-none">
              04
            </span>
            <h2 className="font-display text-2xl text-ink">
              注意事項
              <span className="block font-mono text-xs text-ink-dim mt-1">
                Disclaimer
              </span>
            </h2>
          </div>
          <p className="font-body text-base mb-2">
            このプロジェクトは非公式ファンメイドです。EARN-A-ROCK / ZUTOMAYO
            とは一切関係ありません。
          </p>
          <p className="font-mono text-sm text-ink-dim">
            This project is an unofficial fanmade work. It is not affiliated
            with, endorsed by, or sponsored by EARN-A-ROCK / ZUTOMAYO. All
            card artwork is property of the original rights-holders and is
            used here solely for fan-project purposes. If you are a
            rights-holder and would like any asset removed, please open an
            issue on the repository.
          </p>
        </section>
      </div>
    </main>
  )
}
