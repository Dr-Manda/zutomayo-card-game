import Link from 'next/link'
import StampBadge from '@/components/StampBadge'

interface Section {
  titleJa: string
  titleEn: string
  blocks: Array<
    | { kind: 'ja'; text: string }
    | { kind: 'en'; text: string }
    | { kind: 'callout'; text: string }
  >
}

const sections: Section[] = [
  {
    titleJa: 'ゲーム概要',
    titleEn: 'Overview',
    blocks: [
      { kind: 'ja', text: '2人対戦カードゲーム。20枚のデッキで相手のHPを0にすれば勝利。' },
      {
        kind: 'en',
        text: "A 2-player card battle game. Build a 20-card deck and reduce your opponent's HP from 100 to 0.",
      },
    ],
  },
  {
    titleJa: 'カードの種類',
    titleEn: 'Card Types',
    blocks: [
      { kind: 'ja', text: '【キャラクター / Character】 バトルゾーンに置いて戦うカード。夜と昼で攻撃力が変わる。' },
      { kind: 'ja', text: '【エンチャント / Enchant】 一時的な効果を与えるカード。使用後パワーチャージャーかアビスへ。' },
      { kind: 'ja', text: '【エリアエンチャント / Area Enchant】 セットゾーンCに置き、継続的な効果を発揮する。' },
    ],
  },
  {
    titleJa: '属性',
    titleEn: 'Attributes',
    blocks: [
      { kind: 'callout', text: '闇 (Darkness) ● 炎 (Flame) ● 電気 (Electric) ● 風 (Wind) ● カオス (Chaos)' },
      { kind: 'ja', text: '5つの属性があり、カード効果に影響する。' },
    ],
  },
  {
    titleJa: 'クロノス（時間システム）',
    titleEn: 'Chronos System',
    blocks: [
      { kind: 'ja', text: 'ゲーム内の時間を管理する時計。12ポジションで夜（青）と昼（赤）に分かれる。' },
      { kind: 'ja', text: '真夜中（☆）からスタートし、カードの時計値の合計分だけ時計回りに進む。' },
      { kind: 'ja', text: '夜なら「夜の攻撃力」、昼なら「昼の攻撃力」が適用される。' },
      {
        kind: 'en',
        text: 'The Chronos clock manages in-game time with 12 positions split into Night (blue) and Day (red).',
      },
      {
        kind: 'en',
        text: "Starts at Midnight (☆). Advances clockwise by the sum of played cards' clock values.",
      },
      { kind: 'en', text: 'Night = use Night Attack, Day = use Day Attack.' },
    ],
  },
  {
    titleJa: 'デッキルール',
    titleEn: 'Deck Rules',
    blocks: [
      { kind: 'callout', text: '● デッキは20枚ぴったり / Exactly 20 cards' },
      { kind: 'callout', text: '● 同じパック・同じ番号のカードは最大2枚まで / Max 2 copies of same card' },
      { kind: 'callout', text: '● キャラクターカードを50%以上 / 50%+ must be Characters' },
    ],
  },
  {
    titleJa: '対戦の流れ',
    titleEn: 'Turn Flow',
    blocks: [
      { kind: 'ja', text: '【ターン1】' },
      { kind: 'callout', text: '1. カード公開 → 2. 時間経過 → 3. 効果処理 → 4. バトル → 5. ドロー' },
      { kind: 'ja', text: '【ターン2以降】' },
      {
        kind: 'callout',
        text: '1. カードセット（勝者1枚、敗者2枚）→ 2. 公開 → 3. 時間経過 → 4. キャラ交代 → 5. エリア交代 → 6. 効果処理 → 7. バトル → 8. ドロー',
      },
      { kind: 'en', text: 'Turn 1: Reveal → Advance Time → Effects → Battle → Draw' },
      {
        kind: 'en',
        text: 'Turn 2+: Set Cards (winner: 1, loser: 2) → Reveal → Advance Time → Replace Character → Replace Area Enchant → Effects → Battle → Draw',
      },
    ],
  },
  {
    titleJa: 'バトル計算',
    titleEn: 'Battle',
    blocks: [
      { kind: 'ja', text: '● クロノスの位置で夜か昼かを判定' },
      { kind: 'ja', text: '● 各プレイヤーの攻撃力を比較' },
      { kind: 'ja', text: '● パワーコスト不足 → 攻撃力0' },
      { kind: 'ja', text: '● 攻撃力の差分がダメージとして敗者のHPから引かれる' },
      { kind: 'en', text: 'Compare attack values based on current Chronos phase.' },
      { kind: 'en', text: 'Insufficient Power Cost = 0 attack.' },
      { kind: 'en', text: 'Damage = difference in attack values.' },
    ],
  },
  {
    titleJa: 'パワーシステム',
    titleEn: 'Power System',
    blocks: [
      { kind: 'ja', text: '● バトルゾーンを離れたカードはパワーチャージャーかアビスへ' },
      { kind: 'ja', text: '● SEND TO POWER値を持つカードはパワーチャージャーへ' },
      { kind: 'ja', text: '● パワーチャージャーのSEND TO POWER合計 = 総パワー' },
      { kind: 'ja', text: '● カードの効果を発動するにはパワーコスト以上の総パワーが必要' },
      {
        kind: 'en',
        text: 'Cards leaving the Battle Zone go to Power Charger (if they have Send to Power) or Abyss.',
      },
      { kind: 'en', text: 'Total Power = sum of all Send to Power values in your Power Charger.' },
      { kind: 'en', text: 'Cards need sufficient Power Cost to activate effects.' },
    ],
  },
  {
    titleJa: '勝利条件',
    titleEn: 'Victory',
    blocks: [
      { kind: 'callout', text: '● 相手のHPを0にする / Reduce opponent HP to 0' },
      { kind: 'callout', text: "● 相手のデッキが空になる（ドロー不能）/ Opponent's deck runs out" },
    ],
  },
]

const pad2 = (n: number) => n.toString().padStart(2, '0')

export default function RulesPage() {
  return (
    <main className="flex-1 w-full bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Top bar with back link */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="font-mono text-sm text-ink hover:text-accent transition-colors"
          >
            ← 戻る / Back
          </Link>
          <span className="font-mono text-xs text-ink-dim">RULES // 規則</span>
        </div>

        {/* Page header stamp */}
        <div className="flex justify-center mb-10">
          <StampBadge size="xl" variant="outline" offset jp="ルール" en="RULES" />
        </div>

        {/* Section anchor nav */}
        <nav
          aria-label="Section navigation"
          className="flex flex-wrap items-center justify-center gap-2 mb-12"
        >
          {sections.map((_, i) => (
            <StampBadge
              key={i}
              size="xs"
              variant="outline"
              href={`#section-${i + 1}`}
              jp={pad2(i + 1)}
              en="§"
            />
          ))}
        </nav>

        {/* Section blocks */}
        <div className="flex flex-col gap-12">
          {sections.map((section, i) => (
            <section key={i} id={`section-${i + 1}`} className="scroll-mt-8">
              <div className="flex items-baseline gap-4 mb-4">
                <span className="font-display ink-offset text-6xl text-accent leading-none">
                  {pad2(i + 1)}
                </span>
                <h2 className="font-display text-2xl text-ink">
                  {section.titleJa}
                  <span className="block font-mono text-xs text-ink-dim mt-1">
                    {section.titleEn}
                  </span>
                </h2>
              </div>

              <div className="font-body text-ink leading-relaxed text-base">
                {section.blocks.map((block, j) => {
                  if (block.kind === 'ja') {
                    return (
                      <p key={j} className="font-body text-base text-ink mb-2">
                        {block.text}
                      </p>
                    )
                  }
                  if (block.kind === 'en') {
                    return (
                      <p key={j} className="font-mono text-sm text-ink-dim mb-3">
                        {block.text}
                      </p>
                    )
                  }
                  return (
                    <div key={j} className="border-2 border-ink bg-paper-deep p-3 my-3">
                      <p className="font-mono text-sm text-ink">{block.text}</p>
                    </div>
                  )
                })}
              </div>

              {/* Inter-section divider (skip after last) */}
              {i < sections.length - 1 && (
                <div
                  aria-hidden
                  className="halftone-pink w-full mt-12"
                  style={{ height: '24px' }}
                />
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-4 border-t border-ink-secondary">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="font-mono text-xs text-ink-dim hover:text-accent transition-colors"
            >
              ← return to entrance
            </Link>
            <span className="font-mono text-xs text-ink-dim">END // 終</span>
          </div>
        </footer>
      </div>
    </main>
  )
}
