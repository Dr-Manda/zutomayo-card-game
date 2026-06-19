'use client'

import { useState, useCallback } from 'react'
import { GameState, TurnPhase } from '@/types/game'
import {
  initializeGame,
  mulligan,
  placeInitialBattleCard,
  setCardsFromHand,
  advanceTime,
  replaceCharacter,
  replaceAreaEnchant,
  calculateBattle,
  applyBattleDamage,
  endTurn,
  getCardsToSet,
} from '@/lib/gameEngine'
import { applyEffects } from '@/lib/effects'
import { generateRandomDeck } from '@/lib/deckBuilder'

export type GameScreen = 'menu' | 'mulligan' | 'initial_place' | 'playing' | 'game_over'

interface UseGameReturn {
  gameState: GameState | null
  screen: GameScreen
  gameOver: boolean
  startGame: () => void
  performMulligan: (playerIndex: 0 | 1, cardIndices: number[]) => void
  skipMulligan: (playerIndex: 0 | 1) => void
  placeInitial: (playerIndex: 0 | 1, handIndex: number) => void
  setCards: (playerIndex: 0 | 1, selections: { slot: 'a' | 'b'; handIndex: number }[]) => void
  advancePhase: () => void
  cardsToSet: (playerIndex: 0 | 1) => number
}

export function useGame(): UseGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [screen, setScreen] = useState<GameScreen>('menu')
  const [mulliganDone, setMulliganDone] = useState<[boolean, boolean]>([false, false])
  const [initialPlaced, setInitialPlaced] = useState<[boolean, boolean]>([false, false])

  const startGame = useCallback(() => {
    const deck1 = generateRandomDeck()
    const deck2 = generateRandomDeck()
    const nightPlayer = Math.random() < 0.5 ? 0 : 1 as 0 | 1
    const state = initializeGame(deck1, deck2, nightPlayer)
    setGameState(state)
    setMulliganDone([false, false])
    setInitialPlaced([false, false])
    setScreen('mulligan')
  }, [])

  const performMulligan = useCallback((playerIndex: 0 | 1, cardIndices: number[]) => {
    if (!gameState) return
    const newState = mulligan(gameState, playerIndex, cardIndices)
    setGameState(newState)
    const newDone = [...mulliganDone] as [boolean, boolean]
    newDone[playerIndex] = true
    setMulliganDone(newDone)
    if (newDone[0] && newDone[1]) setScreen('initial_place')
  }, [gameState, mulliganDone])

  const skipMulligan = useCallback((playerIndex: 0 | 1) => {
    const newDone = [...mulliganDone] as [boolean, boolean]
    newDone[playerIndex] = true
    setMulliganDone(newDone)
    if (newDone[0] && newDone[1]) setScreen('initial_place')
  }, [mulliganDone])

  const placeInitial = useCallback((playerIndex: 0 | 1, handIndex: number) => {
    if (!gameState) return
    const newState = placeInitialBattleCard(gameState, playerIndex, handIndex)
    setGameState(newState)
    const newPlaced = [...initialPlaced] as [boolean, boolean]
    newPlaced[playerIndex] = true
    setInitialPlaced(newPlaced)
    if (newPlaced[0] && newPlaced[1]) {
      // Rule prep step 9: 「めくられたカードがキャラクター以外のカードなら、すぐに
      // パワーチャージャー/アビスに置きます」 — flip non-Character reveals to their
      // power/abyss destination immediately, leaving an empty battle zone.
      // Also accumulate their clock values into prepClock so the turn-1 advanceTime
      // counts them (「※対戦準備時に、パワーチャージャー/アビスに置いたカードの
      // 時計も含まれます」).
      let state = { ...newState }
      const players = [...state.players] as [import('@/types/game').PlayerState, import('@/types/game').PlayerState]
      let prepClock = 0
      for (let i = 0; i < 2; i++) {
        const p = { ...players[i] }
        const card = p.battleZone
        if (card && card.class !== 'Character') {
          if (card.power > 0) p.powerCharger = [...p.powerCharger, card]
          else p.abyss = [...p.abyss, card]
          p.battleZone = null
          prepClock += card.clock
          players[i] = p
        }
      }
      state = { ...state, players, turnNumber: 1, currentPhase: 'advance_time' as TurnPhase }
      state = advanceTime(state, { prepClock })
      state = { ...state, currentPhase: 'replace_character' as TurnPhase }
      setGameState(state)
      setScreen('playing')
    }
  }, [gameState, initialPlaced])

  const setCardsAction = useCallback((
    playerIndex: 0 | 1,
    selections: { slot: 'a' | 'b'; handIndex: number }[]
  ) => {
    // Functional update so the latest queued state is the base — critical
    // because when P2 sets we ALSO consume the dead `set_cards → advance_time`
    // transition in the same updater. If we used the value form, a subsequent
    // advancePhase() (closed over the pre-set state) would silently overwrite
    // P2's set zone + cardsPlayedThisTurn increment + hand reduction.
    setGameState(prev => {
      if (!prev) return prev
      const afterSet = setCardsFromHand(prev, playerIndex, selections)
      if (playerIndex === 1) {
        return { ...afterSet, currentPhase: 'advance_time' as TurnPhase }
      }
      return afterSet
    })
  }, [])

  const advancePhase = useCallback(() => {
    if (!gameState) return
    let state = { ...gameState }

    switch (state.currentPhase) {
      case 'advance_time':
        state = advanceTime(state)
        state.currentPhase = 'replace_character'
        break

      case 'replace_character':
        state = replaceCharacter(state, 0)
        state = replaceCharacter(state, 1)
        state.currentPhase = 'replace_area_enchant'
        break

      case 'replace_area_enchant':
        state = replaceAreaEnchant(state, 0)
        state = replaceAreaEnchant(state, 1)
        // Wave 4.1 — process_effects is now live, so route through it. The
        // dispatcher unconditionally takes this branch; the tap that follows
        // resolves effects from the priority player's side first.
        state.currentPhase = 'process_effects'
        break

      case 'process_effects':
        // Wave 4.1 — resolve effects on both players' cards in chronos
        // priority order. applyEffects gates each card on its cost (rule:
        // パワーコストが足りていない場合、効果は発動しません) and short
        // -circuits the queue if any HP hits 0 (rule: どちらかのHPが０に
        // なった瞬間にゲームは終了します). The state returned may already
        // carry currentPhase='game_over'; the post-switch override below
        // routes to GameOverScreen accordingly.
        state = applyEffects(state)
        if (state.currentPhase !== 'game_over') {
          state.currentPhase = 'battle'
        }
        break

      case 'battle': {
        const result = calculateBattle(state)
        state = applyBattleDamage(state, result)
        state.currentPhase = 'end_turn'
        break
      }

      case 'end_turn':
        state = endTurn(state)
        // endTurn assigns currentPhase ('set_cards' or 'game_over').
        // The dispatcher pivots to 'set_p1' subScreen on this transition.
        break

      case 'set_cards':
        // Both players set is the only way to leave this state, and that
        // flow advances the engine straight to advance_time (no reveal tap —
        // the shared board already shows both sets when you arrive at it).
        state.currentPhase = 'advance_time'
        break

      case 'reveal_cards':
        // Vestigial — kept so an older saved state can still flow forward.
        state.currentPhase = 'advance_time'
        break

      default:
        break
    }

    // Centralized game-over transition: any phase that produced a winner
    // (via applyBattleDamage today, or any future damage-dealing phase)
    // overrides whatever next-phase the case-arm chose.
    if (
      state.currentPhase === 'game_over' ||
      (state.winner !== null && state.winner !== undefined)
    ) {
      state.currentPhase = 'game_over'
      setScreen('game_over')
    }

    setGameState(state)
  }, [gameState])

  // A draw (simultaneous deck-out) is also game-over but leaves winner=null.
  // Gate on the explicit currentPhase so the draw branch reaches GameOverScreen.
  const gameOver =
    gameState?.currentPhase === 'game_over' ||
    (gameState?.winner !== null && gameState?.winner !== undefined)

  const cardsToSetFn = useCallback((playerIndex: 0 | 1) => {
    if (!gameState) return 1
    return getCardsToSet(gameState, playerIndex)
  }, [gameState])

  return {
    gameState,
    screen,
    gameOver,
    startGame,
    performMulligan,
    skipMulligan,
    placeInitial,
    setCards: setCardsAction,
    advancePhase,
    cardsToSet: cardsToSetFn,
  }
}
