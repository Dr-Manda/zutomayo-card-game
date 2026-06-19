/**
 * Card-effect engine — Wave 4.1.
 *
 * Pattern-matcher over Japanese effect text in src/data/cards.json, producing
 * typed {condition, action} objects. The official rule for resolution
 * (zutomayocard.net rulebook §6):
 *
 *   「キャラクター、エンチャント、エリアエンチャントに効果が記載されている場合、
 *     クロノス上のメダルがある側から効果を発動します。
 *    ※各カードのパワーコストが足りていない場合、効果は発動しません」
 *
 * So: effects fire starting from the player whose seat side matches the
 * current Chronos phase (night/day), each side resolves all of its own
 * cards' effects, and the per-card power-cost gate is evaluated AT the moment
 * the effect is processed.
 *
 * Also: 「どちらかのHPが０になった瞬間にゲームは終了します」 — HP-0 ends the
 * game the instant it happens. After every HP-changing action we check
 * state.winner and bail out of the remaining effect queue.
 *
 * Coverage as of this commit (251 effect-text cards total in cards.json):
 *   - attack-buff           — implemented (largest category)
 *   - attack-debuff (-N)    — implemented (3 cards)
 *   - hp-heal               — implemented (14 cards)
 *   - hp-damage             — implemented (handful)
 *   - clock-set             — implemented (4 cards with conditional set)
 *   - everything else       — tagged `unimplemented`; the engine logs the
 *                             intent and skips the card. The 84 unparseable
 *                             effects (custom card-name interactions,
 *                             player-choice effects, multi-step / delayed
 *                             effects) all end up here.
 *
 * Coverage can be expanded incrementally — every new pattern is one more
 * branch in parseEffect with no broader engine changes required.
 */

import type {
  Attribute,
  Card,
  GameState,
  PlayerState,
} from '@/types/game'
import { getTimePhase } from './chronos'

// ──────────────────────────────────────────────────────────────────────────
// Type system
// ──────────────────────────────────────────────────────────────────────────

/** A boolean predicate over the game state from a given player's POV. */
export type Condition =
  | { kind: 'always' }
  | { kind: 'time-night' }
  | { kind: 'time-day' }
  | { kind: 'time-midnight' }
  // Attribute checks. `attrs` is OR'd — 「炎・風」 means "fire OR wind".
  | { kind: 'self-attr'; attrs: Attribute[] }
  | { kind: 'opp-attr'; attrs: Attribute[] }
  | { kind: 'prev-attr'; attrs: Attribute[] }
  // HP thresholds
  | { kind: 'self-hp-leq'; value: number }
  | { kind: 'opp-hp-eq'; value: number }
  | { kind: 'opp-hp-leq'; value: number }
  // Opponent cost comparisons (★N notation in the source)
  | { kind: 'opp-cost-geq'; value: number }
  | { kind: 'opp-cost-leq'; value: number }
  | { kind: 'opp-cost-in'; values: number[] }
  // Abyss / power-charger content checks
  | { kind: 'abyss-attr-count-geq'; attr: Attribute; count: number }
  | { kind: 'abyss-4attr' }
  | { kind: 'power-attr-only'; attr: Attribute }
  | { kind: 'power-attr-only-opp'; attr: Attribute }
  // 「パワーチャージャーにX属性のカードがある」 — at least one matches.
  | { kind: 'power-attr-exists'; attr: Attribute }
  // Conjunction (the few 「Xかつ、Y」 / 「Xで、Y」 / 「Xで、今がY」 cards)
  | { kind: 'and'; conds: Condition[] }

/** Side-effect category. The `value` is the magnitude (attack delta, heal
 *  amount, draw count, chronos target). Sign is positive — buff vs debuff is
 *  expressed by the kind discriminator. */
export type ActionKind =
  | 'attack-buff'
  | 'attack-debuff'
  | 'hp-heal'
  | 'hp-damage'
  | 'clock-set'

export interface Action {
  kind: ActionKind
  value: number
}

export interface ParsedEffect {
  kind: 'parsed'
  condition: Condition
  action: Action
  /** Original effect-text string the parser consumed, for log lines. */
  source: string
}

/** Effect text was non-empty but does not match any implemented pattern.
 *  These tag the card so the gallery and engine can surface "unimplemented"
 *  honestly rather than silently swallow 33 % of every card's identity. */
export interface UnimplementedEffect {
  kind: 'unimplemented'
  source: string
}

/** No effect text at all. parseEffect returns this for `effect === ""`. */
export interface NoEffect {
  kind: 'none'
}

export type EffectInterpretation = ParsedEffect | UnimplementedEffect | NoEffect

// ──────────────────────────────────────────────────────────────────────────
// Effect-text parser
// ──────────────────────────────────────────────────────────────────────────

const ATTRIBUTES_JP: ReadonlyArray<Attribute> = ['闇', '炎', '電気', '風', 'カオス']

/** Map a single-character attribute or compound list (「炎・風」, 「闇・電気」)
 *  into the {@link Attribute}[] form the condition evaluator expects. */
function parseAttributeList(text: string): Attribute[] | null {
  const tokens = text.split('・').map((t) => t.trim()) as Attribute[]
  const ok = tokens.every((t) => (ATTRIBUTES_JP as readonly string[]).includes(t))
  return ok ? tokens : null
}

/** Map an attribute name in CJK to the typed Attribute. */
function asAttribute(text: string): Attribute | null {
  return (ATTRIBUTES_JP as readonly string[]).includes(text)
    ? (text as Attribute)
    : null
}

/** Decode the ★ count in 「パワーコストが★２以上」 / 「★０か★１」. The Unicode
 *  digits used in source text are 全角 (０-９) — accept both. */
function parseCost(text: string): number | null {
  const fullwidth: Record<string, number> = {
    '０': 0, '１': 1, '２': 2, '３': 3, '４': 4,
    '５': 5, '６': 6, '７': 7, '８': 8, '９': 9,
  }
  if (text in fullwidth) return fullwidth[text]
  const n = parseInt(text, 10)
  return Number.isFinite(n) ? n : null
}

/** Decode a digit run, accepting BOTH ASCII (0-9) and 全角 (０-９) glyphs.
 *  HP / attack action values come through as ASCII in the source; abyss /
 *  charger counts come through as 全角 — same parser regardless. */
function parseDigits(text: string): number | null {
  const fullwidth: Record<string, string> = {
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
  }
  const ascii = text
    .split('')
    .map((ch) => fullwidth[ch] ?? ch)
    .join('')
  const n = parseInt(ascii, 10)
  return Number.isFinite(n) ? n : null
}

/** Try to extract a Condition from a Japanese clause that ends in 「なら」 /
 *  「あるなら」 / 「だけだったなら」. Returns null if no known pattern matches. */
function parseCondition(clause: string): Condition | null {
  // Unconditional triggers — when there is no clause at all (handled by caller).
  if (clause === '') return { kind: 'always' }

  // ── Time-based ───────────────────────────────────────────────────────
  if (/^(?:今が)?夜$/.test(clause)) return { kind: 'time-night' }
  if (/^(?:今が)?昼$/.test(clause)) return { kind: 'time-day' }
  if (/^(?:今が)?真夜中$/.test(clause)) return { kind: 'time-midnight' }

  // ── Conjunction: 「Xかつ、Y」 or 「Xで、今がY」 or 「Xで、Y」 ──────────
  // The conjoiners we see in the corpus are 「かつ、」, 「で、」 (when X is
  // a sub-clause), and 「で、今が」. Treat them all as boolean AND of the
  // two sub-conditions, recursing on each side.
  const conjMatch =
    clause.match(/^(.+?)(?:かつ、|で、(?:今が)?)(.+)$/)
  if (conjMatch) {
    const [, left, right] = conjMatch
    const l = parseCondition(left.trim())
    const r = parseCondition(right.trim())
    if (l && r) return { kind: 'and', conds: [l, r] }
  }

  // ── Self attribute: 「自分のキャラクターカードの属性がX」 ─────────────
  const selfAttrMatch = clause.match(
    /^自分のキャラクターカードの属性が([闇炎電気風カオス・]+)$/,
  )
  if (selfAttrMatch) {
    const attrs = parseAttributeList(selfAttrMatch[1])
    if (attrs) return { kind: 'self-attr', attrs }
  }

  // ── Opponent attribute: 「相手のキャラクターカードの属性がX」 ────────
  // The 4th set also writes shorthand 「相手のキャラクターカードがXか闇」.
  const oppAttrMatch =
    clause.match(/^相手のキャラクターカード(?:の属性)?が([闇炎電気風カオス・か]+)$/)
  if (oppAttrMatch) {
    // 「XかY」 is an OR list expressed with か rather than ・.
    const text = oppAttrMatch[1].replace(/か/g, '・')
    const attrs = parseAttributeList(text)
    if (attrs) return { kind: 'opp-attr', attrs }
  }

  // ── Previous-turn attribute: 「前のターンで使用したキャラクターカードの属性がX」
  const prevAttrMatch = clause.match(
    /^前のターンで使用したキャラクターカードの属性が([闇炎電気風カオス・]+)$/,
  )
  if (prevAttrMatch) {
    const attrs = parseAttributeList(prevAttrMatch[1])
    if (attrs) return { kind: 'prev-attr', attrs }
  }

  // ── HP thresholds ────────────────────────────────────────────────────
  const selfHpMatch = clause.match(/^自分のHPが(\d+)以下$/)
  if (selfHpMatch) {
    const v = parseDigits(selfHpMatch[1])
    if (v !== null) return { kind: 'self-hp-leq', value: v }
  }
  const oppHpEqMatch = clause.match(/^相手のHPが(\d+)$/)
  if (oppHpEqMatch) {
    const v = parseDigits(oppHpEqMatch[1])
    if (v !== null) return { kind: 'opp-hp-eq', value: v }
  }
  const oppHpLeqMatch = clause.match(/^相手のHPが(\d+)以下$/)
  if (oppHpLeqMatch) {
    const v = parseDigits(oppHpLeqMatch[1])
    if (v !== null) return { kind: 'opp-hp-leq', value: v }
  }

  // ── Opponent cost. Two phrasings appear in the source: 「相手のキャラクター
  // カードのパワーコストが★N以上」 (older ★-marked) and 「相手のキャラクター
  // カードがパワーコストN以上」 (newer plain-digit). Accept both. ─────────
  const oppCostGeqMatch = clause.match(
    /^相手のキャラクターカード(?:の|が)パワーコスト(?:が★)?([０-９0-9])以上$/,
  )
  if (oppCostGeqMatch) {
    const v = parseCost(oppCostGeqMatch[1])
    if (v !== null) return { kind: 'opp-cost-geq', value: v }
  }
  const oppCostLeqMatch = clause.match(
    /^相手のキャラクターカード(?:の|が)パワーコスト(?:が★)?([０-９0-9])以下$/,
  )
  if (oppCostLeqMatch) {
    const v = parseCost(oppCostLeqMatch[1])
    if (v !== null) return { kind: 'opp-cost-leq', value: v }
  }
  // 「★０か★１」 — explicit two-value membership.
  const oppCostInMatch = clause.match(
    /^相手のキャラクターカードのパワーコストが★([０-９0-9])か★([０-９0-9])$/,
  )
  if (oppCostInMatch) {
    const a = parseCost(oppCostInMatch[1])
    const b = parseCost(oppCostInMatch[2])
    if (a !== null && b !== null) {
      return { kind: 'opp-cost-in', values: [a, b] }
    }
  }

  // ── Abyss content: 「アビスにX属性のカードがN枚以上ある」 ───────────
  // The count digits are typically 全角 (２枚以上, ３枚以上) — parseDigits
  // accepts both.
  const abyssAttrMatch = clause.match(
    /^アビスに([闇炎電気風カオス])属性のカードが([０-９0-9]+)枚以上ある$/,
  )
  if (abyssAttrMatch) {
    const attr = asAttribute(abyssAttrMatch[1])
    const count = parseDigits(abyssAttrMatch[2])
    if (attr && count !== null) {
      return { kind: 'abyss-attr-count-geq', attr, count }
    }
  }
  // 「アビスに闇・炎・電気・風の４属性のカードがある」 — 4-attribute spread.
  if (
    /^アビスに闇・炎・電気・風の４属性のカードがある$/.test(clause)
  ) {
    return { kind: 'abyss-4attr' }
  }

  // ── Power-charger contains attribute X (at least one):
  // 「パワーチャージャーにX属性のカードがある」
  const powerExistsMatch = clause.match(
    /^パワーチャージャーに([闇炎電気風カオス])属性のカードがある$/,
  )
  if (powerExistsMatch) {
    const attr = asAttribute(powerExistsMatch[1])
    if (attr) return { kind: 'power-attr-exists', attr }
  }

  // ── Power-charger composition: 「パワーチャージャーのカードがX属性だけだった」
  const powerOnlyMatch = clause.match(
    /^パワーチャージャーのカードが([闇炎電気風カオス])属性だけだった$/,
  )
  if (powerOnlyMatch) {
    const attr = asAttribute(powerOnlyMatch[1])
    if (attr) return { kind: 'power-attr-only', attr }
  }
  const powerOnlyOppMatch = clause.match(
    /^相手のパワーチャージャーのカードが([闇炎電気風カオス])属性だけだった$/,
  )
  if (powerOnlyOppMatch) {
    const attr = asAttribute(powerOnlyOppMatch[1])
    if (attr) return { kind: 'power-attr-only-opp', attr }
  }

  return null
}

/** Top-level effect parser. Strips errata-date suffixes ("※2026/4/3：エラッタ対応")
 *  before pattern-matching, since they're metadata, not effect content. */
export function parseEffect(card: Card): EffectInterpretation {
  const raw = card.effect ?? ''
  if (raw.trim() === '') return { kind: 'none' }

  // Strip errata annotations — they appear as suffixes like 「※2026/4/3：エラッタ対応」
  // and the leading clause is what we actually need to parse.
  const text = raw.replace(/※[^\n]*エラッタ対応$/u, '').trim()

  // Errata-only effect text (e.g. 4th_76 「※2026/4/3：エラッタ対応」 with no
  // other content) ends up empty after stripping — treat as no-op.
  if (text === '') return { kind: 'none' }

  // ── Unconditional attack buff: 「自分の攻撃力+N」 (no condition) ───────
  // A handful of cards (1st_30, 1st_89, …) grant a flat buff with no trigger.
  const flatBuffMatch = text.match(/^自分の攻撃力\+(\d+)$/)
  if (flatBuffMatch) {
    const v = parseDigits(flatBuffMatch[1])
    if (v !== null) {
      return {
        kind: 'parsed',
        condition: { kind: 'always' },
        action: { kind: 'attack-buff', value: v },
        source: raw,
      }
    }
  }

  // ── Alt-phrased 4-attribute attack buff:「アビスに４種類の属性があると攻撃力+N」
  // Shorter wording for the same idea as 「アビスに闇・炎・電気・風の４属性...」.
  const fourAttrAltMatch = text.match(
    /^アビスに４種類の属性があると攻撃力\+(\d+)$/,
  )
  if (fourAttrAltMatch) {
    const v = parseDigits(fourAttrAltMatch[1])
    if (v !== null) {
      return {
        kind: 'parsed',
        condition: { kind: 'abyss-4attr' },
        action: { kind: 'attack-buff', value: v },
        source: raw,
      }
    }
  }

  // ── Attack buff: 「(条件)なら攻撃力+N」 (also bare 「夜なら攻撃力+N」) ──
  // The condition can include compound conjunctions ending in 「なら」. The
  // 「、」 after なら is optional and appears mostly in longer conditions.
  const attackBuffMatch = text.match(/^(.+?)なら、?攻撃力\+(\d+)$/)
  if (attackBuffMatch) {
    const [, condStr, value] = attackBuffMatch
    const condition = parseCondition(condStr.trim())
    const v = parseDigits(value)
    if (condition && v !== null) {
      return {
        kind: 'parsed',
        condition,
        action: { kind: 'attack-buff', value: v },
        source: raw,
      }
    }
  }
  // Some attack-buff lines invert the order: 「(条件)あるなら攻撃力+N」. The
  // 「あるなら」 ending lives inside the abyss-content / four-attribute clauses
  // already, so we cover those by trying a different terminator.
  const attackBuffAruMatch = text.match(/^(.+?)あるなら攻撃力\+(\d+)$/)
  if (attackBuffAruMatch) {
    const [, condStr, value] = attackBuffAruMatch
    const condition = parseCondition(condStr.trim() + 'ある')
    const v = parseDigits(value)
    if (condition && v !== null) {
      return {
        kind: 'parsed',
        condition,
        action: { kind: 'attack-buff', value: v },
        source: raw,
      }
    }
  }
  // 「だけだったなら攻撃力+N」 — power-charger composition trigger.
  const attackBuffDakeMatch = text.match(/^(.+?)だけだったなら攻撃力\+(\d+)$/)
  if (attackBuffDakeMatch) {
    const [, condStr, value] = attackBuffDakeMatch
    const condition = parseCondition(condStr.trim() + 'だけだった')
    const v = parseDigits(value)
    if (condition && v !== null) {
      return {
        kind: 'parsed',
        condition,
        action: { kind: 'attack-buff', value: v },
        source: raw,
      }
    }
  }

  // ── HP heal: 「(条件)なら[、]HPをN回復」 / 「(条件)なら[、]HP+N」 ─────
  // The 「、」 is optional — short conditions usually skip it, longer abyss-
  // count conditions usually include it.
  const hpHealMatch = text.match(/^(.+?)なら、?HPを(\d+)回復$/)
  if (hpHealMatch) {
    const [, condStr, value] = hpHealMatch
    const condition = parseCondition(condStr.trim())
    const v = parseDigits(value)
    if (condition && v !== null) {
      return {
        kind: 'parsed',
        condition,
        action: { kind: 'hp-heal', value: v },
        source: raw,
      }
    }
  }
  // 「(条件)なら、HPを+N」 / 「(条件)ならHP+N」 — alternate phrasing.
  const hpPlusMatch = text.match(/^(.+?)なら、?HP\+(\d+)$/)
  if (hpPlusMatch) {
    const [, condStr, value] = hpPlusMatch
    const condition = parseCondition(condStr.trim())
    const v = parseDigits(value)
    if (condition && v !== null) {
      return {
        kind: 'parsed',
        condition,
        action: { kind: 'hp-heal', value: v },
        source: raw,
      }
    }
  }

  // ── Attack debuff: 「(条件)なら相手の攻撃力-N」 ────────────────────────
  const attackDebuffMatch = text.match(/^(.+?)なら、?相手の攻撃力-(\d+)$/)
  if (attackDebuffMatch) {
    const [, condStr, value] = attackDebuffMatch
    const condition = parseCondition(condStr.trim())
    const v = parseDigits(value)
    if (condition && v !== null) {
      return {
        kind: 'parsed',
        condition,
        action: { kind: 'attack-debuff', value: v },
        source: raw,
      }
    }
  }

  // ── HP damage: 「(条件)なら相手のHP-N」 ────────────────────────────────
  const hpDamageMatch = text.match(/^(.+?)なら、?相手のHP-(\d+)$/)
  if (hpDamageMatch) {
    const [, condStr, value] = hpDamageMatch
    const condition = parseCondition(condStr.trim())
    const v = parseDigits(value)
    if (condition && v !== null) {
      return {
        kind: 'parsed',
        condition,
        action: { kind: 'hp-damage', value: v },
        source: raw,
      }
    }
  }

  // ── Clock set: 「(条件)なら、時計が{真夜中|正午}になる」 / 「時計を{真夜中|真昼}にする」
  const clockMidnightMatch =
    text.match(/^(.+?)(?:なら、?時計が真夜中になる|なら、?時計を真夜中にする)$/)
  if (clockMidnightMatch) {
    const condition = parseCondition(clockMidnightMatch[1].trim())
    if (condition) {
      return {
        kind: 'parsed',
        condition,
        // chronosPosition 0 is midnight per src/lib/chronos.ts.
        action: { kind: 'clock-set', value: 0 },
        source: raw,
      }
    }
  }
  const clockNoonMatch =
    text.match(/^(.+?)(?:なら、?時計が正午になる|なら、?時計を真昼にする)$/)
  if (clockNoonMatch) {
    const condition = parseCondition(clockNoonMatch[1].trim())
    if (condition) {
      return {
        kind: 'parsed',
        condition,
        // chronosPosition 6 is mid-day (the 3-8 day range centers there).
        action: { kind: 'clock-set', value: 6 },
        source: raw,
      }
    }
  }

  // Anything else is genuinely beyond the implemented patterns. Custom card
  // name interactions, choose-from-X player decisions, persistent-while-in-play
  // modifiers, multi-step / delayed effects — all land here. We log the
  // intent at apply time rather than silently swallowing it.
  return { kind: 'unimplemented', source: raw }
}

// ──────────────────────────────────────────────────────────────────────────
// Condition evaluator
// ──────────────────────────────────────────────────────────────────────────

function countAttributeInZone(zone: Card[], attr: Attribute): number {
  let n = 0
  for (const c of zone) if (c.type === attr) n++
  return n
}

function uniqueAttributes(zone: Card[]): Set<Attribute> {
  const s = new Set<Attribute>()
  for (const c of zone) s.add(c.type)
  return s
}

/** Evaluate a parsed condition against the current game state from one
 *  player's perspective. Note that 自分 / 相手 / 前のターン all resolve against
 *  `selfIndex` — the player whose card is firing the effect. */
export function evaluateCondition(
  cond: Condition,
  state: GameState,
  selfIndex: 0 | 1,
): boolean {
  const self = state.players[selfIndex]
  const opp = state.players[1 - selfIndex]
  const phase = getTimePhase(state.chronosPosition)

  switch (cond.kind) {
    case 'always':
      return true
    case 'time-night':
      return phase === 'night'
    case 'time-day':
      return phase === 'day'
    case 'time-midnight':
      return state.chronosPosition === 0
    case 'self-attr':
      return (
        self.battleZone !== null &&
        cond.attrs.includes(self.battleZone.type)
      )
    case 'opp-attr':
      return (
        opp.battleZone !== null &&
        cond.attrs.includes(opp.battleZone.type)
      )
    case 'prev-attr': {
      const prev = self.previousTurnCharacter
      return (
        prev !== null &&
        prev !== undefined &&
        cond.attrs.includes(prev.type)
      )
    }
    case 'self-hp-leq':
      return self.hp <= cond.value
    case 'opp-hp-eq':
      return opp.hp === cond.value
    case 'opp-hp-leq':
      return opp.hp <= cond.value
    case 'opp-cost-geq':
      return (
        opp.battleZone !== null && opp.battleZone.cost >= cond.value
      )
    case 'opp-cost-leq':
      return (
        opp.battleZone !== null && opp.battleZone.cost <= cond.value
      )
    case 'opp-cost-in':
      return (
        opp.battleZone !== null &&
        cond.values.includes(opp.battleZone.cost)
      )
    case 'abyss-attr-count-geq':
      return countAttributeInZone(self.abyss, cond.attr) >= cond.count
    case 'abyss-4attr': {
      const s = uniqueAttributes(self.abyss)
      return (
        s.has('闇') && s.has('炎') && s.has('電気') && s.has('風')
      )
    }
    case 'power-attr-only': {
      // 「Xだけだった」 — every power-charger card is attribute X. Vacuously
      // false on an empty charger (no card matches "X").
      if (self.powerCharger.length === 0) return false
      return self.powerCharger.every((c) => c.type === cond.attr)
    }
    case 'power-attr-only-opp': {
      if (opp.powerCharger.length === 0) return false
      return opp.powerCharger.every((c) => c.type === cond.attr)
    }
    case 'power-attr-exists':
      return self.powerCharger.some((c) => c.type === cond.attr)
    case 'and':
      return cond.conds.every((c) => evaluateCondition(c, state, selfIndex))
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sum total power for cost gating — duplicated here to keep effects.ts free
// of a circular import on gameEngine.ts (gameEngine.ts now imports applyEffects
// from this file).
// ──────────────────────────────────────────────────────────────────────────

function totalPower(player: PlayerState): number {
  let s = 0
  for (const c of player.powerCharger) s += c.power
  return s
}

// ──────────────────────────────────────────────────────────────────────────
// Effect application
// ──────────────────────────────────────────────────────────────────────────

/** HP is clamped to [0, 100]. Reaching 0 is the immediate-game-over trigger. */
const HP_MIN = 0
const HP_MAX = 100

/** Apply one action and return a new state. `selfIndex` is the player whose
 *  card is firing the effect; targets are derived from action kind. Returns
 *  the state plus a human-readable log fragment. */
function applyAction(
  state: GameState,
  selfIndex: 0 | 1,
  action: Action,
  cardTitle: string,
): { state: GameState; log: string } {
  const players = [...state.players] as [PlayerState, PlayerState]
  const self = { ...players[selfIndex] }
  const opp = { ...players[1 - selfIndex] }
  let log = ''

  switch (action.kind) {
    case 'attack-buff': {
      const before = self.attackModifier ?? 0
      self.attackModifier = before + action.value
      log = `P${selfIndex + 1} 効果: ${cardTitle} 攻撃力+${action.value} / +${action.value} ATK`
      break
    }
    case 'attack-debuff': {
      // Opponent's attack -N — accumulate onto opponent's attackModifier.
      const before = opp.attackModifier ?? 0
      opp.attackModifier = before - action.value
      log = `P${selfIndex + 1} 効果: ${cardTitle} 相手攻撃力-${action.value} / opp -${action.value} ATK`
      break
    }
    case 'hp-heal': {
      const before = self.hp
      self.hp = Math.min(HP_MAX, before + action.value)
      const gained = self.hp - before
      log = `P${selfIndex + 1} 効果: ${cardTitle} HP+${gained} (${before}→${self.hp}) / heal`
      break
    }
    case 'hp-damage': {
      const before = opp.hp
      opp.hp = Math.max(HP_MIN, before - action.value)
      const taken = before - opp.hp
      log = `P${selfIndex + 1} 効果: ${cardTitle} 相手HP-${taken} (${before}→${opp.hp}) / opp damage`
      break
    }
    case 'clock-set': {
      log = `P${selfIndex + 1} 効果: ${cardTitle} クロノス→${action.value} / clock=${action.value}`
      players[selfIndex] = self
      players[1 - selfIndex] = opp
      return {
        state: {
          ...state,
          players,
          chronosPosition: action.value,
          log: [...state.log, log],
        },
        log,
      }
    }
  }

  players[selfIndex] = self
  players[1 - selfIndex] = opp
  // Game-over on HP-0 immediately overrides whatever next-phase the dispatcher
  // would otherwise enter — the rule is non-negotiable.
  let winner = state.winner
  let currentPhase = state.currentPhase
  if (players[0].hp <= 0 && winner === null) {
    winner = 1
    currentPhase = 'game_over'
  } else if (players[1].hp <= 0 && winner === null) {
    winner = 0
    currentPhase = 'game_over'
  }
  return {
    state: {
      ...state,
      players,
      winner,
      currentPhase,
      log: [...state.log, log],
    },
    log,
  }
}

/** Collect every card currently in a position to fire an effect for one
 *  player. Order: battleZone first, then set zones a/b (rare — should be
 *  empty by process_effects but a leftover Enchant can still be here), then
 *  zone C (the persistent Area Enchant). */
function effectCards(player: PlayerState): Array<{ card: Card; zone: string }> {
  const out: Array<{ card: Card; zone: string }> = []
  if (player.battleZone) out.push({ card: player.battleZone, zone: 'battle' })
  if (player.setZone.a) out.push({ card: player.setZone.a, zone: 'A' })
  if (player.setZone.b) out.push({ card: player.setZone.b, zone: 'B' })
  if (player.setZone.c) out.push({ card: player.setZone.c, zone: 'C' })
  return out
}

/** Resolve every effect-bearing card for ONE player in the priority order. */
function applyPlayerEffects(state: GameState, selfIndex: 0 | 1): GameState {
  let next = state
  for (const { card } of effectCards(next.players[selfIndex])) {
    // HP-0 — bail out of remaining effects per the immediate-end-of-game rule.
    if (next.winner !== null) return next

    const interp = parseEffect(card)
    if (interp.kind === 'none') continue

    if (interp.kind === 'unimplemented') {
      // Log honestly so players can see what didn't fire. The card's
      // identity isn't silently zeroed.
      next = {
        ...next,
        log: [
          ...next.log,
          `P${selfIndex + 1} 効果: ${card.title} (未実装 / unimplemented)`,
        ],
      }
      continue
    }

    // Cost gate — evaluated at processing time per the rule. A character
    // whose power-cost exceeds the player's current total power simply
    // does not fire its effect this turn.
    if (totalPower(next.players[selfIndex]) < card.cost) {
      next = {
        ...next,
        log: [
          ...next.log,
          `P${selfIndex + 1} 効果: ${card.title} パワー不足 / cost gate`,
        ],
      }
      continue
    }

    if (!evaluateCondition(interp.condition, next, selfIndex)) {
      // Condition false — the effect simply doesn't fire. We don't spam the
      // log with a line per non-firing card.
      continue
    }

    const result = applyAction(next, selfIndex, interp.action, card.title)
    next = result.state
  }
  return next
}

/** Resolve effects for both players, priority-first.
 *
 * Priority player = the player whose seat side matches the current chronos
 * phase. nightPlayerIndex is the seat side that's NIGHT — so when the phase
 * is night, priority = nightPlayerIndex; when day, priority = the other.
 *
 * Returns a new GameState. The caller (useGame.advancePhase) sets the next
 * TurnPhase; this function only mutates state.players, chronosPosition,
 * winner, and log. */
export function applyEffects(state: GameState): GameState {
  const phase = getTimePhase(state.chronosPosition)
  const priorityIndex: 0 | 1 =
    phase === 'night'
      ? state.nightPlayerIndex
      : ((1 - state.nightPlayerIndex) as 0 | 1)
  const otherIndex: 0 | 1 = (1 - priorityIndex) as 0 | 1

  let next = applyPlayerEffects(state, priorityIndex)
  if (next.winner !== null) return next
  next = applyPlayerEffects(next, otherIndex)
  return next
}

/** Diagnostic for the gallery — does this card have effect text the engine
 *  can resolve, or is it unimplemented? Lets the UI surface a discreet badge
 *  alongside the 84-ish cards that don't yet fire. */
export function isEffectImplemented(card: Card): boolean {
  return parseEffect(card).kind === 'parsed'
}
