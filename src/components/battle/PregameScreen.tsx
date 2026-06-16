'use client'

import StampBadge from '@/components/StampBadge'

export interface PregameScreenProps {
  /** Fires when the user taps the start stamp. */
  onStart: () => void
}

/**
 * PregameScreen — the lobby / "press start" view shown before {@link
 * import('@/hooks/useGame').useGame} ever produces a `gameState`.
 *
 * Layout is a vertical stack centered in the viewport:
 *
 *   1. "対戦 / Battle" identity stamp (outline, large).
 *   2. Bilingual tagline explaining the mode.
 *   3. The big accent-filled "START GAME" StampBadge that fires `onStart`.
 *   4. A back-to-menu link rendered as an outline stamp pointing at `/`.
 *
 * No state is owned here — the parent dispatcher handles the actual game
 * boot via `useGame().startGame()`.
 */
export default function PregameScreen({ onStart }: PregameScreenProps) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* ─── Identity stamp ──────────────────────────────────────── */}
        <StampBadge
          size="xl"
          variant="outline"
          offset
          jp="対戦"
          en="BATTLE"
        />

        {/* ─── Tagline ────────────────────────────────────────────── */}
        <p className="font-mono text-xs text-ink-dim max-w-xs leading-relaxed">
          ランダムデッキで2人対戦
          <br />
          RANDOM DECK · 2-PLAYER
        </p>

        {/* ─── Primary action ─────────────────────────────────────── */}
        <StampBadge
          size="xl"
          variant="fill-accent"
          jp="ゲーム開始"
          en="START GAME"
          onClick={onStart}
        />

        {/* ─── Back to menu ───────────────────────────────────────── */}
        <StampBadge
          size="sm"
          variant="outline"
          href="/"
          jp="戻る"
          en="← BACK"
        />
      </div>
    </main>
  )
}
