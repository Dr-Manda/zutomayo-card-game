'use client'

import Image from 'next/image'
import type { Card } from '@/types/game'
import { ATTRIBUTE_COLORS, ATTRIBUTE_EN, RARITY_COLORS } from '@/lib/theme'
import { getLocalCardPath, getCardBackPath } from '@/lib/cardAssets'
import { getTimePhase } from '@/lib/chronos'
import StampBadge from './StampBadge'

export interface CardViewProps {
  card: Card
  faceDown?: boolean
  selected?: boolean
  compact?: boolean
  /** 0-11 — when provided, overlays the active attack matching night/day phase. */
  chronosPosition?: number
  /** When true AND a power overlay would otherwise render, the overlay shows
   *  0 on a neutral gray background — mirroring the engine's cost-gate rule
   *  「キャラクターのパワーコストが足りていない場合、キャラクターの最終的な攻撃力は０となります」.
   *  Parent must compute `card.cost > calculateTotalPower(player)`. */
  costGated?: boolean
  onClick?: () => void
  className?: string
}

/**
 * CardView — the card display atom.
 *
 * Used everywhere a card needs to appear (gallery grid, hand drawer, battle
 * zones, set zones, previews). Single source of truth for how a card looks.
 *
 * Visual idiom — a hard 2px ink rectangle wrapping a softer artwork window
 * with rounded-[10px] corners. The chrome edge stays dead-flat; the artwork's
 * own corner radius is clipped cleanly by overflow-hidden. The `card-isolate`
 * utility terminates the body's blend modes so the paper grain does not bleed
 * into the artwork.
 */
export default function CardView({
  card,
  faceDown = false,
  selected = false,
  compact = false,
  chronosPosition,
  costGated = false,
  onClick,
  className = '',
}: CardViewProps) {
  const interactive = typeof onClick === 'function'

  // Power overlay derivation — only meaningful for Character cards in a
  // battle context (which we infer from the presence of chronosPosition).
  const timePhase =
    chronosPosition !== undefined ? getTimePhase(chronosPosition) : null
  const activeAttack =
    timePhase === 'night' ? card.night_attack : card.noon_attack
  const showPowerOverlay =
    !faceDown && timePhase !== null && card.class === 'Character'

  const attrColor = ATTRIBUTE_COLORS[card.type]
  const rarityColor = RARITY_COLORS[card.rare]

  // Chrome border — accent (pink) when selected, ink otherwise. ZERO radius.
  const borderClass = selected ? 'border-2 border-accent' : 'border-2 border-ink'

  // Hover lift only when interactive. Shadow transitions are handled by
  // inline style + mouse handlers so we can animate transform + shadow
  // together with the same easing curve.
  const motionClass = interactive
    ? 'cursor-pointer transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-[10px]'
    : 'transition-[transform,box-shadow] duration-300 ease-out'

  // Compact mode shrinks to ~70% of nominal width. The aspect ratio is
  // preserved by the inner image container.
  const sizeClass = compact ? 'w-[164px]' : 'w-[234px]'

  const defaultShadow = '0 5px 20px rgba(0,0,0,0.15)'
  const hoverShadow = '0 15px 40px rgba(0,0,0,0.25)'

  const inner = (
    <>
      {/* Artwork window — rounded-[10px] matches the source JPG's baked-in
          corner radius. overflow-hidden clips cleanly inside the hard 2px
          ink frame above. */}
      <div className="relative aspect-[234/328] overflow-hidden rounded-[10px]">
        {faceDown ? (
          <Image
            src={getCardBackPath()}
            alt="Card back"
            width={234}
            height={328}
            className="block h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <Image
            src={getLocalCardPath(card)}
            alt={card.title}
            width={234}
            height={328}
            className="block h-full w-full object-cover"
            draggable={false}
          />
        )}

        {/* Top-left attribute tag — 24x24 colored square w/ attribute kanji.
            Suppressed for face-down and compact (compact relies on the
            artwork alone for identity). */}
        {!faceDown && !compact && (
          <div
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center font-display text-[11px] leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
            style={{ backgroundColor: attrColor }}
            title={`${card.type} / ${ATTRIBUTE_EN[card.type]}`}
            aria-label={`Attribute: ${ATTRIBUTE_EN[card.type]}`}
          >
            {card.type}
          </div>
        )}

        {/* Top-right: selected check takes precedence over rarity stamp.
            We never render both at the same anchor. */}
        {!faceDown && !compact && (
          <div className="absolute right-2 top-2">
            {selected ? (
              <StampBadge size="xs" variant="fill-accent" ariaLabel="Selected">
                ✓
              </StampBadge>
            ) : (
              <StampBadge
                size="xs"
                variant="fill-accent"
                ariaLabel={`Rarity ${card.rare}`}
              >
                {card.rare}
              </StampBadge>
            )}
          </div>
        )}

        {/* Power overlay — bottom-center stamp with the attack value that
            matches the current Chronos phase. Tealish (night) or pinkish
            (day) fill, white knockout numerals in Barlow Condensed. When
            `costGated` is true the engine will force this Character's final
            attack to 0 (cost > player power); the stamp renders neutral
            gray with `0` so the visible number matches what calculateBattle
            will actually use. */}
        {showPowerOverlay && (
          <div
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 border-2 border-ink px-3 py-1 font-numeric text-[24px] font-bold leading-none text-white ${
              costGated
                ? 'bg-ink-secondary'
                : timePhase === 'night'
                  ? 'bg-night-deep'
                  : 'bg-accent-deep'
            }`}
            aria-label={
              costGated
                ? `Attack 0 — cost ${card.cost} not paid (printed ${activeAttack})`
                : `${timePhase === 'night' ? 'Night' : 'Day'} attack ${activeAttack}`
            }
          >
            {costGated ? 0 : activeAttack}
          </div>
        )}
      </div>

      {/* Bottom caption strip — title flanked by a tiny rarity color chip.
          Suppressed in compact and face-down modes. */}
      {!faceDown && !compact && (
        <div className="flex items-center gap-2 border-t border-ink bg-card-bg px-2 py-1.5">
          <span className="line-clamp-2 flex-1 font-display text-[11px] leading-tight text-ink">
            {card.title}
          </span>
          <span
            className="h-2 w-2 shrink-0"
            style={{ backgroundColor: rarityColor }}
            aria-hidden
          />
        </div>
      )}
    </>
  )

  const containerClass = [
    'card-isolate group relative inline-block',
    sizeClass,
    borderClass,
    motionClass,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // Interactive variant — semantic <button> so the card is keyboard-focusable
  // and announced by AT. stamp-reset strips browser button chrome.
  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`stamp-reset ${containerClass}`}
        aria-label={faceDown ? 'Face-down card' : card.title}
        style={{ boxShadow: defaultShadow }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = hoverShadow
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = defaultShadow
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = hoverShadow
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = defaultShadow
        }}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={containerClass} style={{ boxShadow: defaultShadow }}>
      {inner}
    </div>
  )
}

/**
 * CardMini — convenience wrapper around CardView in compact mode.
 * Preserved as a named export so existing callers (hand counts, small
 * previews, etc.) continue to work without changes.
 */
export function CardMini({
  card,
  onClick,
  selected,
  className,
}: {
  card: Card
  onClick?: () => void
  selected?: boolean
  className?: string
}) {
  return (
    <CardView
      card={card}
      compact
      onClick={onClick}
      selected={selected}
      className={className}
    />
  )
}
