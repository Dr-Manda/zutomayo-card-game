'use client'

import { useEffect, useRef } from 'react'
import type { Card } from '@/types/game'
import HandDrawer from '@/components/HandDrawer'
import StampBadge from '@/components/StampBadge'

export interface SetCardsScreenProps {
  playerIndex: 0 | 1
  isNightPlayer: boolean
  hand: Card[]
  /** How many cards this player must set this turn (engine-derived). */
  count: number
  /** Fires with the chosen indices once the player confirms. */
  onConfirm: (indices: number[]) => void
}

/**
 * SetCardsScreen — per-turn set-zone selection.
 *
 * HandDrawer in multi-select mode, requiring EXACTLY `count` selections
 * (rule: 「敗北したプレイヤーは…『２枚』」 — fixed counts, not maxima).
 * The min is clamped to the hand size inside HandDrawer to keep an
 * insufficient-hand state survivable; an empty hand auto-continues.
 */
export default function SetCardsScreen({
  playerIndex,
  isNightPlayer,
  hand,
  count,
  onConfirm,
}: SetCardsScreenProps) {
  // Empty hand → no decision to make. Auto-continue with an empty selection
  // so the engine path advances. Guarded by a ref so React 19 StrictMode's
  // double-mount in dev doesn't fire onConfirm twice.
  const autoFired = useRef(false)
  useEffect(() => {
    if (hand.length === 0 && !autoFired.current) {
      autoFired.current = true
      onConfirm([])
    }
  }, [hand.length, onConfirm])

  if (hand.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-4">
        <StampBadge
          size="md"
          variant={isNightPlayer ? 'fill-night' : 'fill-accent'}
          jp={`プレイヤー ${playerIndex + 1}`}
          en={isNightPlayer ? 'NIGHT SIDE' : 'DAY SIDE'}
        />
        <p className="font-mono text-xs text-ink-dim text-center">
          手札なし — 続行 / No cards in hand — continuing…
        </p>
      </main>
    )
  }

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
          カードをセット ({count})
        </h2>
        <p className="font-mono text-xs text-ink-dim">
          セットゾーンに{count}枚置いてください — 最初に選んだカードがバトルゾーンへ / Place exactly {count} card{count === 1 ? '' : 's'} — slot A enters the battle zone
        </p>
      </div>

      {/* ─── Drawer: multi-select; exact count required ──────────── */}
      <HandDrawer
        hand={hand}
        maxSelections={count}
        minSelections={Math.min(count, hand.length)}
        initialExpanded
        onConfirm={onConfirm}
        title={`カードをセット / Set Cards (${count})`}
        subtitle={`セットゾーンに${count}枚置いてください / Place exactly ${count} card(s) in Set Zone`}
        confirmLabel="セット / Set"
      />
    </main>
  )
}
