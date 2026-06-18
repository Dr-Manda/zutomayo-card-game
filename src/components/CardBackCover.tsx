'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import StampBadge from './StampBadge'
import { useSfx } from './SfxProvider'
import { getCardBackPath } from '@/lib/cardAssets'

export interface CardBackCoverProps {
  /** When true the overlay is shown over everything. */
  active: boolean
  /** Bilingual label for the next player, e.g. "プレイヤー 2 / Player 2". */
  nextPlayerLabel: string
  /** Reserved for future night/day theming differences. */
  isNightPlayer?: boolean
  /** Fires when the next player taps the stack (or backdrop). */
  onReady: () => void
}

/**
 * Fan offsets for the 7-card stack — center card on top, neighbors fan out
 * symmetrically. Rotation ±8°, ±16°, ±24°; small vertical lift on outer cards
 * so the fan reads as an arc rather than a straight strip.
 */
const FAN_OFFSETS: Array<{ x: number; y: number; r: number }> = [
  { x: -120, y: 10, r: -24 },
  { x: -80, y: 4, r: -16 },
  { x: -40, y: 1, r: -8 },
  { x: 0, y: 0, r: 0 },
  { x: 40, y: 1, r: 8 },
  { x: 80, y: 4, r: 16 },
  { x: 120, y: 10, r: 24 },
]

/**
 * CardBackCover — pass-and-play handoff cover.
 *
 * Replaces the old PassScreen. When `active` flips true, a full-screen
 * teal-overprint backdrop fades in, a stamp slides up announcing the next
 * player, and a fanned stack of seven card-backs rises from below the
 * viewport. Tapping anywhere on the overlay calls `onReady`, which the
 * caller uses to clear `active` and reveal the next player's hand.
 */
export default function CardBackCover({
  active,
  nextPlayerLabel,
  onReady,
}: CardBackCoverProps) {
  const { play } = useSfx()
  const btnRef = useRef<HTMLButtonElement | null>(null)
  // StrictMode dev double-mounts the effect, which would stack two
  // overlapping flip cues per overlay raise. Latch on the active→true
  // edge, reset on active→false.
  const firedRef = useRef(false)

  // Mount-time flip cue when the overlay raises.
  useEffect(() => {
    if (!active) {
      firedRef.current = false
      return
    }
    if (firedRef.current) return
    firedRef.current = true
    play('card-flip')
  }, [active, play])

  // Move keyboard focus onto the cover button so a keyboard-only player can
  // tap-to-reveal with Enter/Space. Without this they're stranded — the cover
  // is the only thing on screen during every device handoff (multiple times per
  // turn) and there was no focused control.
  useEffect(() => {
    if (active) btnRef.current?.focus()
  }, [active])

  // Wrap the tap-to-reveal so we hear the card-set thunk before the overlay
  // unmounts.
  const handleReady = () => {
    play('card-set')
    onReady()
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="cardback-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ backgroundColor: 'rgb(10,62,116)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Real button overlaying the full backdrop so keyboard users can
              focus + Enter/Space to advance, and screen readers get an
              announced actionable control instead of a styled div. */}
          <button
            ref={btnRef}
            type="button"
            onClick={handleReady}
            aria-label={`${nextPlayerLabel} — tap to reveal`}
            className="stamp-reset absolute inset-0 z-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-paper"
          />
          {/* Stamp announcing the next player. xl size auto-applies ink-offset
              to the JP via StampBadge's internal handling. The wrapper is
              pointer-events-none so clicks reach the underlying button, and
              aria-hidden so the button's aria-label is the single announced
              control (otherwise screen readers read the player label twice). */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.28,
              delay: 0.05,
              ease: [0.22, 0.61, 0.36, 1],
            }}
            className="mb-8 relative z-10 pointer-events-none"
            aria-hidden="true"
          >
            <StampBadge
              size="xl"
              variant="outline"
              offset
              jp={nextPlayerLabel}
              en="NEXT PLAYER · TAP TO REVEAL"
            />
          </motion.div>

          {/* Fanned card-back stack — each card absolutely positioned and
              translated/rotated into its fan slot. */}
          <div
            className="relative z-10 pointer-events-none"
            style={{ width: 280, height: 200 }}
            aria-hidden="true"
          >
            {FAN_OFFSETS.map((offset, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 border-2 border-ink overflow-hidden rounded-[10px]"
                style={{
                  width: 80,
                  height: 112,
                  boxShadow: '2px 3px 0 rgba(26,26,26,0.25)',
                  transformOrigin: 'center center',
                }}
                initial={{
                  x: '-50%',
                  y: '300%',
                  rotate: offset.r,
                  opacity: 0,
                }}
                animate={{
                  x: `calc(-50% + ${offset.x}px)`,
                  y: `calc(-50% + ${offset.y}px)`,
                  rotate: offset.r,
                  opacity: 1,
                }}
                exit={{
                  y: '-50%',
                  opacity: 0,
                  transition: {
                    duration: 0.3,
                    delay: i * 0.04,
                    ease: [0.22, 0.61, 0.36, 1],
                  },
                }}
                transition={{
                  duration: 0.4,
                  delay: 0.1 + i * 0.06,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                <Image
                  src={getCardBackPath()}
                  alt=""
                  width={80}
                  height={112}
                  className="w-full h-full object-cover pointer-events-none select-none"
                  draggable={false}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
