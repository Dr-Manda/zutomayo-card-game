import { Card, GameState, PlayerState, BattleResult } from '@/types/game'
import { advanceChronos, getTimePhase } from './chronos'

function createPlayerState(deck: Card[]): PlayerState {
  return {
    hp: 100,
    deck: [...deck],
    hand: [],
    battleZone: null,
    setZone: { a: null, b: null, c: null },
    powerCharger: [],
    abyss: [],
  }
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function drawCards(player: PlayerState, count: number): { player: PlayerState; drawnCards: Card[]; deckEmpty: boolean } {
  const drawn: Card[] = []
  const newDeck = [...player.deck]
  let deckEmpty = false

  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0) {
      deckEmpty = true
      break
    }
    drawn.push(newDeck.shift()!)
  }

  return {
    player: { ...player, deck: newDeck, hand: [...player.hand, ...drawn] },
    drawnCards: drawn,
    deckEmpty,
  }
}

export function initializeGame(deck1: Card[], deck2: Card[], nightPlayerIndex: 0 | 1): GameState {
  const shuffled1 = shuffleDeck(deck1)
  const shuffled2 = shuffleDeck(deck2)

  let player0 = createPlayerState(shuffled1)
  let player1 = createPlayerState(shuffled2)

  // Draw 5 cards each
  const draw0 = drawCards(player0, 5)
  player0 = draw0.player
  const draw1 = drawCards(player1, 5)
  player1 = draw1.player

  return {
    turnNumber: 0,
    chronosPosition: 0, // Midnight
    currentPhase: 'game_start',
    nightPlayerIndex,
    players: [player0, player1],
    lastBattleWinner: null,
    winner: null,
    cardsPlayedThisTurn: [0, 0],
    log: ['ゲーム開始！/ Game Start!'],
  }
}

export function mulligan(state: GameState, playerIndex: 0 | 1, cardIndices: number[]): GameState {
  const players = [...state.players] as [PlayerState, PlayerState]
  const player = { ...players[playerIndex] }

  // Set discarded cards aside (rule: 「フィールドのわかりやすい場所に伏せ」),
  // then DRAW first from the untouched remaining deck before reshuffling —
  // this is the rule's whole point, so a mulliganed card can never come back.
  const returnedCards = cardIndices.map(i => player.hand[i])
  const remainingHand = player.hand.filter((_, i) => !cardIndices.includes(i))
  player.hand = remainingHand

  // 1. Draw replacements from the top of the deck as it stands now.
  const drawResult = drawCards(player, cardIndices.length)
  let nextPlayer = drawResult.player

  // 2. Now shuffle the discards back into the deck.
  nextPlayer = { ...nextPlayer, deck: shuffleDeck([...nextPlayer.deck, ...returnedCards]) }
  players[playerIndex] = nextPlayer

  return {
    ...state,
    players,
    log: [...state.log, `プレイヤー${playerIndex + 1}がマリガン / Player ${playerIndex + 1} mulliganed ${cardIndices.length} cards`],
  }
}

export function placeInitialBattleCard(state: GameState, playerIndex: 0 | 1, handIndex: number): GameState {
  const players = [...state.players] as [PlayerState, PlayerState]
  const player = { ...players[playerIndex] }
  const card = player.hand[handIndex]
  if (!card) return state

  // Rule (prep step 8): 「手札からカードを１枚選びバトルゾーンに裏向きにして置きます」 —
  // ANY card can be placed face-down. The class-based flip to power/abyss happens
  // at reveal time inside useGame.placeInitial (rule prep step 9).
  player.battleZone = card
  player.hand = player.hand.filter((_, i) => i !== handIndex)
  players[playerIndex] = player

  const cardsPlayedThisTurn = [...state.cardsPlayedThisTurn] as [number, number]
  cardsPlayedThisTurn[playerIndex] += 1

  return { ...state, players, cardsPlayedThisTurn }
}

export function setCardsFromHand(
  state: GameState,
  playerIndex: 0 | 1,
  selections: { slot: 'a' | 'b'; handIndex: number }[]
): GameState {
  const players = [...state.players] as [PlayerState, PlayerState]
  const player = { ...players[playerIndex] }
  const newSetZone = { ...player.setZone }
  let abyss = player.abyss
  const usedIndices = new Set<number>()

  for (const { slot, handIndex } of selections) {
    if (usedIndices.has(handIndex)) continue
    const incoming = player.hand[handIndex]
    if (!incoming) continue

    // Defense-in-depth: never silently drop a card. If something already occupies
    // this slot (the end-of-turn sweep should have cleared A/B, but be safe) shove
    // it to the abyss before assignment so it can never vanish from the game.
    const occupant = newSetZone[slot]
    if (occupant) abyss = [...abyss, occupant]

    newSetZone[slot] = incoming
    usedIndices.add(handIndex)
  }

  player.setZone = newSetZone
  player.abyss = abyss
  player.hand = player.hand.filter((_, i) => !usedIndices.has(i))
  players[playerIndex] = player

  const cardsPlayedThisTurn = [...state.cardsPlayedThisTurn] as [number, number]
  cardsPlayedThisTurn[playerIndex] += usedIndices.size

  return { ...state, players, cardsPlayedThisTurn }
}

export function calculateTotalPower(player: PlayerState): number {
  return player.powerCharger.reduce((sum, card) => sum + card.power, 0)
}

export function advanceTime(state: GameState, options?: { prepClock?: number }): GameState {
  let totalClock = 0

  for (const player of state.players) {
    // Rule: 「このターンに各プレイヤーが手札から出したカードに書かれた時計の数値を合計し」 —
    // sum clocks on THIS turn's hand-played cards only. After the end-of-turn sweep,
    // slots a/b contain exactly this turn's set cards. Slot c holds an area enchant
    // placed on a PREVIOUS turn, so it must NOT be re-counted.
    const { a, b } = player.setZone
    if (a) totalClock += a.clock
    if (b) totalClock += b.clock
  }

  // On the first turn the prep-step face-down cards are revealed inside
  // useGame.placeInitial — any Character lands in the battle zone; non-Characters
  // are flipped to power-charger/abyss with their clocks accumulated into
  // `options.prepClock` and passed through here (rule: 「※対戦準備時に、パワーチャージャー
  // /アビスに置いたカードの時計も含まれます」).
  if (state.turnNumber === 1) {
    for (const player of state.players) {
      if (player.battleZone) totalClock += player.battleZone.clock
    }
    if (options?.prepClock) totalClock += options.prepClock
  }

  const newPosition = advanceChronos(state.chronosPosition, totalClock)
  const timePhase = getTimePhase(newPosition)

  return {
    ...state,
    chronosPosition: newPosition,
    log: [
      ...state.log,
      `クロノス +${totalClock} → ${newPosition} (${timePhase === 'night' ? '夜/Night' : '昼/Day'})`,
    ],
  }
}

export function replaceCharacter(state: GameState, playerIndex: 0 | 1): GameState {
  const players = [...state.players] as [PlayerState, PlayerState]
  const player = { ...players[playerIndex] }
  const log = [...state.log]

  // Find character card in set zone A (priority) or B
  let newChar: Card | null = null
  let slot: 'a' | 'b' | null = null

  if (player.setZone.a?.class === 'Character') {
    newChar = player.setZone.a
    slot = 'a'
  } else if (player.setZone.b?.class === 'Character') {
    newChar = player.setZone.b
    slot = 'b'
  }

  if (newChar && slot) {
    // Move old battle zone card to power charger or abyss
    const outgoing = player.battleZone
    if (outgoing) {
      if (outgoing.power > 0) {
        player.powerCharger = [...player.powerCharger, outgoing]
      } else {
        player.abyss = [...player.abyss, outgoing]
      }
    }
    player.battleZone = newChar
    player.setZone = { ...player.setZone, [slot]: null }
    log.push(
      `P${playerIndex + 1} 交代: ${outgoing?.title ?? '空'} → ${newChar.title} / replace ${outgoing?.title ?? 'empty'} → ${newChar.title}`,
    )
  }

  players[playerIndex] = player
  return { ...state, players, log }
}

export function replaceAreaEnchant(state: GameState, playerIndex: 0 | 1): GameState {
  const players = [...state.players] as [PlayerState, PlayerState]
  const player = { ...players[playerIndex] }
  const log = [...state.log]

  // Find area enchant in set zone A or B
  let newArea: Card | null = null
  let slot: 'a' | 'b' | null = null

  for (const s of ['a', 'b'] as const) {
    if (player.setZone[s]?.class === 'Area Enchant') {
      newArea = player.setZone[s]
      slot = s
      break
    }
  }

  if (newArea && slot) {
    // Move old area enchant from zone C to power charger or abyss
    const outgoing = player.setZone.c
    if (outgoing) {
      if (outgoing.power > 0) {
        player.powerCharger = [...player.powerCharger, outgoing]
      } else {
        player.abyss = [...player.abyss, outgoing]
      }
    }
    player.setZone = { ...player.setZone, c: newArea, [slot]: null }
    log.push(
      `P${playerIndex + 1} エリア交代: ${outgoing?.title ?? '空'} → ${newArea.title} / area replace`,
    )
  }

  players[playerIndex] = player
  return { ...state, players, log }
}

export function calculateBattle(state: GameState): BattleResult {
  const timePhase = getTimePhase(state.chronosPosition)
  const p0 = state.players[0]
  const p1 = state.players[1]

  const p0Power = calculateTotalPower(p0)
  const p1Power = calculateTotalPower(p1)

  // Effect-derived attack modifier (Wave 4.1). process_effects writes the
  // accumulated +N buffs (own card) and -N debuffs (opponent's card targeting
  // this player) into attackModifier; calculateBattle reads it here. Default
  // 0 keeps pre-4.1 behavior unchanged.
  const p0Mod = p0.attackModifier ?? 0
  const p1Mod = p1.attackModifier ?? 0

  let p0Attack = 0
  let p1Attack = 0

  if (p0.battleZone) {
    const hasPower = p0Power >= p0.battleZone.cost
    if (hasPower) {
      const base =
        timePhase === 'night'
          ? p0.battleZone.night_attack
          : p0.battleZone.noon_attack
      // Clamp at 0 — a debuff larger than the base attack still can't go
      // negative; "did not attack" is the floor.
      p0Attack = Math.max(0, base + p0Mod)
    }
  }

  if (p1.battleZone) {
    const hasPower = p1Power >= p1.battleZone.cost
    if (hasPower) {
      const base =
        timePhase === 'night'
          ? p1.battleZone.night_attack
          : p1.battleZone.noon_attack
      p1Attack = Math.max(0, base + p1Mod)
    }
  }

  const damage = Math.abs(p0Attack - p1Attack)
  let loser: 0 | 1 | null = null
  if (p0Attack < p1Attack) loser = 0
  else if (p1Attack < p0Attack) loser = 1

  return {
    nightAttack: p0.battleZone?.night_attack ?? 0,
    dayAttack: p0.battleZone?.noon_attack ?? 0,
    currentPhase: timePhase,
    player0Attack: p0Attack,
    player1Attack: p1Attack,
    damage,
    loser,
  }
}

export function applyBattleDamage(state: GameState, result: BattleResult): GameState {
  const players = [...state.players] as [PlayerState, PlayerState]

  if (result.loser !== null) {
    const loser = { ...players[result.loser] }
    loser.hp = Math.max(0, loser.hp - result.damage)
    players[result.loser] = loser
  }

  const winner = result.loser === null ? null : (result.loser === 0 ? 1 : 0) as 0 | 1

  // Check for game over
  let gameWinner: 0 | 1 | null = null
  if (players[0].hp <= 0) gameWinner = 1
  if (players[1].hp <= 0) gameWinner = 0

  return {
    ...state,
    players,
    lastBattleWinner: winner,
    winner: gameWinner,
    log: [
      ...state.log,
      result.loser !== null
        ? `P${result.loser + 1} takes ${result.damage} damage! (${players[result.loser].hp} HP)`
        : `Draw! No damage dealt.`,
    ],
  }
}

export function endTurn(state: GameState): GameState {
  const players = [...state.players] as [PlayerState, PlayerState]
  const deckEmpty: [boolean, boolean] = [false, false]
  const extraLog: string[] = []

  // First pass: sweep BOTH players' leftover set-zone A/B cards and draw their
  // turn-2+ replacements, regardless of which deck-outs. This way both deck-out
  // flags are collected before we decide winner/draw, and one player's deck-out
  // does NOT skip the other's sweep (rule:「ターン終了時にデッキがなくなりカードが引けない
  // 場合、引けないプレイヤーの負け」 — simultaneous failure is a draw, not a P2 win).
  for (let i = 0; i < 2; i++) {
    const player = { ...players[i] }

    // Rule end-of-turn step 9: 「このターンに手札から出したカードがセットゾーンA、または
    // Bにあれば、そのカードを SEND TO POWER の有無に応じてパワーチャージャー/アビス
    // に置きます」 — EVERY leftover A/B card sweeps. No Character exemption: any
    // Character not promoted by replaceCharacter goes to its power/abyss destination
    // by the same rule. `power > 0` reliably encodes "has SEND TO POWER" in cards.json.
    for (const slot of ['a', 'b'] as const) {
      const card = player.setZone[slot]
      if (card) {
        if (card.power > 0) {
          player.powerCharger = [...player.powerCharger, card]
        } else {
          player.abyss = [...player.abyss, card]
        }
        player.setZone = { ...player.setZone, [slot]: null }
      }
    }

    // Wave 4.1 — snapshot this turn's battleZone Character so next turn's
    // process_effects can evaluate 「前のターンで使用したキャラクターカードの
    // 属性が...」 conditions. We snapshot only Characters (non-Character
    // battle-zone cards are conceptually never "the character used this
    // turn"). Reset attackModifier — it was a single-turn effect.
    if (player.battleZone && player.battleZone.class === 'Character') {
      player.previousTurnCharacter = player.battleZone
    }
    player.attackModifier = 0

    // Rule: 「このターンに手札から出したカードの枚数分だけデッキからカードを引きます」 —
    // draw EXACTLY as many cards as this player put into play from hand this turn.
    const drawCount = state.cardsPlayedThisTurn[i]
    const drawResult = drawCards(player, drawCount)
    players[i] = drawResult.player
    deckEmpty[i] = drawResult.deckEmpty
  }

  // Simultaneous deck-out → draw. One-sided deck-out → other player wins.
  if (deckEmpty[0] && deckEmpty[1]) {
    extraLog.push('両者のデッキが空！引き分け / Both decks out — DRAW')
    return {
      ...state,
      players,
      winner: null,
      lastBattleWinner: null,
      currentPhase: 'game_over',
      cardsPlayedThisTurn: [0, 0],
      log: [...state.log, ...extraLog],
    }
  }
  if (deckEmpty[0] || deckEmpty[1]) {
    const loser = (deckEmpty[0] ? 0 : 1) as 0 | 1
    const winner = (loser === 0 ? 1 : 0) as 0 | 1
    extraLog.push(`P${loser + 1} のデッキが空！/ P${loser + 1} deck out!`)
    return {
      ...state,
      players,
      winner,
      currentPhase: 'game_over',
      cardsPlayedThisTurn: [0, 0],
      log: [...state.log, ...extraLog],
    }
  }

  return {
    ...state,
    players,
    turnNumber: state.turnNumber + 1,
    currentPhase: 'set_cards',
    cardsPlayedThisTurn: [0, 0],
  }
}

export function getCardsToSet(state: GameState, playerIndex: 0 | 1): number {
  if (state.turnNumber <= 1) return 1
  if (state.lastBattleWinner === null) return 1 // draw
  return state.lastBattleWinner === playerIndex ? 1 : 2
}
