export type Attribute = '闇' | '炎' | '電気' | '風' | 'カオス'
export type CardClass = 'Character' | 'Enchant' | 'Area Enchant'
export type Rarity = 'UR' | 'SR' | 'R' | 'N' | 'SE'
export type TimePhase = 'night' | 'day'

export interface Card {
  id: string
  pack: string[]
  title: string
  songs: string
  illustrator: string
  rare: Rarity
  type: Attribute
  class: CardClass
  clock: number
  night_attack: number
  noon_attack: number
  effect: string
  cost: number
  power: number
  img: string
  errata: string
}

export interface SetZone {
  a: Card | null
  b: Card | null
  c: Card | null
}

export interface PlayerState {
  hp: number
  deck: Card[]
  hand: Card[]
  battleZone: Card | null
  setZone: SetZone
  powerCharger: Card[]
  abyss: Card[]
}

export type TurnPhase =
  | 'game_start'
  | 'set_cards'
  | 'reveal_cards'
  | 'advance_time'
  | 'replace_character'
  | 'replace_area_enchant'
  | 'process_effects'
  | 'battle'
  | 'end_turn'
  | 'pass_device'
  | 'game_over'

export interface GameState {
  turnNumber: number
  chronosPosition: number
  currentPhase: TurnPhase
  nightPlayerIndex: 0 | 1
  players: [PlayerState, PlayerState]
  lastBattleWinner: 0 | 1 | null
  winner: 0 | 1 | null
  /** Per-player count of cards put into the battle/set zones from hand on this turn.
   *  Drives the end-of-turn draw count (rule: 「このターンに手札から出したカードの枚数分だけデッキからカードを引きます」)
   *  and is reset to [0,0] inside endTurn after both players have drawn. */
  cardsPlayedThisTurn: [number, number]
  log: string[]
}

export interface BattleResult {
  nightAttack: number
  dayAttack: number
  currentPhase: TimePhase
  player0Attack: number
  player1Attack: number
  damage: number
  loser: 0 | 1 | null
}

