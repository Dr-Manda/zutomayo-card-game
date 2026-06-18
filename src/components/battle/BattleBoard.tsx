'use client'

import { useEffect, useRef } from 'react'
import type { GameState, TurnPhase } from '@/types/game'
import { getMatImagePath } from '@/lib/cardAssets'
import { getTimePhase } from '@/lib/chronos'
import ChronosCorner from '@/components/ChronosCorner'
import PlayerField from '@/components/PlayerField'
import StampBadge from '@/components/StampBadge'
import { useSfx } from '@/components/SfxProvider'

export interface BattleBoardProps {
  gameState: GameState
  /** Fires when the user taps the centered phase stamp. */
  onAdvancePhase: () => void
  /** When true, the advance-phase stamp is disabled (e.g. while battle anim plays). */
  busy?: boolean
  /** Fires when the user taps the QUIT stamp. Parent owns the confirm overlay. */
  onQuit?: () => void
}

/** Phase → bilingual button label. */
const PHASE_LABELS: Record<TurnPhase, { ja: string; en: string }> = {
  game_start:           { ja: 'ゲーム開始',  en: 'GAME START' },
  set_cards:            { ja: 'カードセット', en: 'SET CARDS' },
  reveal_cards:         { ja: 'カード公開',  en: 'REVEAL' },
  advance_time:         { ja: '時間経過',   en: 'ADVANCE TIME' },
  replace_character:    { ja: 'キャラ交代',  en: 'REPLACE CHARACTER' },
  replace_area_enchant: { ja: 'エリア交代',  en: 'REPLACE AREA' },
  process_effects:      { ja: '効果処理',   en: 'PROCESS EFFECTS' },
  battle:               { ja: 'バトル！',   en: 'BATTLE!' },
  end_turn:             { ja: 'ターン終了',  en: 'END TURN' },
  pass_device:          { ja: 'デバイス交換', en: 'PASS DEVICE' },
  game_over:            { ja: 'ゲーム終了',  en: 'GAME OVER' },
}

/**
 * BattleBoard — the main two-player table view.
 *
 * Layout (top → bottom):
 *
 *   ┌──────────────── ChronosCorner (fixed top-right) ───────────────┐
 *   │  Turn stamp + Day/Night phase stamp                            │
 *   │  ─── PlayerField (P1, mirrored — closest edge is battle row)  │
 *   │  ─── Halftone divider band                                    │
 *   │  ─── Phase action stamp (the only interactive control)        │
 *   │  ─── PlayerField (P2, normal orientation)                     │
 *   │  ─── Game log panel (last 5 messages)                         │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * The board sits on a riso mat image at 18% / multiply so the texture
 * shows but the UI chrome stays legible. ChronosCorner renders fixed
 * (z-30) — its absolute positioning is handled inside the component.
 */
export default function BattleBoard({
  gameState,
  onAdvancePhase,
  busy = false,
  onQuit,
}: BattleBoardProps) {
  const timePhase = getTimePhase(gameState.chronosPosition)
  const phaseLabel = PHASE_LABELS[gameState.currentPhase] ?? { ja: '', en: '' }

  // Clock-tick SFX whenever Chronos advances. Skip the initial mount so we
  // don't fire the tick before the user has interacted with anything.
  const { play } = useSfx()
  const prevChronos = useRef<number | null>(null)
  useEffect(() => {
    if (
      prevChronos.current !== null &&
      prevChronos.current !== gameState.chronosPosition
    ) {
      play('clock-tick')
    }
    prevChronos.current = gameState.chronosPosition
  }, [gameState.chronosPosition, play])

  return (
    <main
      className="flex-1 flex flex-col px-2 py-2 max-w-lg mx-auto w-full gap-2 relative"
      style={{
        backgroundImage: `url('${getMatImagePath()}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundBlendMode: 'multiply',
      }}
    >
      {/* Mat image is tinted via blend; the paper underneath is what we layer
          on top via the field components' own card-isolate panels. The 0.18
          opacity comes from a paper-toned overlay layered in via this absolute
          sibling so we don't bleed mix-blend-mode across the page. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-paper"
        style={{ opacity: 0.82 }}
      />

      <div className="relative z-10 flex flex-col gap-2 flex-1">
        {/* ─── ChronosCorner: compact inline on mobile so it can't overlap
             P1's mirrored battle slot; fixed corner on md+ where the board
             has room to one side. ─── */}
        <div className="md:hidden">
          <ChronosCorner position={gameState.chronosPosition} size="compact" />
        </div>
        <div className="hidden md:block">
          <ChronosCorner position={gameState.chronosPosition} corner="top-right" />
        </div>

        {/* ─── Top bar: turn + day/night stamp + quit ─── */}
        <div className="flex items-center justify-between gap-2">
          <StampBadge
            size="xs"
            variant="outline"
            jp={`ターン ${gameState.turnNumber}`}
            en={`TURN ${gameState.turnNumber}`}
          />
          <div className="flex items-center gap-2">
            <StampBadge
              size="xs"
              variant={timePhase === 'night' ? 'fill-night' : 'fill-accent'}
              jp={timePhase === 'night' ? '夜' : '昼'}
              en={timePhase === 'night' ? 'NIGHT' : 'DAY'}
            />
            {onQuit && (
              <StampBadge
                size="xs"
                variant="outline"
                jp="終了"
                en="QUIT"
                onClick={onQuit}
                ariaLabel="Quit or restart this battle"
              />
            )}
          </div>
        </div>

        {/* ─── Player 1 field (mirrored — battle row closest to top) ─── */}
        <PlayerField
          player={gameState.players[0]}
          playerIndex={0}
          isNightPlayer={gameState.nightPlayerIndex === 0}
          chronosPosition={gameState.chronosPosition}
          label="P1"
          mirrored
        />

        {/* ─── Divider + phase action ─── */}
        <div className="my-1 flex flex-col items-stretch gap-1">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 halftone-pink" aria-hidden="true" />
            <StampBadge
              size="md"
              variant="fill-accent"
              jp={phaseLabel.ja}
              en={phaseLabel.en}
              onClick={onAdvancePhase}
              disabled={busy}
            />
            <div className="h-2 flex-1 halftone-pink" aria-hidden="true" />
          </div>
          {/* Transient single-line caption mirroring the most recent log entry.
              Keyed on log length so re-mount triggers the slide-up cue every tap. */}
          {gameState.log.length > 0 && (
            <p
              key={gameState.log.length}
              className="animate-slide-up text-center font-mono text-[10px] text-ink-dim px-2 truncate"
            >
              {gameState.log[gameState.log.length - 1]}
            </p>
          )}
        </div>

        {/* ─── Player 2 field (normal orientation) ─── */}
        <PlayerField
          player={gameState.players[1]}
          playerIndex={1}
          isNightPlayer={gameState.nightPlayerIndex === 1}
          chronosPosition={gameState.chronosPosition}
          label="P2"
        />

        {/* ─── Game log ─── */}
        <div className="card-isolate border-2 border-ink bg-paper-deep p-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink-dim mb-1">
            ログ / LOG
          </p>
          {/* aria-live="polite" + atomic=false so appended <li> entries are
              announced as additions to the log, not as a full re-read every
              update. Screen-reader users get the same per-resolution feedback
              that sighted players get from the transient caption above. */}
          <ul
            className="hairline-list flex flex-col"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions"
          >
            {gameState.log.slice(-5).map((msg, i) => (
              <li
                key={`${i}-${msg.slice(0, 10)}`}
                className="font-mono text-[10px] text-ink-secondary py-0.5"
              >
                {msg}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
