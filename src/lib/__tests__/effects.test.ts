/**
 * Effects engine tests — Wave 4.1.
 *
 * Covers parseEffect (pattern coverage across every implemented category),
 * evaluateCondition (each Condition kind against synthetic state),
 * applyEffects (priority-player ordering, per-card cost gating,
 * immediate HP-0 game-over), endTurn integration (attackModifier reset,
 * previousTurnCharacter snapshot), and the calculateBattle integration
 * (attackModifier consumed; debuff clamps at 0).
 *
 * Fixtures use the same buildCard / buildPlayer / buildState pattern as
 * gameEngine.test.ts. We hit real effect strings (verbatim from cards.json)
 * so the parser sees the actual production input shape.
 */
import { describe, it, expect } from 'vitest'
import {
  parseEffect,
  evaluateCondition,
  applyEffects,
  isEffectImplemented,
  type Condition,
} from '../effects'
import { calculateBattle, endTurn } from '../gameEngine'
import cardsData from '@/data/cards.json'
import type {
  Attribute,
  Card,
  CardClass,
  GameState,
  PlayerState,
  Rarity,
} from '@/types/game'

// ── fixtures ──────────────────────────────────────────────────────────────

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
    img: '',
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
    chronosPosition: 10, // night
    currentPhase: 'process_effects',
    nightPlayerIndex: 0,
    players: [buildPlayer(), buildPlayer()],
    lastBattleWinner: null,
    winner: null,
    cardsPlayedThisTurn: [0, 0],
    log: [],
    ...overrides,
  }
}

// ── parseEffect — pattern coverage by category ────────────────────────────

describe('parseEffect — attack-buff patterns', () => {
  it('parses 「夜なら攻撃力+30」 as time-night → attack-buff +30', () => {
    const card = buildCard({ effect: '夜なら攻撃力+30' })
    const e = parseEffect(card)
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition.kind).toBe('time-night')
    expect(e.action).toEqual({ kind: 'attack-buff', value: 30 })
  })

  it('parses 「昼なら攻撃力+50」 as time-day → attack-buff +50', () => {
    const e = parseEffect(buildCard({ effect: '昼なら攻撃力+50' }))
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition.kind).toBe('time-day')
    expect(e.action.value).toBe(50)
  })

  it('parses 「真夜中なら攻撃力+100」 as time-midnight → attack-buff +100', () => {
    const e = parseEffect(buildCard({ effect: '真夜中なら攻撃力+100' }))
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition.kind).toBe('time-midnight')
    expect(e.action.value).toBe(100)
  })

  it('parses 「自分のキャラクターカードの属性が闇なら攻撃力+20」', () => {
    const e = parseEffect(
      buildCard({ effect: '自分のキャラクターカードの属性が闇なら攻撃力+20' }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'self-attr', attrs: ['闇'] })
    expect(e.action.value).toBe(20)
  })

  it('parses 「相手のキャラクターカードの属性が炎・風なら攻撃力+20」 (OR list)', () => {
    const e = parseEffect(
      buildCard({ effect: '相手のキャラクターカードの属性が炎・風なら攻撃力+20' }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'opp-attr', attrs: ['炎', '風'] })
  })

  it('parses 「自分のHPが30以下なら攻撃力+50」', () => {
    const e = parseEffect(buildCard({ effect: '自分のHPが30以下なら攻撃力+50' }))
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'self-hp-leq', value: 30 })
    expect(e.action.value).toBe(50)
  })

  it('parses 「相手のHPが100なら攻撃力+100」', () => {
    const e = parseEffect(buildCard({ effect: '相手のHPが100なら攻撃力+100' }))
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'opp-hp-eq', value: 100 })
  })

  it('parses 「相手のキャラクターカードのパワーコストが★２以上なら攻撃力+20」', () => {
    const e = parseEffect(
      buildCard({
        effect: '相手のキャラクターカードのパワーコストが★２以上なら攻撃力+20',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'opp-cost-geq', value: 2 })
  })

  it('parses 「相手のキャラクターカードのパワーコストが★０か★１なら攻撃力+30」 (membership)', () => {
    const e = parseEffect(
      buildCard({
        effect: '相手のキャラクターカードのパワーコストが★０か★１なら攻撃力+30',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'opp-cost-in', values: [0, 1] })
  })

  it('parses 「前のターンで使用したキャラクターカードの属性が炎なら攻撃力+20」', () => {
    const e = parseEffect(
      buildCard({
        effect: '前のターンで使用したキャラクターカードの属性が炎なら攻撃力+20',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'prev-attr', attrs: ['炎'] })
  })

  it('parses a conjunction: 「前のターン...電気かつ、相手...炎か闇なら攻撃力+40」', () => {
    const e = parseEffect(
      buildCard({
        effect:
          '前のターンで使用したキャラクターカードの属性が電気かつ、相手のキャラクターカードが炎か闇なら攻撃力+40',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition.kind).toBe('and')
    if (e.condition.kind !== 'and') return
    expect(e.condition.conds[0]).toEqual({ kind: 'prev-attr', attrs: ['電気'] })
    expect(e.condition.conds[1]).toEqual({ kind: 'opp-attr', attrs: ['炎', '闇'] })
  })

  it('parses a turn+time conjunction: 「前のターン...風で、今が昼なら攻撃力+40」', () => {
    const e = parseEffect(
      buildCard({
        effect: '前のターンで使用したキャラクターカードの属性が風で、今が昼なら攻撃力+40',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition.kind).toBe('and')
  })

  it('parses 「アビスに炎属性のカードが２枚以上あるなら攻撃力+30」', () => {
    const e = parseEffect(
      buildCard({
        effect: 'アビスに炎属性のカードが２枚以上あるなら攻撃力+30',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({
      kind: 'abyss-attr-count-geq',
      attr: '炎',
      count: 2,
    })
  })

  it('parses 「アビスに闇・炎・電気・風の４属性のカードがあるなら攻撃力+100」', () => {
    const e = parseEffect(
      buildCard({
        effect: 'アビスに闇・炎・電気・風の４属性のカードがあるなら攻撃力+100',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'abyss-4attr' })
  })

  it('parses 「パワーチャージャーのカードが闇属性だけだったなら攻撃力+40」', () => {
    const e = parseEffect(
      buildCard({
        effect: 'パワーチャージャーのカードが闇属性だけだったなら攻撃力+40',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'power-attr-only', attr: '闇' })
  })

  it('strips trailing errata annotation before parsing', () => {
    const e = parseEffect(
      buildCard({
        effect:
          'アビスに闇・炎・電気・風の４属性のカードがあるなら攻撃力+100※2026/4/3：エラッタ対応',
      }),
    )
    expect(e.kind).toBe('parsed')
  })
})

describe('parseEffect — hp-heal patterns', () => {
  it('parses 「自分のキャラクターカードの属性が闇ならHPを10回復」', () => {
    const e = parseEffect(
      buildCard({ effect: '自分のキャラクターカードの属性が闇ならHPを10回復' }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.condition).toEqual({ kind: 'self-attr', attrs: ['闇'] })
    expect(e.action).toEqual({ kind: 'hp-heal', value: 10 })
  })

  it('parses 「アビスに闇属性のカードが２枚以上あるなら、HPを20回復」', () => {
    const e = parseEffect(
      buildCard({ effect: 'アビスに闇属性のカードが２枚以上あるなら、HPを20回復' }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.action).toEqual({ kind: 'hp-heal', value: 20 })
  })
})

describe('parseEffect — clock-set patterns', () => {
  it('parses 「アビスに炎属性のカードが２枚以上あるなら、時計が真夜中になる」', () => {
    const e = parseEffect(
      buildCard({
        effect: 'アビスに炎属性のカードが２枚以上あるなら、時計が真夜中になる',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.action).toEqual({ kind: 'clock-set', value: 0 })
  })

  it('parses 「アビスに風属性のカードが２枚以上あるなら、時計が正午になる」', () => {
    const e = parseEffect(
      buildCard({
        effect: 'アビスに風属性のカードが２枚以上あるなら、時計が正午になる',
      }),
    )
    expect(e.kind).toBe('parsed')
    if (e.kind !== 'parsed') return
    expect(e.action.value).toBe(6) // midday position
  })
})

describe('parseEffect — unimplemented + none', () => {
  it('empty effect text → none', () => {
    expect(parseEffect(buildCard({ effect: '' })).kind).toBe('none')
  })
  it('errata-only text → none', () => {
    expect(parseEffect(buildCard({ effect: '※2026/4/3：エラッタ対応' })).kind).toBe(
      'none',
    )
  })
  it('unparseable effect text → unimplemented', () => {
    const e = parseEffect(
      buildCard({
        effect:
          '手札からパワーの有無に関わらずカード１枚を選び、アビスに置く。デッキからカードを１枚引く',
      }),
    )
    expect(e.kind).toBe('unimplemented')
  })
})

describe('isEffectImplemented diagnostic', () => {
  it('returns true for parseable effects', () => {
    expect(isEffectImplemented(buildCard({ effect: '夜なら攻撃力+30' }))).toBe(true)
  })
  it('returns false for unparseable text', () => {
    expect(
      isEffectImplemented(
        buildCard({ effect: '相手のエリアエンチャントを相手のデッキの底に置く' }),
      ),
    ).toBe(false)
  })
  it('returns false for empty text', () => {
    expect(isEffectImplemented(buildCard({ effect: '' }))).toBe(false)
  })
})

// ── evaluateCondition — coverage per kind ────────────────────────────────

describe('evaluateCondition', () => {
  const state = buildState({
    chronosPosition: 10, // night
    nightPlayerIndex: 0,
    players: [
      buildPlayer({
        hp: 25,
        battleZone: buildCard({ type: '闇' }),
        previousTurnCharacter: buildCard({ type: '炎' }),
        abyss: [
          buildCard({ type: '闇' }),
          buildCard({ type: '闇' }),
          buildCard({ type: '炎' }),
        ],
        powerCharger: [buildCard({ type: '電気', power: 2 })],
      }),
      buildPlayer({
        hp: 100,
        battleZone: buildCard({ type: '風', cost: 3 }),
      }),
    ],
  })

  it('time-night true when chronos in night band', () => {
    expect(evaluateCondition({ kind: 'time-night' }, state, 0)).toBe(true)
    expect(evaluateCondition({ kind: 'time-day' }, state, 0)).toBe(false)
  })

  it('time-midnight false when not at position 0', () => {
    expect(evaluateCondition({ kind: 'time-midnight' }, state, 0)).toBe(false)
    const midnight = buildState({ chronosPosition: 0 })
    expect(evaluateCondition({ kind: 'time-midnight' }, midnight, 0)).toBe(true)
  })

  it('self-attr checks the firing player\'s battleZone type', () => {
    expect(
      evaluateCondition({ kind: 'self-attr', attrs: ['闇'] }, state, 0),
    ).toBe(true)
    expect(
      evaluateCondition({ kind: 'self-attr', attrs: ['炎'] }, state, 0),
    ).toBe(false)
  })

  it('opp-attr checks the opponent\'s battleZone type', () => {
    expect(
      evaluateCondition({ kind: 'opp-attr', attrs: ['風'] }, state, 0),
    ).toBe(true)
  })

  it('prev-attr reads previousTurnCharacter', () => {
    expect(
      evaluateCondition({ kind: 'prev-attr', attrs: ['炎'] }, state, 0),
    ).toBe(true)
    expect(
      evaluateCondition({ kind: 'prev-attr', attrs: ['風'] }, state, 0),
    ).toBe(false)
  })

  it('prev-attr false when previousTurnCharacter is unset', () => {
    const s = buildState()
    expect(evaluateCondition({ kind: 'prev-attr', attrs: ['闇'] }, s, 0)).toBe(
      false,
    )
  })

  it('self-hp-leq is inclusive', () => {
    expect(evaluateCondition({ kind: 'self-hp-leq', value: 25 }, state, 0)).toBe(
      true,
    )
    expect(evaluateCondition({ kind: 'self-hp-leq', value: 24 }, state, 0)).toBe(
      false,
    )
  })

  it('opp-hp-eq is exact', () => {
    expect(evaluateCondition({ kind: 'opp-hp-eq', value: 100 }, state, 0)).toBe(
      true,
    )
    expect(evaluateCondition({ kind: 'opp-hp-eq', value: 99 }, state, 0)).toBe(
      false,
    )
  })

  it('opp-cost-geq reads opponent battleZone cost', () => {
    expect(
      evaluateCondition({ kind: 'opp-cost-geq', value: 3 }, state, 0),
    ).toBe(true)
    expect(
      evaluateCondition({ kind: 'opp-cost-geq', value: 4 }, state, 0),
    ).toBe(false)
  })

  it('opp-cost-in is membership', () => {
    expect(
      evaluateCondition({ kind: 'opp-cost-in', values: [3, 4] }, state, 0),
    ).toBe(true)
    expect(
      evaluateCondition({ kind: 'opp-cost-in', values: [0, 1] }, state, 0),
    ).toBe(false)
  })

  it('abyss-attr-count-geq counts the firing player\'s abyss by attribute', () => {
    expect(
      evaluateCondition(
        { kind: 'abyss-attr-count-geq', attr: '闇', count: 2 },
        state,
        0,
      ),
    ).toBe(true)
    expect(
      evaluateCondition(
        { kind: 'abyss-attr-count-geq', attr: '闇', count: 3 },
        state,
        0,
      ),
    ).toBe(false)
  })

  it('abyss-4attr true only when all four base attributes present', () => {
    const all4 = buildState({
      players: [
        buildPlayer({
          abyss: [
            buildCard({ type: '闇' }),
            buildCard({ type: '炎' }),
            buildCard({ type: '電気' }),
            buildCard({ type: '風' }),
          ],
        }),
        buildPlayer(),
      ],
    })
    expect(evaluateCondition({ kind: 'abyss-4attr' }, all4, 0)).toBe(true)
    expect(evaluateCondition({ kind: 'abyss-4attr' }, state, 0)).toBe(false)
  })

  it('power-attr-only true only when EVERY power-charger card matches', () => {
    expect(
      evaluateCondition({ kind: 'power-attr-only', attr: '電気' }, state, 0),
    ).toBe(true)
    expect(
      evaluateCondition({ kind: 'power-attr-only', attr: '闇' }, state, 0),
    ).toBe(false)
  })

  it('power-attr-only false on empty charger (vacuously)', () => {
    const empty = buildState()
    expect(
      evaluateCondition({ kind: 'power-attr-only', attr: '闇' }, empty, 0),
    ).toBe(false)
  })

  it('and is a strict conjunction', () => {
    const cond: Condition = {
      kind: 'and',
      conds: [
        { kind: 'time-night' },
        { kind: 'self-attr', attrs: ['闇'] },
      ],
    }
    expect(evaluateCondition(cond, state, 0)).toBe(true)
    const dayState = buildState({ chronosPosition: 4 })
    expect(evaluateCondition(cond, dayState, 0)).toBe(false)
  })
})

// ── applyEffects — priority ordering, cost gate, HP-0 short-circuit ──────

describe('applyEffects', () => {
  it('fires attack-buff into attackModifier when condition is true', () => {
    const buff = buildCard({
      effect: '夜なら攻撃力+30',
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10, // night
      players: [
        buildPlayer({ setZone: { a: null, b: null, c: buff } }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.players[0].attackModifier).toBe(30)
    expect(next.players[1].attackModifier ?? 0).toBe(0)
  })

  it('skips a non-firing condition without polluting attackModifier', () => {
    const buff = buildCard({
      effect: '昼なら攻撃力+30', // day, but chronos is night
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({ setZone: { a: null, b: null, c: buff } }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.players[0].attackModifier ?? 0).toBe(0)
  })

  it('gates an effect on power-cost — under-powered skips the effect', () => {
    const buff = buildCard({
      effect: '夜なら攻撃力+50',
      cost: 5, // requires 5 power; player has 0
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({ setZone: { a: null, b: null, c: buff } }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.players[0].attackModifier ?? 0).toBe(0)
    // Honest logging: cost gate produces a log line.
    expect(
      next.log.some((l) => l.includes('パワー不足') || l.includes('cost gate')),
    ).toBe(true)
  })

  it('fires when player power meets cost', () => {
    const buff = buildCard({
      effect: '夜なら攻撃力+50',
      cost: 3,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({
          setZone: { a: null, b: null, c: buff },
          powerCharger: [buildCard({ power: 5 })],
        }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.players[0].attackModifier).toBe(50)
  })

  it('attack-debuff stacks onto opponent\'s attackModifier (negative)', () => {
    const debuff = buildCard({
      effect: '夜なら相手の攻撃力-40',
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({ setZone: { a: null, b: null, c: debuff } }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.players[1].attackModifier).toBe(-40)
    expect(next.players[0].attackModifier ?? 0).toBe(0)
  })

  it('hp-heal clamps at 100', () => {
    const heal = buildCard({
      effect: '夜ならHPを20回復',
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({
          hp: 90,
          setZone: { a: null, b: null, c: heal },
        }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.players[0].hp).toBe(100) // clamped, not 110
  })

  it('hp-damage on opponent → 0 ends the game immediately and short-circuits', () => {
    // P0 has TWO damage cards. The first drops P1 to 0; the second should
    // never fire because the game is over.
    const damage = buildCard({
      effect: '夜なら相手のHP-100',
      cost: 0,
      class: 'Enchant',
    })
    const followup = buildCard({
      effect: '夜なら攻撃力+999',
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({
          battleZone: damage,
          setZone: { a: followup, b: null, c: null },
        }),
        buildPlayer({ hp: 50 }),
      ],
    })
    const next = applyEffects(state)
    expect(next.players[1].hp).toBe(0)
    expect(next.winner).toBe(0)
    expect(next.currentPhase).toBe('game_over')
    // Follow-up effect never ran.
    expect(next.players[0].attackModifier ?? 0).toBe(0)
  })

  it('priority player resolves before the other player', () => {
    // Chronos at night, nightPlayerIndex=1 → P1 has priority.
    // Both players have a clock-set effect targeting different positions;
    // whichever fires SECOND wins, so the OTHER player's value should
    // appear in the final state.
    const setMidnight = buildCard({
      effect: '夜なら時計が真夜中になる',
      cost: 0,
      class: 'Enchant',
    })
    const setNoon = buildCard({
      effect: '夜なら時計が正午になる',
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10, // night
      nightPlayerIndex: 1, // P1 has priority
      players: [
        buildPlayer({ setZone: { a: null, b: null, c: setNoon } }),
        buildPlayer({ setZone: { a: null, b: null, c: setMidnight } }),
      ],
    })
    const next = applyEffects(state)
    // P1 fires first (midnight → 0), then P0 fires (noon → 6) and overwrites.
    expect(next.chronosPosition).toBe(6)
  })

  // The four (phase × nightPlayerIndex) combinations of priority resolution —
  // a single sense-check that all four route to the right priority player.
  // Approach: each player has a same-amount buff with a different condition,
  // so we can tell from the log line ORDER which player resolved first.
  // The priority player's log line should appear first.
  describe.each([
    { phase: 'night', chronos: 10, nightIdx: 0 as 0 | 1, priorityIdx: 0 },
    { phase: 'night', chronos: 10, nightIdx: 1 as 0 | 1, priorityIdx: 1 },
    { phase: 'day', chronos: 4, nightIdx: 0 as 0 | 1, priorityIdx: 1 },
    { phase: 'day', chronos: 4, nightIdx: 1 as 0 | 1, priorityIdx: 0 },
  ])(
    'priority routing — phase=$phase, nightPlayerIndex=$nightIdx',
    ({ chronos, nightIdx, priorityIdx, phase }) => {
      it(`P${priorityIdx + 1} resolves first`, () => {
        const buff =
          phase === 'night'
            ? buildCard({ effect: '夜なら攻撃力+10', cost: 0, class: 'Enchant' })
            : buildCard({ effect: '昼なら攻撃力+10', cost: 0, class: 'Enchant' })
        const state = buildState({
          chronosPosition: chronos,
          nightPlayerIndex: nightIdx,
          players: [
            buildPlayer({
              setZone: { a: null, b: null, c: buff },
            }),
            buildPlayer({
              setZone: { a: null, b: null, c: buff },
            }),
          ],
        })
        const next = applyEffects(state)
        // Both fire — both attackModifiers should be +10.
        expect(next.players[0].attackModifier).toBe(10)
        expect(next.players[1].attackModifier).toBe(10)
        // The priority player's log line appears first among effect-firing
        // lines. We search for the substring matching the priority player.
        const effectLogs = next.log.filter((l) => l.includes('攻撃力+10'))
        expect(effectLogs.length).toBeGreaterThanOrEqual(2)
        expect(effectLogs[0].startsWith(`P${priorityIdx + 1}`)).toBe(true)
      })
    },
  )

  it('clock-set respects condition false', () => {
    const card = buildCard({
      effect: '昼なら時計が真夜中になる',
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      chronosPosition: 10, // night → condition false
      players: [
        buildPlayer({ setZone: { a: null, b: null, c: card } }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.chronosPosition).toBe(10)
  })

  it('unimplemented effects log honestly without crashing', () => {
    const card = buildCard({
      effect: '相手のエリアエンチャントを相手のデッキの底に置く', // unparseable
      cost: 0,
      class: 'Enchant',
    })
    const state = buildState({
      players: [
        buildPlayer({ setZone: { a: null, b: null, c: card } }),
        buildPlayer(),
      ],
    })
    const next = applyEffects(state)
    expect(next.log.some((l) => l.includes('未実装') || l.includes('unimplemented'))).toBe(
      true,
    )
  })
})

// ── calculateBattle integration — attackModifier is applied ───────────────

describe('calculateBattle reads attackModifier', () => {
  it('+30 attackModifier raises the displayed attack', () => {
    const p0Card = buildCard({
      class: 'Character',
      night_attack: 20,
      noon_attack: 20,
    })
    const p1Card = buildCard({
      class: 'Character',
      night_attack: 30,
      noon_attack: 30,
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({ battleZone: p0Card, attackModifier: 30 }),
        buildPlayer({ battleZone: p1Card }),
      ],
    })
    const r = calculateBattle(state)
    expect(r.player0Attack).toBe(50) // 20 base + 30 mod
    expect(r.player1Attack).toBe(30)
    expect(r.loser).toBe(1)
  })

  it('negative attackModifier clamps at 0 (debuff > base attack)', () => {
    const card = buildCard({
      class: 'Character',
      night_attack: 30,
      noon_attack: 30,
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({ battleZone: card, attackModifier: -50 }),
        buildPlayer({ battleZone: card }),
      ],
    })
    const r = calculateBattle(state)
    expect(r.player0Attack).toBe(0)
  })

  it('cost gate still wins over attackModifier (0 attack, no buff applied)', () => {
    const expensive = buildCard({
      class: 'Character',
      night_attack: 30,
      noon_attack: 30,
      cost: 5,
    })
    const state = buildState({
      chronosPosition: 10,
      players: [
        buildPlayer({
          battleZone: expensive,
          attackModifier: 100, // wishful thinking — cost gate kills it
          powerCharger: [],
        }),
        buildPlayer({ battleZone: expensive }),
      ],
    })
    const r = calculateBattle(state)
    expect(r.player0Attack).toBe(0)
  })
})

// ── endTurn integration — modifier reset + previous-turn snapshot ────────

// ── corpus coverage — parser against the real cards.json ────────────────

describe('parseEffect — real cards.json coverage', () => {
  const cards = cardsData as Card[]

  it('classifies every card without throwing', () => {
    for (const c of cards) {
      expect(() => parseEffect(c)).not.toThrow()
    }
  })

  it('reports parsed / unimplemented / none counts (snapshot)', () => {
    const counts = { parsed: 0, unimplemented: 0, none: 0 }
    const byAction = { 'attack-buff': 0, 'attack-debuff': 0, 'hp-heal': 0, 'hp-damage': 0, 'clock-set': 0 }
    // Print one sample of every unparsed string that contains 攻撃力+ — these
    // are attack-buff edge cases the parser is missing.
    const missedAttackBuff: string[] = []
    for (const c of cards) {
      const e = parseEffect(c)
      counts[e.kind]++
      if (e.kind === 'parsed') byAction[e.action.kind]++
      if (e.kind === 'unimplemented' && /攻撃力\+/.test(c.effect ?? '')) {
        missedAttackBuff.push(`${c.id}: ${c.effect}`)
      }
    }
    if (missedAttackBuff.length > 0) {
      console.log('missed attack-buff samples (first 10):\n' + missedAttackBuff.slice(0, 10).join('\n'))
    }
    // Documented thresholds. Coverage measured against cards.json at
    // ship time was: parsed=97, attack-buff=86, hp-heal=9, clock-set=2.
    // Some attack-debuff / hp-damage cards exist in cards.json but their
    // conditions reference specific card titles (「（シェードの埃は延長）の
    // キャラクターと入れ替えていたなら」), which the parser can't resolve —
    // so byAction[attack-debuff] = 0 in the corpus even though the engine
    // executes those actions correctly when synthetic effects use them.
    // Slack of 2 below each baseline lets cards.json edits move the
    // unimplementable mass around without flipping the gate; tighten the
    // bound whenever a new pattern adds coverage.
    expect(counts.parsed).toBeGreaterThanOrEqual(95)
    expect(byAction['attack-buff']).toBeGreaterThanOrEqual(80)
    expect(byAction['hp-heal']).toBeGreaterThanOrEqual(8)
    // No card should crash the parser.
    expect(counts.parsed + counts.unimplemented + counts.none).toBe(cards.length)
  })
})

describe('endTurn — Wave 4.1 integration', () => {
  it('resets attackModifier to 0 each turn', () => {
    const state = buildState({
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({
          deck: [buildCard()],
          attackModifier: 30,
          battleZone: buildCard({ class: 'Character' }),
        }),
        buildPlayer({ deck: [buildCard()], attackModifier: -20 }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[0].attackModifier).toBe(0)
    expect(next.players[1].attackModifier).toBe(0)
  })

  it('snapshots a Character battleZone into previousTurnCharacter', () => {
    const ch = buildCard({ class: 'Character', type: '炎' })
    const state = buildState({
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({ deck: [buildCard()], battleZone: ch }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const next = endTurn(state)
    expect(next.players[0].previousTurnCharacter).toBe(ch)
  })

  it('does NOT snapshot a non-Character battleZone (e.g. leftover Enchant)', () => {
    const enchant = buildCard({ class: 'Enchant' })
    const state = buildState({
      cardsPlayedThisTurn: [1, 1],
      players: [
        buildPlayer({
          deck: [buildCard()],
          battleZone: enchant,
          previousTurnCharacter: null,
        }),
        buildPlayer({ deck: [buildCard()] }),
      ],
    })
    const next = endTurn(state)
    // We keep the prior snapshot (null) rather than overwriting with a non-
    // Character: the field is "previous turn's CHARACTER", not "previous
    // turn's battlezone".
    expect(next.players[0].previousTurnCharacter ?? null).toBeNull()
  })
})
