'use client'

import type { PlayerState } from '@/types/game'
import { calculateTotalPower } from '@/lib/gameEngine'
import CardView from './CardView'
import StampBadge from './StampBadge'

export interface PlayerFieldProps {
  player: PlayerState
  playerIndex: 0 | 1
  isNightPlayer: boolean
  chronosPosition: number
  label: string
  /** When true, the zone row sits at the top with HP/header at the bottom
   *  (opponent layout). Card artwork stays right-side-up — only spatial
   *  arrangement mirrors so both players can still read text. */
  mirrored?: boolean
}

/**
 * PlayerField — renders one player's table-side: header (identity + power
 * + deck), HP bar, battle zone + three set zones (A, B, C/Area), and a
 * footer with charger/abyss counts.
 *
 * Two variants:
 *  - Default (mirrored=false): header → hp → zones → footer.
 *  - Mirrored (mirrored=true): zones → footer → hp → header, with the
 *    zone row reversed so the battle slot sits closest to the table edge
 *    nearest the opposing player.
 */
export default function PlayerField({
  player,
  isNightPlayer,
  chronosPosition,
  label,
  mirrored = false,
}: PlayerFieldProps) {
  const totalPower = calculateTotalPower(player)

  // HP color tiers — teal (calm), pink (warning), danger (red) at <=30.
  const hpFillClass =
    player.hp > 60 ? 'bg-night' : player.hp > 30 ? 'bg-accent' : 'bg-danger'

  // ---- Header (identity badge + PWR/DECK stats) ----
  const Header = (
    <div className="flex items-center justify-between mb-2">
      <StampBadge
        size="xs"
        variant={isNightPlayer ? 'fill-night' : 'fill-accent'}
        jp={label}
        en={isNightPlayer ? 'NIGHT SIDE' : 'DAY SIDE'}
      />
      <div className="flex gap-3 font-mono text-xs">
        <span className="text-ink-dim">
          PWR{' '}
          <span className="font-numeric font-bold text-ink">{totalPower}</span>
        </span>
        <span className="text-ink-dim">
          DECK{' '}
          <span className="font-numeric font-bold text-ink">
            {player.deck.length}
          </span>
        </span>
      </div>
    </div>
  )

  // ---- HP Bar ----
  const HPBar = (
    <div className="mb-3">
      <div className="flex justify-between font-mono text-xs mb-0.5">
        <span className="text-ink-dim">HP</span>
        <span className="font-numeric font-bold text-ink">
          {player.hp}/100
        </span>
      </div>
      <div className="h-2 bg-paper-deep border border-ink">
        <div
          className={`h-full ${hpFillClass} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, player.hp))}%` }}
        />
      </div>
    </div>
  )

  // ---- Zone slots — battle + A/B/C in a 4-col grid so cards scale to fit the
  //      container width instead of overflowing past it. The mirrored variant
  //      preserves the spatial flip via dir="rtl" on the grid wrapper, which
  //      reverses column order without disturbing the cell contents. ----
  const ZoneRow = (
    <div
      className="grid grid-cols-4 gap-2 items-start"
      dir={mirrored ? 'rtl' : 'ltr'}
    >
      {/* Battle zone */}
      <div className="flex flex-col items-center gap-1" dir="ltr">
        <StampBadge size="xs" variant="outline" jp="バトル" en="BATTLE" />
        {player.battleZone ? (
          <CardView
            card={player.battleZone}
            chronosPosition={chronosPosition}
            compact
            className="!w-full"
          />
        ) : (
          <div className="flex w-full aspect-[234/328] items-center justify-center border-2 border-dashed border-ink-secondary bg-paper-deep font-mono text-[10px] text-ink-dim">
            空 / EMPTY
          </div>
        )}
      </div>

      {/* Set zones A, B, C(Area) */}
      {(['a', 'b', 'c'] as const).map((slot) => {
        const card = player.setZone[slot]
        const isArea = slot === 'c'
        const jp = isArea ? 'エリア' : `セット${slot.toUpperCase()}`
        const en = isArea ? 'AREA' : `SET ${slot.toUpperCase()}`
        return (
          <div key={slot} className="flex flex-col items-center gap-1" dir="ltr">
            <StampBadge size="xs" variant="outline" jp={jp} en={en} />
            {card ? (
              <CardView card={card} compact className="!w-full" />
            ) : (
              <div className="flex w-full aspect-[234/328] items-center justify-center border-2 border-dashed border-ink-secondary bg-paper-deep font-mono text-[10px] text-ink-dim">
                {slot.toUpperCase()}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ---- Footer (charger / abyss counts) ----
  const Footer = (
    <div className="mt-2 flex gap-3 font-mono text-xs text-ink-dim">
      <span>
        パワー / Charger:{' '}
        <span className="font-numeric font-bold text-ink">
          {player.powerCharger.length}
        </span>
      </span>
      <span>
        アビス / Abyss:{' '}
        <span className="font-numeric font-bold text-ink">
          {player.abyss.length}
        </span>
      </span>
    </div>
  )

  return (
    <div
      className="card-isolate border-2 border-ink bg-paper-deep p-3 transition-colors duration-300"
      data-mirrored={mirrored ? 'true' : 'false'}
    >
      {mirrored ? (
        <>
          {ZoneRow}
          {Footer}
          <div className="mt-3">{HPBar}</div>
          {Header}
        </>
      ) : (
        <>
          {Header}
          {HPBar}
          {ZoneRow}
          {Footer}
        </>
      )}
    </div>
  )
}
