'use client'

import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { Card } from '@/types/game'
import CardView from '@/components/CardView'
import StampBadge from '@/components/StampBadge'
import { useSfx } from '@/components/SfxProvider'

export interface RevealScreenProps {
  p0Card: Card | null
  p1Card: Card | null
  chronosPosition: number
  /** Fires when the user taps the start-battle stamp. */
  onContinue: () => void
}

/**
 * RevealScreen — first-turn pre-battle reveal.
 *
 * Shown once after both players have completed initial placement.
 * The two battle-zone cards slide in from opposite sides (P1 from the
 * left, P2 from the right), the headline drops in afterwards, then
 * the "Start Battle" stamp appears underneath.
 *
 * Pure presentation — no state, just three Framer-Motion entries
 * driven off the same mount.
 */
export default function RevealScreen({
  p0Card,
  p1Card,
  chronosPosition,
  onContinue,
}: RevealScreenProps) {
  const { play } = useSfx()

  // Single flip cue on mount — the two cards swing in at the same time so a
  // single sample stays in sync with the visual.
  useEffect(() => {
    play('card-flip')
  }, [play])

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center gap-8">
        {/* ─── Headline — slides down + fades in after cards ──────── */}
        <motion.h2
          className="font-display text-3xl text-ink ink-offset leading-none"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
        >
          嫌！/ Reveal!
        </motion.h2>

        {/* ─── Two battle cards, sliding from opposite sides ──────── */}
        <div className="flex gap-4 items-start justify-center w-full">
          {/* P1 — enters from the left */}
          <motion.div
            className="flex flex-col items-center gap-2"
            style={{ width: 'min(40vw, 234px)' }}
            initial={{ x: -120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <StampBadge size="xs" variant="outline" jp="P1" en="PLAYER 1" />
            {p0Card ? (
              <CardView card={p0Card} chronosPosition={chronosPosition} className="!w-full" />
            ) : (
              <EmptySlot />
            )}
          </motion.div>

          {/* P2 — enters from the right */}
          <motion.div
            className="flex flex-col items-center gap-2"
            style={{ width: 'min(40vw, 234px)' }}
            initial={{ x: 120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <StampBadge size="xs" variant="outline" jp="P2" en="PLAYER 2" />
            {p1Card ? (
              <CardView card={p1Card} chronosPosition={chronosPosition} className="!w-full" />
            ) : (
              <EmptySlot />
            )}
          </motion.div>
        </div>

        {/* ─── Continue stamp — last to appear ────────────────────── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.75, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <StampBadge
            size="lg"
            variant="fill-accent"
            jp="バトル開始"
            en="START BATTLE"
            onClick={onContinue}
          />
        </motion.div>
      </div>
    </main>
  )
}

/** Dashed placeholder used when a battle zone is empty — typically because
 *  the player placed a non-Character face-down and it has been flipped to
 *  power-charger/abyss per the official prep step 9. */
function EmptySlot() {
  return (
    <div className="flex w-full aspect-[234/328] flex-col items-center justify-center gap-1 border-2 border-dashed border-ink-secondary bg-paper-deep font-mono text-[10px] text-ink-dim text-center px-1">
      <span>空 / EMPTY</span>
      <span className="opacity-70">パワー/アビスへ / sent to power/abyss</span>
    </div>
  )
}
