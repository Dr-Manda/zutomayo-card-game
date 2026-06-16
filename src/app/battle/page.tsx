'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/hooks/useGame'
import { calculateBattle } from '@/lib/gameEngine'
import CardBackCover from '@/components/CardBackCover'
import PregameScreen from '@/components/battle/PregameScreen'
import MulliganScreen from '@/components/battle/MulliganScreen'
import InitialPlacementScreen from '@/components/battle/InitialPlacementScreen'
import RevealScreen from '@/components/battle/RevealScreen'
import SetCardsScreen from '@/components/battle/SetCardsScreen'
import GameOverScreen from '@/components/battle/GameOverScreen'
import BattleBoard from '@/components/battle/BattleBoard'
import StampBadge from '@/components/StampBadge'
import BattleAnimationOverlay, {
  type BattleAnimationResult,
} from '@/components/battle/BattleAnimationOverlay'

/**
 * Battle sub-screen identifiers.
 *
 * The `pass_to_*` states are *opaque handoff overlays*. While one is active
 * the dispatcher renders ONLY CardBackCover — never the underlying screen —
 * because P1's hand fan in HandDrawer is face-up readable, and even a 60%
 * opacity wash leaked it. The fully-opaque cover is the ground truth.
 *
 * P2→P1 transitions (after P2 mulligan, after end-of-turn tap) ALSO need
 * pass covers; otherwise P2's tap immediately exposes P1's hand on the
 * device they're holding.
 */
type BattleSubScreen =
  | 'pregame'
  | 'mulligan_p1' | 'pass_to_p2_mulligan' | 'mulligan_p2' | 'pass_to_p1_initial'
  | 'initial_p1' | 'pass_to_p2_initial' | 'initial_p2'
  | 'reveal'
  | 'set_p1'      | 'pass_to_p2_set'      | 'set_p2'    | 'pass_to_p1_set'
  | 'phase_flow'
  | 'game_over'

/**
 * BattlePage — thin state-machine dispatcher.
 *
 * Owns the {@link BattleSubScreen} machine, mounts the appropriate
 * sub-screen, and overlays CardBackCover / BattleAnimationOverlay on
 * top when their triggers are active. All actual game logic happens
 * inside the `useGame()` hook.
 *
 * Quirks worth knowing:
 *
 *  - Pass screens are layered, not replaced. While `passActive`, we
 *    render the prior screen *and* CardBackCover; tapping the cover
 *    transitions to the next non-pass state.
 *  - Replay is implemented by remounting the hook via a `replayKey`
 *    state — incrementing it forces a fresh useGame instance.
 *  - The battle phase has a pre-step: we snapshot `calculateBattle`
 *    *before* calling `advancePhase`, mount the overlay, and only
 *    advance the engine when the overlay fires `onComplete`.
 *  - Game-over is driven by a `useEffect` watching `game.gameOver`
 *    so any future damage-dealing phase also routes here without
 *    bespoke wiring.
 */
export default function BattlePage() {
  const [replayKey, setReplayKey] = useState(0)
  return <BattleSession key={replayKey} onReplay={() => setReplayKey((k) => k + 1)} />
}

/**
 * Inner component — gets remounted by changing `key` from the parent
 * which produces a fresh useGame instance for replay.
 */
function BattleSession({ onReplay }: { onReplay: () => void }) {
  const game = useGame()
  const router = useRouter()
  const {
    gameState,
    gameOver,
    startGame,
    performMulligan,
    skipMulligan,
    placeInitial,
    setCards,
    advancePhase,
    cardsToSet,
  } = game

  const [subScreen, setSubScreen] = useState<BattleSubScreen>('pregame')
  const [battleResult, setBattleResult] = useState<BattleAnimationResult | null>(null)
  const [showAnim, setShowAnim] = useState(false)
  const [showQuit, setShowQuit] = useState(false)

  // Guard against accidental tab close / refresh during an active match —
  // a 20-minute hot-seat game otherwise disappears with one mistaken swipe.
  // No guard once the game is over.
  useEffect(() => {
    const active = gameState && !gameOver
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers ignore returnValue but still require setting it.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [gameState, gameOver])

  // Game-over wins over whatever the local state machine thinks — derived
  // during render so any future damage-dealing phase routes here without
  // a setState-in-effect sync.
  const effectiveSubScreen: BattleSubScreen = gameOver ? 'game_over' : subScreen

  // ─── Transition handlers ───────────────────────────────────────────
  const handleStart = () => {
    startGame()
    setSubScreen('mulligan_p1')
  }

  const handleMulligan = (playerIndex: 0 | 1, indices: number[]) => {
    if (indices.length > 0) performMulligan(playerIndex, indices)
    else skipMulligan(playerIndex)
    // After P1 → cover the hand-off for P2. After P2 → cover the hand-off back
    // to P1 for initial placement.
    setSubScreen(playerIndex === 0 ? 'pass_to_p2_mulligan' : 'pass_to_p1_initial')
  }

  const handlePlaceInitial = (playerIndex: 0 | 1, handIndex: number) => {
    placeInitial(playerIndex, handIndex)
    setSubScreen(playerIndex === 0 ? 'pass_to_p2_initial' : 'reveal')
  }

  const handleSetCards = (playerIndex: 0 | 1, indices: number[]) => {
    if (!gameState) return
    // Engine expects {slot, handIndex} pairs — slot 'a' before 'b' by selection
    // order. Selection beyond two cards is currently capped upstream.
    const selections = indices.map((handIndex, i) => ({
      slot: (i === 0 ? 'a' : 'b') as 'a' | 'b',
      handIndex,
    }))
    setCards(playerIndex, selections)
    if (playerIndex === 0) {
      setSubScreen('pass_to_p2_set')
    } else {
      // Both players have set. The set_cards → advance_time engine transition
      // is folded into setCardsAction's same functional updater (in useGame),
      // so we do NOT call advancePhase here — doing so would close over the
      // pre-set gameState and clobber P2's set zone via batched setGameState.
      setSubScreen('phase_flow')
    }
  }

  /**
   * Phase-advance handler.
   *
   * Branches:
   *   - `battle`   → snapshot result, show overlay, advance on dismiss.
   *   - `end_turn` → advance, then jump to set_p1 for the next turn.
   *   - default    → advance.
   */
  const handleAdvancePhase = () => {
    if (!gameState) return

    if (gameState.currentPhase === 'battle') {
      const result = calculateBattle(gameState)
      setBattleResult({
        player0Attack: result.player0Attack,
        player1Attack: result.player1Attack,
        damage: result.damage,
        loser: result.loser,
      })
      setShowAnim(true)
      // advance is deferred until BattleAnimationOverlay fires onComplete.
      return
    }

    if (gameState.currentPhase === 'end_turn') {
      advancePhase()
      // Whoever just tapped END TURN is holding the device — cover before
      // exposing P1's hand for the next set step.
      setSubScreen('pass_to_p1_set')
      return
    }

    advancePhase()
  }

  /** Called by BattleAnimationOverlay after its 1500ms timer. */
  const handleBattleAnimComplete = () => {
    setShowAnim(false)
    advancePhase()
    // game-over routing is handled by the useEffect above.
  }

  // ─── Pass overlay derivation ───────────────────────────────────────
  const passActive = effectiveSubScreen.startsWith('pass_to_')

  // The target player index for the upcoming screen — drives the label and
  // the night/day theming on the cover. (Previously hardcoded to Player 2,
  // which mislabelled every P2→P1 handoff.)
  const passTargetPlayer: 0 | 1 = effectiveSubScreen.startsWith('pass_to_p2_') ? 1 : 0
  const passLabel = gameState
    ? `プレイヤー ${passTargetPlayer + 1} / Player ${passTargetPlayer + 1}`
    : ''
  const passIsNight = gameState?.nightPlayerIndex === passTargetPlayer
  const handlePassReady = () => {
    if (effectiveSubScreen === 'pass_to_p2_mulligan') setSubScreen('mulligan_p2')
    else if (effectiveSubScreen === 'pass_to_p1_initial') setSubScreen('initial_p1')
    else if (effectiveSubScreen === 'pass_to_p2_initial') setSubScreen('initial_p2')
    else if (effectiveSubScreen === 'pass_to_p2_set') setSubScreen('set_p2')
    else if (effectiveSubScreen === 'pass_to_p1_set') setSubScreen('set_p1')
  }

  // While the pass cover is up we render NOTHING underneath — even a 100%
  // opaque cover renders for a frame during the AnimatePresence fade-in, and
  // the underlying P1 HandDrawer fan is face-up readable. Rendering only a
  // neutral paper background eliminates the leak entirely.
  const underlyingSubScreen: BattleSubScreen = effectiveSubScreen

  // ─── Render ────────────────────────────────────────────────────────

  // Boot: no game state yet → pregame regardless of subScreen value.
  if (!gameState || underlyingSubScreen === 'pregame') {
    return <PregameScreen onStart={handleStart} />
  }

  // Game over wins over everything else.
  if (underlyingSubScreen === 'game_over') {
    return (
      <GameOverScreen
        winner={gameState.winner}
        winnerIsNight={
          gameState.winner !== null && gameState.nightPlayerIndex === gameState.winner
        }
        onReplay={onReplay}
      />
    )
  }

  let body: React.ReactNode = null

  // While the pass cover is up we render a blank paper main underneath so the
  // device shows nothing but the cover during the AnimatePresence fade-in.
  // Critical for hidden-information: the previous P1 hand fan must not leak.
  if (passActive) {
    body = <main className="flex-1" aria-hidden="true" />
  } else if (underlyingSubScreen === 'mulligan_p1' || underlyingSubScreen === 'mulligan_p2') {
    const pi: 0 | 1 = underlyingSubScreen === 'mulligan_p1' ? 0 : 1
    body = (
      <MulliganScreen
        playerIndex={pi}
        isNightPlayer={gameState.nightPlayerIndex === pi}
        hand={gameState.players[pi].hand}
        onConfirm={(indices) => handleMulligan(pi, indices)}
        onSkip={() => handleMulligan(pi, [])}
      />
    )
  } else if (
    underlyingSubScreen === 'initial_p1' ||
    underlyingSubScreen === 'initial_p2'
  ) {
    const pi: 0 | 1 = underlyingSubScreen === 'initial_p1' ? 0 : 1
    body = (
      <InitialPlacementScreen
        playerIndex={pi}
        isNightPlayer={gameState.nightPlayerIndex === pi}
        hand={gameState.players[pi].hand}
        onConfirm={(handIndex) => handlePlaceInitial(pi, handIndex)}
      />
    )
  } else if (underlyingSubScreen === 'reveal') {
    body = (
      <RevealScreen
        p0Card={gameState.players[0].battleZone}
        p1Card={gameState.players[1].battleZone}
        chronosPosition={gameState.chronosPosition}
        onContinue={() => setSubScreen('phase_flow')}
      />
    )
  } else if (underlyingSubScreen === 'set_p1' || underlyingSubScreen === 'set_p2') {
    const pi: 0 | 1 = underlyingSubScreen === 'set_p1' ? 0 : 1
    body = (
      <SetCardsScreen
        playerIndex={pi}
        isNightPlayer={gameState.nightPlayerIndex === pi}
        hand={gameState.players[pi].hand}
        count={cardsToSet(pi)}
        onConfirm={(indices) => handleSetCards(pi, indices)}
      />
    )
  } else if (underlyingSubScreen === 'phase_flow') {
    body = (
      <BattleBoard
        gameState={gameState}
        onAdvancePhase={handleAdvancePhase}
        busy={showAnim}
        onQuit={() => setShowQuit(true)}
      />
    )
  }

  return (
    <>
      {body}

      {/* Pass cover — only relevant when transitioning between P1 and P2 sub-screens. */}
      <CardBackCover
        active={passActive}
        nextPlayerLabel={passLabel}
        isNightPlayer={passIsNight}
        onReady={handlePassReady}
      />

      {/* Battle resolution overlay — z-40, below CardBackCover. */}
      <BattleAnimationOverlay
        active={showAnim}
        battleResult={battleResult}
        onComplete={handleBattleAnimComplete}
      />

      {/* Quit / restart confirm — z-50 paper modal. */}
      {showQuit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10,62,116,0.85)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Quit menu"
        >
          <div className="card-isolate border-2 border-ink bg-paper-deep p-6 flex flex-col items-center gap-4 max-w-sm w-full">
            <h2 className="font-display text-2xl text-ink ink-offset leading-none">
              バトルを終了？
            </h2>
            <p className="font-mono text-xs text-ink-dim text-center">
              QUIT — current battle progress will be lost.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <StampBadge
                size="sm"
                variant="outline"
                jp="続ける"
                en="RESUME"
                onClick={() => setShowQuit(false)}
              />
              <StampBadge
                size="sm"
                variant="fill-accent"
                jp="もう一回"
                en="RESTART"
                onClick={() => { setShowQuit(false); onReplay() }}
              />
              <StampBadge
                size="sm"
                variant="fill-ink"
                jp="メニュー"
                en="MENU"
                onClick={() => { setShowQuit(false); router.push('/') }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
