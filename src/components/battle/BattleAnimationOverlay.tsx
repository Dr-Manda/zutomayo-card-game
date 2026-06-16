'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSfx } from '@/components/SfxProvider'

export interface BattleAnimationResult {
  player0Attack: number
  player1Attack: number
  damage: number
  loser: 0 | 1 | null
}

export interface BattleAnimationOverlayProps {
  /** When true, the overlay is mounted and the auto-dismiss timer starts. */
  active: boolean
  /** Snapshot of the battle math to render. Required when `active`. */
  battleResult: BattleAnimationResult | null
  /** Fires after the 1500ms dismiss timer fires. Parent should set `active=false`. */
  onComplete: () => void
}

/**
 * BattleAnimationOverlay — full-screen VS reveal.
 *
 * Renders the two attack totals on either side of a centered "VS" stamp,
 * with the losing-side damage figure beneath in danger-red font-numeric.
 * On draws the damage block is replaced by a neutral "DRAW" stamp.
 *
 * The overlay self-dismisses 1500ms after mount via `setTimeout`, calling
 * `onComplete`. The parent is responsible for actually advancing the
 * engine phase — this component only animates.
 *
 * z-40 sits below CardBackCover (z-50) so a pending pass screen still
 * supersedes a battle anim if both somehow coincide.
 */
export default function BattleAnimationOverlay({
  active,
  battleResult,
  onComplete,
}: BattleAnimationOverlayProps) {
  const { play } = useSfx()

  // SFX cues: impact on raise, follow-up damage tick if someone took damage.
  useEffect(() => {
    if (!active) return
    play('impact')
    const damageId =
      battleResult && battleResult.loser !== null
        ? window.setTimeout(() => play('damage-tick'), 700)
        : null
    return () => {
      if (damageId !== null) window.clearTimeout(damageId)
    }
  }, [active, battleResult, play])

  // Auto-dismiss timer — tied to active so re-mounts restart it.
  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(onComplete, 1500)
    return () => window.clearTimeout(id)
  }, [active, onComplete])

  return (
    <AnimatePresence>
      {active && battleResult && (
        <motion.div
          key="battle-overlay"
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(10,62,116,0.7)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          aria-label="Battle resolution"
        >
          <div className="flex flex-col items-center gap-6">
            {/* ─── VS row ─────────────────────────────────────────── */}
            <div className="flex items-center gap-8">
              <AttackPanel label="P1" attack={battleResult.player0Attack} />
              <motion.span
                className="font-display text-4xl text-paper ink-offset leading-none"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, ease: 'backOut' }}
              >
                VS
              </motion.span>
              <AttackPanel label="P2" attack={battleResult.player1Attack} />
            </div>

            {/* ─── Damage / draw block ────────────────────────────── */}
            {battleResult.loser !== null ? (
              <motion.div
                className="flex flex-col items-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{
                  y: 0,
                  opacity: 1,
                  x: [0, -6, 6, -4, 4, 0],
                }}
                transition={{
                  duration: 0.45,
                  delay: 0.3,
                  ease: 'easeOut',
                }}
              >
                <span className="font-numeric font-bold text-4xl text-danger leading-none">
                  -{battleResult.damage} HP
                </span>
                <span className="font-mono text-xs text-paper/80 mt-1 uppercase tracking-widest">
                  P{battleResult.loser + 1} TAKES DAMAGE
                </span>
              </motion.div>
            ) : (
              <motion.span
                className="font-display text-2xl text-paper ink-offset-tight"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                引き分け / DRAW
              </motion.span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** One side of the VS — player label over a big attack number. */
function AttackPanel({ label, attack }: { label: string; attack: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-xs text-paper/70 uppercase tracking-widest">
        {label}
      </span>
      <motion.span
        className="font-numeric font-bold text-5xl text-paper leading-none"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {attack}
      </motion.span>
    </div>
  )
}
