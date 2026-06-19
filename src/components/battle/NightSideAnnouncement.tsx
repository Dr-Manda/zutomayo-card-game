'use client'

import { motion } from 'motion/react'
import StampBadge from '@/components/StampBadge'

export interface NightSideAnnouncementProps {
  /** 0 or 1 — the seat that just won "night side" via the (currently random)
   *  janken stand-in. The official rule is 「じゃんけんを行い、勝ったプレイ
   *  ヤーは「夜側」のプレイヤーとなります」; until a real janken interaction
   *  lands, the random pick is at least surfaced visibly here so it stops
   *  being secret state. */
  nightPlayerIndex: 0 | 1
  /** Fires when the user taps the "BEGIN" stamp to advance to mulligan_p1. */
  onContinue: () => void
}

/**
 * NightSideAnnouncement — Wave 4.1 sub-task.
 *
 * Shown once between pregame and the first mulligan. The night-side seat is
 * rules-relevant now that the effects engine fires priority-player-first
 * based on chronos phase: the player whose seat side matches the current
 * phase resolves their effects before the other. Hiding the assignment
 * (the prior 50/50 coin flip happened entirely inside `useGame.startGame`
 * with no UI) made priority order arbitrary from the player's POV. This
 * screen makes the assignment visible.
 *
 * Visual idiom matches RevealScreen — centered headline + slide-in stamp +
 * a primary "BEGIN" action below.
 */
export default function NightSideAnnouncement({
  nightPlayerIndex,
  onContinue,
}: NightSideAnnouncementProps) {
  const nightLabel = `プレイヤー ${nightPlayerIndex + 1}`
  const dayLabel = `プレイヤー ${nightPlayerIndex === 0 ? 2 : 1}`

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex flex-col items-center gap-2 text-center"
      >
        <h2 className="font-display text-3xl text-ink ink-offset leading-none">
          夜側決定
        </h2>
        <p className="font-mono text-xs text-ink-dim">
          NIGHT SIDE DECIDED
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex flex-col items-center gap-3"
      >
        <StampBadge
          size="xl"
          variant="fill-night"
          offset
          jp={`${nightLabel} 夜`}
          en={`P${nightPlayerIndex + 1} · NIGHT SIDE`}
        />
        <StampBadge
          size="sm"
          variant="outline"
          jp={`${dayLabel} 昼`}
          en={`P${nightPlayerIndex === 0 ? 2 : 1} · DAY SIDE`}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="flex flex-col items-center gap-1 text-center max-w-xs"
      >
        <p className="font-mono text-[11px] text-ink-dim leading-relaxed">
          クロノス上のメダルがある側から効果を発動します
          <br />
          Effects fire from the side matching the chronos phase
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.3 }}
      >
        <StampBadge
          size="xl"
          variant="fill-accent"
          jp="始める"
          en="BEGIN"
          onClick={onContinue}
        />
      </motion.div>
    </main>
  )
}
