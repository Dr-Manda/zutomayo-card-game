'use client'

import type { Card } from '@/types/game'
import HandDrawer from '@/components/HandDrawer'
import StampBadge from '@/components/StampBadge'

export interface MulliganScreenProps {
  playerIndex: 0 | 1
  isNightPlayer: boolean
  hand: Card[]
  /** Fires with the indices of cards the player wants to redraw. */
  onConfirm: (indices: number[]) => void
  /** Fires when the player chooses to keep their entire hand. */
  onSkip: () => void
}

/**
 * MulliganScreen — single-player mulligan view.
 *
 * Renders a player-identity stamp (night/day variant) above a
 * HandDrawer configured for multi-select (max 5 — the full hand).
 * The dispatcher decides per-player which one to mount; this
 * component is intentionally agnostic about turn order.
 */
export default function MulliganScreen({
  playerIndex,
  isNightPlayer,
  hand,
  onConfirm,
  onSkip,
}: MulliganScreenProps) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-4">
      {/* ─── Player identity ─────────────────────────────────────── */}
      <StampBadge
        size="md"
        variant={isNightPlayer ? 'fill-night' : 'fill-accent'}
        jp={`プレイヤー ${playerIndex + 1}`}
        en={isNightPlayer ? 'NIGHT SIDE' : 'DAY SIDE'}
      />

      {/* ─── Instructions visible BEFORE the drawer opens ─────────── */}
      <div className="flex flex-col items-center gap-1 text-center max-w-md">
        <h2 className="font-display text-2xl text-ink ink-offset leading-none">
          マリガン / Mulligan
        </h2>
        <p className="font-mono text-xs text-ink-dim">
          交換するカードを選んでください / Select cards to redraw — once only
        </p>
      </div>

      {/* ─── Hand drawer (full mulligan: up to all 5 cards) ──────── */}
      <HandDrawer
        hand={hand}
        maxSelections={5}
        minSelections={0}
        initialExpanded
        onConfirm={onConfirm}
        onSkip={onSkip}
        title="マリガン / Mulligan"
        subtitle="交換するカードを選んでください / Select cards to redraw"
        confirmLabel="交換 / Redraw"
        skipLabel="このまま / Keep All"
      />
    </main>
  )
}
