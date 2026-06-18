/**
 * Engine regression tests — one describe block per Wave 1 fix (IMPROVEMENTS.md
 * §1.1–§1.9), plus calculateBattle cost-gating and chronos helpers. The whole
 * engine is pure functions over GameState, so each test builds a minimal
 * fixture, calls one function, and asserts on the returned new state. We never
 * touch cards.json or Math.random unless explicitly stubbed — these tests must
 * be deterministic across machines.
 *
 * Wave 1.8 (CardBackCover pass-cover opacity) is a component-level concern;
 * the Playwright E2E spec covers the visible-handoff regression instead.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  initializeGame,
  drawCards,
  mulligan,
  placeInitialBattleCard,
  setCardsFromHand,
  calculateTotalPower,
  advanceTime,
  replaceCharacter,
  replaceAreaEnchant,
  calculateBattle,
  applyBattleDamage,
  endTurn,
  getCardsToSet,
} from '../gameEngine'
import { getTimePhase } from '../chronos'
import type {
  Card,
  CardClass,
  GameState,
  PlayerState,
  Rarity,
  Attribute,
} from '@/types/game'

// --- fixtures --------------------------------------------------------------

let cardCounter = 0
function buildCard(overrides: Partial<Card> = {}): Card {
  cardCounter++
  return {
    id: `test_${cardCounter}`,
    pack: [],
    title: `Card ${cardCounter}`,
    songs: '',
    illustrator: '',
    rare: 'N' as Rarity,
    type: '闇' as Attribute,
    class: 'Character' as CardClass,
    clock: 0,
    night_attack: 10,
    noon_attack: 10,
    effect: '',
    cost: 0,
    power: 0,
    img: `/cards/test_${cardCounter}.jpg`,
    errata: '',
    ...overrides,
  }
}

function buildPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    hp: 100,
    deck: [],
    hand: [],
    battleZone: null,
    setZone: { a: null, b: null, c: null },
    powerCharger: [],
    abyss: [],
    ...overrides,
  }
}

function buildState(overrides: Partial<GameState> = {}): GameState {
  return {
    turnNumber: 2,
    chronosPosition: 0,
    currentPhase: 'set_cards',
    nightPlayerIndex: 0,
    players: [buildPlayer(), buildPlayer()],
    lastBattleWinner: null,
    winner: null,
    cardsPlayedThisTurn: [0, 0],
    log: [],
    ...overrides,
  }
}

// --- initializeGame --------------------------------------------------------

describe('initializeGame', () => {
  it('seeds both players with 5 cards and the canonical turn-0 state', () => {
    const deck1 = Array.from({ length: 30 }, () => buildCard())
    const deck2 = Array.from({ length: 30 }, () => buildCard())
    const state = initializeGame(deck1, deck2, 0)

    expect(state.turnNumber).toBe(0)
    expect(state.chronosPosition).toBe(0)
    expect(state.cardsPlayedThisTurn).toEqual([0, 0])
    expect(state.players[0].hand).toHaveLength(5)
    expect(state.players[1].hand).toHaveLength(5)
    expect(state.players[0].deck).toHaveLength(25)
    expect(state.players[1].deck).toHaveLength(25)
    expect(state.winner).toBeNull()
    expect(state.lastBattleWinner).toBeNull()
  })
})

// --- 1.1: end-of-turn draw count ------------------------------------------

describe('Wave 1.1 — endTurn draws cardsPlayedThisTurn[i], not always 1', () => {
  it('winner who played 1 card draws exactly 1; loser who played 2 draws exactly 2', () => {
    const stockDeck = (n: number) => Array.from({ length: n }, () => buildCard())
    const state = buildState({
      turnNumber: 3,
      cardsPlayedThisTurn: [1, 2],
      lastBattleWinner: 0,
      players: [
        buildPlayer({ deck: stockDeck(10), hand: [] }),
        buildPlayer({ deck: stockDeck(10), hand: [] }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[0].hand).toHaveLength(1) // winner drew 1
    expect(next.players[1].hand).toHaveLength(2) // loser drew 2
    expect(next.players[0].deck).toHaveLength(9)
    expect(next.players[1].deck).toHaveLength(8)
  })

  it('a draw turn where both played 1 → both draw 1', () => {
    const stockDeck = (n: number) => Array.from({ length: n }, () => buildCard())
    const state = buildState({
      turnNumber: 3,
      cardsPlayedThisTurn: [1, 1],
      lastBattleWinner: null,
      players: [
        buildPlayer({ deck: stockDeck(5), hand: [] }),
        buildPlayer({ deck: stockDeck(5), hand: [] }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[0].hand).toHaveLength(1)
    expect(next.players[1].hand).toHaveLength(1)
  })

  it('cardsPlayedThisTurn resets to [0,0] after endTurn', () => {
    const state = buildState({
      cardsPlayedThisTurn: [1, 2],
      players: [
        buildPlayer({ deck: [buildCard(), buildCard()] }),
        buildPlayer({ deck: [buildCard(), buildCard()] }),
      ],
    })
    const next = endTurn(state)
    expect(next.cardsPlayedThisTurn).toEqual([0, 0])
  })

  it('turnNumber increments by 1 on a normal endTurn', () => {
    const state = buildState({
      turnNumber: 4,
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({ deck: [buildCard()] }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const next = endTurn(state)
    expect(next.turnNumber).toBe(5)
  })
})

// --- 1.2: sweep ALL leftover set-zone cards (incl. Character) ------------

describe('Wave 1.2 — endTurn sweeps every leftover set-zone card', () => {
  it('a leftover Character in slot A still sweeps (no class exemption)', () => {
    const leftoverChar = buildCard({
      class: 'Character',
      power: 0,
      title: 'leftover-char',
    })
    const state = buildState({
      cardsPlayedThisTurn: [0, 0],
      players: [
        buildPlayer({
          deck: [buildCard()],
          setZone: { a: leftoverChar, b: null, c: null },
        }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[0].setZone.a).toBeNull()
    expect(next.players[0].abyss).toContain(leftoverChar)
  })

  it('routes leftover by power: power > 0 → powerCharger, power 0 → abyss', () => {
    const withPower = buildCard({ power: 2, title: 'has-power' })
    const noPower = buildCard({ power: 0, title: 'no-power' })
    const state = buildState({
      cardsPlayedThisTurn: [0, 0],
      players: [
        buildPlayer({
          deck: [buildCard()],
          setZone: { a: withPower, b: noPower, c: null },
        }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[0].powerCharger).toContain(withPower)
    expect(next.players[0].abyss).toContain(noPower)
    expect(next.players[0].setZone.a).toBeNull()
    expect(next.players[0].setZone.b).toBeNull()
  })

  it('zone C (area enchant) is NOT touched by the end-of-turn sweep', () => {
    const persistent = buildCard({
      class: 'Area Enchant',
      power: 0,
      title: 'persistent-area',
    })
    const state = buildState({
      cardsPlayedThisTurn: [0, 0],
      players: [
        buildPlayer({
          deck: [buildCard()],
          setZone: { a: null, b: null, c: persistent },
        }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[0].setZone.c).toBe(persistent)
    expect(next.players[0].abyss).not.toContain(persistent)
  })

  it('defense-in-depth: setCardsFromHand pushes an existing occupant to abyss before overwriting', () => {
    const occupant = buildCard({ title: 'occupant' })
    const incoming = buildCard({ title: 'incoming' })
    const state = buildState({
      players: [
        buildPlayer({
          hand: [incoming],
          setZone: { a: occupant, b: null, c: null },
        }),
        buildPlayer(),
      ],
    })
    const next = setCardsFromHand(state, 0, [{ slot: 'a', handIndex: 0 }])
    expect(next.players[0].setZone.a).toBe(incoming)
    expect(next.players[0].abyss).toContain(occupant)
  })
})

// --- 1.3: advanceTime sums only this-turn's set-zone A/B ----------------

describe('Wave 1.3 — advanceTime sums only set zone A/B, never C', () => {
  it('sums clocks on slot A and B; ignores slot C', () => {
    const a = buildCard({ clock: 3 })
    const b = buildCard({ clock: 2 })
    const c = buildCard({ clock: 5, class: 'Area Enchant' })
    const state = buildState({
      chronosPosition: 0,
      turnNumber: 2,
      players: [
        buildPlayer({ setZone: { a, b, c } }),
        buildPlayer(),
      ],
    })
    const next = advanceTime(state)
    // 3 + 2 = 5; the 5 on slot C must NOT be counted.
    expect(next.chronosPosition).toBe(5)
  })

  it('on turn 1, adds prepClock and battleZone clocks to the sum', () => {
    const charA = buildCard({ clock: 1, class: 'Character' })
    const bz = buildCard({ clock: 2, class: 'Character' })
    const state = buildState({
      turnNumber: 1,
      chronosPosition: 0,
      players: [
        buildPlayer({ setZone: { a: charA, b: null, c: null }, battleZone: bz }),
        buildPlayer(),
      ],
    })
    const next = advanceTime(state, { prepClock: 4 })
    // 1 (A) + 2 (battleZone, turn 1 only) + 4 (prepClock) = 7
    expect(next.chronosPosition).toBe(7)
  })

  it('on turn 2+, battleZone clocks are NOT re-counted', () => {
    const persistentChar = buildCard({ clock: 9, class: 'Character' })
    const state = buildState({
      turnNumber: 2,
      chronosPosition: 0,
      players: [
        buildPlayer({ battleZone: persistentChar }),
        buildPlayer(),
      ],
    })
    const next = advanceTime(state)
    expect(next.chronosPosition).toBe(0)
  })
})

// --- 1.4: initial placement accepts ANY class ---------------------------

describe('Wave 1.4 — placeInitialBattleCard accepts any card class', () => {
  it('accepts a non-Character (Area Enchant) for initial placement', () => {
    const area = buildCard({ class: 'Area Enchant' })
    const state = buildState({
      turnNumber: 0,
      players: [buildPlayer({ hand: [area] }), buildPlayer()],
    })
    const next = placeInitialBattleCard(state, 0, 0)
    expect(next.players[0].battleZone).toBe(area)
    expect(next.players[0].hand).toHaveLength(0)
    expect(next.cardsPlayedThisTurn[0]).toBe(1)
  })

  it('accepts an Enchant class card too', () => {
    const enchant = buildCard({ class: 'Enchant' })
    const state = buildState({
      turnNumber: 0,
      players: [buildPlayer({ hand: [enchant] }), buildPlayer()],
    })
    const next = placeInitialBattleCard(state, 0, 0)
    expect(next.players[0].battleZone).toBe(enchant)
  })

  it('calculateBattle treats null battleZone as 0 attack (the flipped-to-power outcome)', () => {
    const opp = buildCard({ class: 'Character', night_attack: 30, noon_attack: 30 })
    const state = buildState({
      chronosPosition: 3, // day
      players: [
        buildPlayer({ battleZone: null }),
        buildPlayer({ battleZone: opp }),
      ],
    })
    const result = calculateBattle(state)
    expect(result.player0Attack).toBe(0)
    expect(result.player1Attack).toBe(30)
    expect(result.loser).toBe(0)
  })
})

// --- 1.5: setCardsFromHand tolerates empty selections --------------------

describe('Wave 1.5 — setCardsFromHand tolerates an empty selections array', () => {
  it('empty selections is a no-op: hand and setZone unchanged, cardsPlayedThisTurn += 0', () => {
    const c1 = buildCard()
    const state = buildState({
      cardsPlayedThisTurn: [0, 0],
      players: [buildPlayer({ hand: [c1] }), buildPlayer()],
    })
    const next = setCardsFromHand(state, 0, [])
    expect(next.players[0].hand).toHaveLength(1)
    expect(next.players[0].setZone).toEqual({ a: null, b: null, c: null })
    expect(next.cardsPlayedThisTurn[0]).toBe(0)
  })
})

// --- 1.6: mulligan draws BEFORE shuffling discards back in --------------

describe('Wave 1.6 — mulligan draws first, then reshuffles', () => {
  it('discarded cards never come back in this mulligan (drawn before reshuffle)', () => {
    const discardA = buildCard({ title: 'discard-A' })
    const discardB = buildCard({ title: 'discard-B' })
    const keep = buildCard({ title: 'keep' })
    const topDeck1 = buildCard({ title: 'top-1' })
    const topDeck2 = buildCard({ title: 'top-2' })
    const restDeck = Array.from({ length: 10 }, (_, i) =>
      buildCard({ title: `rest-${i}` }),
    )

    const state = buildState({
      players: [
        buildPlayer({
          hand: [discardA, discardB, keep],
          deck: [topDeck1, topDeck2, ...restDeck],
        }),
        buildPlayer(),
      ],
    })
    // Note on determinism: mulligan() calls shuffleDeck on the new DECK only;
    // the hand is built by deterministic filter + drawCards.shift, so no
    // Math.random stub is required for these hand assertions to be stable.
    const next = mulligan(state, 0, [0, 1])
    const newHand = next.players[0].hand

    // Strict positional assertion proves the FIRST-draw-THEN-shuffle ordering:
    // remainingHand = [keep] (filter) → drawCards appends top-of-deck in order
    // → final hand is exactly [keep, topDeck1, topDeck2]. Any other shape
    // would mean either the draw didn't use deck top, or the shuffle ran
    // before the draw (the bug §1.6 fixed).
    expect(newHand).toEqual([keep, topDeck1, topDeck2])

    // The discards must not be in the new hand under any shuffle outcome.
    // They went back into the deck only AFTER the draw, so they can't have
    // been re-drawn in this mulligan — the rule's whole point.
    expect(newHand).not.toContain(discardA)
    expect(newHand).not.toContain(discardB)

    // Discards land back in the deck after the draw. The deck length is
    // (original deck count) - drawn + discards = 12 - 2 + 2 = 12. Membership
    // is checked with toContain (order-independent — shuffle randomized it).
    expect(next.players[0].deck).toHaveLength(12)
    expect(next.players[0].deck).toContain(discardA)
    expect(next.players[0].deck).toContain(discardB)
  })

  it('an empty cardIndices is a no-op mulligan', () => {
    const c1 = buildCard()
    const c2 = buildCard()
    const state = buildState({
      players: [
        buildPlayer({ hand: [c1], deck: [c2] }),
        buildPlayer(),
      ],
    })
    const next = mulligan(state, 0, [])
    expect(next.players[0].hand).toEqual([c1])
    expect(next.players[0].deck).toContain(c2)
  })
})

// --- 1.7: exact set-card counts -----------------------------------------

describe('Wave 1.7 — getCardsToSet returns exact required counts', () => {
  it('turn ≤ 1 → 1 regardless of winner', () => {
    expect(
      getCardsToSet(buildState({ turnNumber: 0, lastBattleWinner: null }), 0),
    ).toBe(1)
    expect(
      getCardsToSet(buildState({ turnNumber: 1, lastBattleWinner: 0 }), 0),
    ).toBe(1)
    expect(
      getCardsToSet(buildState({ turnNumber: 1, lastBattleWinner: 0 }), 1),
    ).toBe(1)
  })

  it('on turn 2+, winner sets 1 and loser sets 2', () => {
    const s = buildState({ turnNumber: 3, lastBattleWinner: 0 })
    expect(getCardsToSet(s, 0)).toBe(1) // winner
    expect(getCardsToSet(s, 1)).toBe(2) // loser
  })

  it('a draw (lastBattleWinner null) on turn 2+ → both set 1', () => {
    const s = buildState({ turnNumber: 5, lastBattleWinner: null })
    expect(getCardsToSet(s, 0)).toBe(1)
    expect(getCardsToSet(s, 1)).toBe(1)
  })
})

// --- 1.9: simultaneous deck-out is a draw -------------------------------

describe('Wave 1.9 — simultaneous deck-out resolves to a draw', () => {
  it('both decks empty at end-of-turn draw → winner null + game_over (DRAW)', () => {
    const state = buildState({
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({ deck: [] }),
        buildPlayer({ deck: [] }),
      ],
    })
    const next = endTurn(state)
    expect(next.winner).toBeNull()
    expect(next.currentPhase).toBe('game_over')
    expect(next.log.some((l) => l.includes('引き分け') || l.includes('DRAW'))).toBe(true)
  })

  it('one-sided deck-out → the OTHER player wins (not always P2)', () => {
    // P1 (index 0) deck-outs first. P0 must win — this was the buggy branch.
    const state = buildState({
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({ deck: [buildCard()] }),
        buildPlayer({ deck: [] }),
      ],
    })
    const next = endTurn(state)
    expect(next.winner).toBe(0)
    expect(next.currentPhase).toBe('game_over')
  })

  it('one-sided deck-out (P0 only) → P1 wins', () => {
    const state = buildState({
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({ deck: [] }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const next = endTurn(state)
    expect(next.winner).toBe(1)
    expect(next.currentPhase).toBe('game_over')
  })

  it("one player's deck-out does NOT skip the other's set-zone sweep", () => {
    // Without the both-pass-then-check structure, the early return would leave
    // P1's leftover sitting in their setZone on the game-over screen.
    const leftover = buildCard({ power: 0 })
    const state = buildState({
      cardsPlayedThisTurn: [1, 0],
      players: [
        buildPlayer({ deck: [] }),
        buildPlayer({
          deck: [buildCard()],
          setZone: { a: leftover, b: null, c: null },
        }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[1].setZone.a).toBeNull()
    expect(next.players[1].abyss).toContain(leftover)
  })
})

// --- calculateBattle: power-cost gating ---------------------------------

describe('calculateBattle power-cost gating', () => {
  it('character with cost > total power → attack clamped to 0', () => {
    const opp = buildCard({ class: 'Character', night_attack: 20, noon_attack: 20 })
    const expensive = buildCard({
      class: 'Character',
      cost: 5,
      night_attack: 30,
      noon_attack: 30,
    })
    const state = buildState({
      chronosPosition: 3, // day
      players: [
        buildPlayer({ battleZone: expensive, powerCharger: [] }),
        buildPlayer({ battleZone: opp }),
      ],
    })
    const result = calculateBattle(state)
    expect(result.player0Attack).toBe(0)
    expect(result.player1Attack).toBe(20)
    expect(result.loser).toBe(0)
  })

  it('character with cost <= total power → printed attack value applies', () => {
    const pSource = buildCard({ power: 5 })
    const ch = buildCard({
      class: 'Character',
      cost: 5,
      night_attack: 30,
      noon_attack: 25,
    })
    const opp = buildCard({ class: 'Character', night_attack: 10, noon_attack: 10 })
    const state = buildState({
      chronosPosition: 3, // day → uses noon_attack
      players: [
        buildPlayer({ battleZone: ch, powerCharger: [pSource] }),
        buildPlayer({ battleZone: opp }),
      ],
    })
    const result = calculateBattle(state)
    expect(result.player0Attack).toBe(25)
    expect(result.player1Attack).toBe(10)
    expect(result.loser).toBe(1)
  })

  it('night vs day phase swaps which attack value is used', () => {
    const ch = buildCard({ class: 'Character', night_attack: 40, noon_attack: 10 })
    const opp = buildCard({ class: 'Character', night_attack: 10, noon_attack: 10 })
    const dayState = buildState({
      chronosPosition: 4, // day
      players: [
        buildPlayer({ battleZone: ch }),
        buildPlayer({ battleZone: opp }),
      ],
    })
    expect(calculateBattle(dayState).player0Attack).toBe(10)

    const nightState = buildState({
      chronosPosition: 10, // night
      players: [
        buildPlayer({ battleZone: ch }),
        buildPlayer({ battleZone: opp }),
      ],
    })
    expect(calculateBattle(nightState).player0Attack).toBe(40)
  })
})

// --- applyBattleDamage: HP-0 → immediate game-over winner --------------

describe('applyBattleDamage HP-0 ends the game immediately', () => {
  it('reducing HP to 0 sets state.winner to the other player', () => {
    const state = buildState({
      players: [
        buildPlayer({ hp: 10 }),
        buildPlayer({ hp: 100 }),
      ],
    })
    const result = {
      nightAttack: 0,
      dayAttack: 0,
      currentPhase: 'day' as const,
      player0Attack: 5,
      player1Attack: 30,
      damage: 25,
      loser: 0 as const,
    }
    const next = applyBattleDamage(state, result)
    expect(next.players[0].hp).toBe(0)
    expect(next.winner).toBe(1)
  })

  it('a partial-damage hit (HP > 0) leaves winner null', () => {
    const state = buildState({
      players: [buildPlayer({ hp: 50 }), buildPlayer({ hp: 100 })],
    })
    const next = applyBattleDamage(state, {
      nightAttack: 0,
      dayAttack: 0,
      currentPhase: 'day',
      player0Attack: 0,
      player1Attack: 20,
      damage: 20,
      loser: 0,
    })
    expect(next.players[0].hp).toBe(30)
    expect(next.winner).toBeNull()
    expect(next.lastBattleWinner).toBe(1)
  })

  it('a tie (loser null) deals 0 damage and leaves both HP intact', () => {
    const state = buildState({
      players: [buildPlayer({ hp: 80 }), buildPlayer({ hp: 80 })],
    })
    const next = applyBattleDamage(state, {
      nightAttack: 0,
      dayAttack: 0,
      currentPhase: 'day',
      player0Attack: 10,
      player1Attack: 10,
      damage: 0,
      loser: null,
    })
    expect(next.players[0].hp).toBe(80)
    expect(next.players[1].hp).toBe(80)
    expect(next.lastBattleWinner).toBeNull()
  })
})

// --- replaceCharacter: slot A priority ----------------------------------

describe('replaceCharacter promotes slot A over slot B', () => {
  it('when both A and B hold Characters, A is promoted', () => {
    const charA = buildCard({ class: 'Character', title: 'A' })
    const charB = buildCard({ class: 'Character', title: 'B' })
    const state = buildState({
      players: [
        buildPlayer({
          setZone: { a: charA, b: charB, c: null },
          battleZone: null,
        }),
        buildPlayer(),
      ],
    })
    const next = replaceCharacter(state, 0)
    expect(next.players[0].battleZone).toBe(charA)
    expect(next.players[0].setZone.a).toBeNull()
    // B remains untouched in slot B; the end-of-turn sweep will handle it.
    expect(next.players[0].setZone.b).toBe(charB)
  })

  it('outgoing battleZone routes by power (>0 → powerCharger, else abyss)', () => {
    const outgoing = buildCard({ class: 'Character', power: 3 })
    const incoming = buildCard({ class: 'Character' })
    const state = buildState({
      players: [
        buildPlayer({
          battleZone: outgoing,
          setZone: { a: incoming, b: null, c: null },
        }),
        buildPlayer(),
      ],
    })
    const next = replaceCharacter(state, 0)
    expect(next.players[0].powerCharger).toContain(outgoing)
    expect(next.players[0].battleZone).toBe(incoming)
  })

  it('with no Character in A or B, the battleZone is left alone', () => {
    const sittingDuck = buildCard({ class: 'Character' })
    const enchant = buildCard({ class: 'Enchant' })
    const state = buildState({
      players: [
        buildPlayer({
          battleZone: sittingDuck,
          setZone: { a: enchant, b: null, c: null },
        }),
        buildPlayer(),
      ],
    })
    const next = replaceCharacter(state, 0)
    expect(next.players[0].battleZone).toBe(sittingDuck)
    expect(next.players[0].setZone.a).toBe(enchant)
  })
})

// --- replaceAreaEnchant -------------------------------------------------

describe('replaceAreaEnchant promotes from A or B into slot C', () => {
  it('promotes a slot-A Area Enchant into slot C; the old C lands in power/abyss', () => {
    const oldArea = buildCard({ class: 'Area Enchant', power: 2 })
    const newArea = buildCard({ class: 'Area Enchant' })
    const state = buildState({
      players: [
        buildPlayer({
          setZone: { a: newArea, b: null, c: oldArea },
        }),
        buildPlayer(),
      ],
    })
    const next = replaceAreaEnchant(state, 0)
    expect(next.players[0].setZone.c).toBe(newArea)
    expect(next.players[0].setZone.a).toBeNull()
    expect(next.players[0].powerCharger).toContain(oldArea)
  })
})

// --- chronos helpers ----------------------------------------------------

describe('chronos getTimePhase', () => {
  it('positions 9, 10, 11, 0, 1, 2 are night', () => {
    for (const p of [9, 10, 11, 0, 1, 2]) {
      expect(getTimePhase(p)).toBe('night')
    }
  })
  it('positions 3, 4, 5, 6, 7, 8 are day', () => {
    for (const p of [3, 4, 5, 6, 7, 8]) {
      expect(getTimePhase(p)).toBe('day')
    }
  })
})

// --- drawCards bookkeeping ----------------------------------------------

describe('drawCards', () => {
  it('reports deckEmpty=true when the deck runs out mid-draw', () => {
    const c1 = buildCard()
    const player = buildPlayer({ deck: [c1] })
    const result = drawCards(player, 3)
    expect(result.drawnCards).toHaveLength(1)
    expect(result.deckEmpty).toBe(true)
    expect(result.player.hand).toHaveLength(1)
  })

  it('reports deckEmpty=false when the count was fully satisfied', () => {
    const player = buildPlayer({ deck: [buildCard(), buildCard()] })
    const result = drawCards(player, 2)
    expect(result.drawnCards).toHaveLength(2)
    expect(result.deckEmpty).toBe(false)
  })
})

// --- calculateTotalPower -----------------------------------------------

describe('calculateTotalPower', () => {
  it('sums power values across all powerCharger entries', () => {
    const p = buildPlayer({
      powerCharger: [
        buildCard({ power: 2 }),
        buildCard({ power: 5 }),
        buildCard({ power: 0 }),
        buildCard({ power: 3 }),
      ],
    })
    expect(calculateTotalPower(p)).toBe(10)
  })

  it('returns 0 on an empty powerCharger', () => {
    expect(calculateTotalPower(buildPlayer())).toBe(0)
  })
})

// --- determinism check: engine is immutable -----------------------------

describe('engine immutability', () => {
  it('endTurn does not mutate the input state', () => {
    const state = buildState({
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({ deck: [buildCard()] }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const snapshot = JSON.parse(JSON.stringify(state))
    endTurn(state)
    expect(state).toEqual(snapshot)
  })

  it('mulligan does not mutate the input state', () => {
    // Stub Math.random so the internal shuffle is deterministic across the
    // before/after JSON snapshots.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const state = buildState({
      players: [
        buildPlayer({
          hand: [buildCard(), buildCard()],
          deck: [buildCard(), buildCard(), buildCard()],
        }),
        buildPlayer(),
      ],
    })
    const snapshot = JSON.parse(JSON.stringify(state))
    mulligan(state, 0, [0])
    expect(state).toEqual(snapshot)
    vi.restoreAllMocks()
  })
})
