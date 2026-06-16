'use client'

import type { Card } from '@/types/game'
import HandDrawer from '@/components/HandDrawer'
import StampBadge from '@/components/StampBadge'

export interface InitialPlacementScreenProps {
  playerIndex: 0 | 1
  isNightPlayer: boolean
  hand: Card[]
  /** Fires with the chosen hand index. */
  onConfirm: (handIndex: number) => void
}

/**
 * InitialPlacementScreen — pick the starting battle-zone card.
 *
 * Rule prep step 8: 「手札からカードを１枚選びバトルゾーンに裏向きにして置きます」 —
 * ANY card class may be placed face-down. Non-Character reveals are routed to
 * power-charger / abyss inside useGame.placeInitial. This eliminates the
 * zero-Character-hand soft-lock and matches the official strategy surface.
 */
export default function InitialPlacementScreen({
  playerIndex,
  isNightPlayer,
  hand,
  onConfirm,
}: InitialPlacementScreenProps) {
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
          バトルゾーンに置くカード
        </h2>
        <p className="font-mono text-xs text-ink-dim">
          カードを1枚選んでください — 非キャラはめくった時にパワー/アビスへ / Pick any card — non-Characters flip to Power/Abyss
        </p>
      </div>

      {/* ─── Drawer: single-select, any class ────────────────────── */}
      <HandDrawer
        hand={hand}
        maxSelections={1}
        initialExpanded
        onConfirm={(indices) => {
          if (indices.length > 0) onConfirm(indices[0])
        }}
        title="バトルゾーンに置くカード / Place in Battle Zone"
        subtitle="カードを1枚選んでください — 非キャラはめくった時にパワー/アビスへ / Pick any card — non-Characters flip to Power/Abyss"
        confirmLabel="セット / Set"
      />
    </main>
  )
}
