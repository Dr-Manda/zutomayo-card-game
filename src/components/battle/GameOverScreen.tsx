'use client'

import { useEffect } from 'react'
import StampBadge from '@/components/StampBadge'
import { useSfx } from '@/components/SfxProvider'

export interface GameOverScreenProps {
  /** Index of the winning player, or null on a draw. */
  winner: 0 | 1 | null
  /** True when the winner controls the night side. Drives the half-disk indicator. */
  winnerIsNight: boolean
  /** Fires when the user wants another match — parent should reset useGame. */
  onReplay: () => void
}

/**
 * GameOverScreen — endgame outcome view.
 *
 * Three vertical sections:
 *
 *   1. Big "GAME OVER" stamp (fill-ink).
 *   2. Winner indicator: a circular night/day half-disk (riso teal vs.
 *      riso pink) over a bilingual "Player N wins" label.
 *   3. Two action stamps — replay (accent fill) + back to menu (outline
 *      href="/").
 *
 * No emoji per design system — the half-disk reads the same visual
 * idea (sun vs. moon, day vs. night) in the riso palette instead.
 */
export default function GameOverScreen({
  winner,
  winnerIsNight,
  onReplay,
}: GameOverScreenProps) {
  // Draws — same disk split in half so neither side dominates.
  const isDraw = winner === null

  // Endgame sting cue on mount.
  const { play } = useSfx()
  useEffect(() => {
    play('sting-end')
  }, [play])

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center gap-8">
        {/* ─── Headline ───────────────────────────────────────────── */}
        <StampBadge
          size="xl"
          variant="fill-ink"
          offset
          jp="ゲーム終了"
          en="GAME OVER"
        />

        {/* ─── Winner indicator (half-disk) ───────────────────────── */}
        <div className="flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className="card-isolate border-2 border-ink"
            style={{
              width: 96,
              height: 96,
              // Day = pink semicircle on the right; Night = teal on the right.
              // Drawn via inline conic-style background so we don't rely on
              // gradients (chrome rule). For draw we split horizontally pink/teal.
              background: isDraw
                ? 'linear-gradient(90deg, var(--color-accent) 0% 50%, var(--color-night) 50% 100%)'
                : winnerIsNight
                  ? 'linear-gradient(180deg, var(--color-night) 0% 50%, var(--color-paper-deep) 50% 100%)'
                  : 'linear-gradient(180deg, var(--color-accent) 0% 50%, var(--color-paper-deep) 50% 100%)',
            }}
          />

          {isDraw ? (
            <StampBadge size="md" variant="outline" jp="引き分け" en="DRAW" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="font-display text-2xl text-ink ink-offset leading-none">
                プレイヤー {winner + 1} の勝利！
              </p>
              <p className="font-mono text-xs text-ink-dim">
                PLAYER {winner + 1} WINS · {winnerIsNight ? 'NIGHT SIDE' : 'DAY SIDE'}
              </p>
            </div>
          )}
        </div>

        {/* ─── Actions ────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <StampBadge
            size="lg"
            variant="fill-accent"
            jp="もう一回"
            en="PLAY AGAIN"
            onClick={onReplay}
          />
          <StampBadge
            size="lg"
            variant="outline"
            href="/"
            jp="メニュー"
            en="MENU"
          />
        </div>
      </div>
    </main>
  )
}
