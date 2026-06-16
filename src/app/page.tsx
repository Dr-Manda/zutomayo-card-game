'use client'

import { useEffect, useState } from 'react'
import StampBadge from '@/components/StampBadge'

export default function Home() {
  const [today, setToday] = useState<string>('')

  // Date constructor runs only after mount so the static export doesn't bake
  // build time into the page.
  useEffect(() => {
    const d = new Date()
    const year = d.getFullYear()
    const monthPadded = String(d.getMonth() + 1).padStart(2, '0')
    const dayPadded = String(d.getDate()).padStart(2, '0')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(`${year}.${monthPadded}.${dayPadded}`)
  }, [])

  return (
    <main className="flex-1 min-h-svh flex flex-col">
      <div className="mx-auto w-full max-w-[1248px] flex-1 flex flex-col">
        {/* HERO */}
        <section className="flex flex-col items-center justify-center min-h-[50vh] md:min-h-[60vh] pt-12 md:pt-20">
          <h1
            className="ink-offset font-display text-ink text-center leading-none"
            style={{ fontSize: 'clamp(64px, 18vw, 180px)' }}
          >
            ずとまよ
          </h1>

          {/* Edge-to-edge halftone band. Negative margin breaks out of the
              1248px container; the band itself spans full viewport width. */}
          <div className="relative w-screen left-1/2 -translate-x-1/2 mt-8">
            <div className="relative h-[50px] bg-accent overflow-hidden">
              {/* halftone overlay with multiply for overprint reading */}
              <div
                className="absolute inset-0 halftone-pink-coarse mix-blend-multiply opacity-90"
                aria-hidden
              />
              <div className="relative h-full flex items-center justify-center">
                <span
                  className="font-mono uppercase text-paper text-sm md:text-base"
                  style={{ letterSpacing: '0.3em' }}
                >
                  ZUTOMAYO · CARD · GAME
                </span>
              </div>
            </div>
          </div>

          {/* Date stamp — runtime-formatted on mount */}
          <div
            className="font-numeric font-bold text-ink-dim text-sm mt-6 tracking-wider"
            aria-label="Today's date"
          >
            {today || ' '}
          </div>
        </section>

        {/* MENU */}
        <section className="flex-1 flex flex-col items-center px-4 pt-8 pb-16">
          <nav className="w-full max-w-sm flex flex-col gap-4">
            <div className="w-full [&>a]:w-full [&>a]:flex">
              <StampBadge
                size="lg"
                variant="outline"
                jp="バトル"
                en="BATTLE"
                href="/battle"
              />
            </div>
            <div className="w-full [&>a]:w-full [&>a]:flex">
              <StampBadge
                size="lg"
                variant="outline"
                jp="ギャラリー"
                en="GALLERY"
                href="/gallery"
              />
            </div>
            <div className="w-full [&>a]:w-full [&>a]:flex">
              <StampBadge
                size="lg"
                variant="outline"
                jp="ルール"
                en="RULES"
                href="/rules"
              />
            </div>
          </nav>
        </section>

        {/* FOOTER */}
        <footer className="mt-auto border-t border-ink-secondary">
          <div className="px-4 py-4 text-center">
            <p className="font-mono text-xs text-ink-dim">
              非公式ファンメイド / Unofficial fanmade · not affiliated with EARN-A-ROCK / ZUTOMAYO
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}
