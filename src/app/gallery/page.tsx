'use client'

import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import type { Card, Rarity } from '@/types/game'
import { getAllCards, getPackNames } from '@/lib/deckBuilder'
import { ATTRIBUTE_EN } from '@/lib/theme'
import { getLocalCardPath } from '@/lib/cardAssets'
import { isEffectImplemented } from '@/lib/effects'
import CardView from '@/components/CardView'
import StampBadge from '@/components/StampBadge'

/**
 * Card Gallery — full catalog browser.
 *
 * Idiom: a verbatim 3/5-column card grid (matches zutomayocard.net spacing
 * 7px / 10px) underneath a custom pack picker pill and a row of rarity
 * stamps. Selecting a card lifts it into a "spotlight" — the card sits dead
 * center on an overprint wash, with marginalia (title, rarity, attribute,
 * accession line) floating around its edges and a hairline tying each label
 * back to the card. On mobile the marginalia stack above/below instead of
 * orbiting.
 */

const RARITY_OPTIONS: Array<{ key: Rarity | 'ALL'; jp: string; en: string }> = [
  { key: 'ALL', jp: '全', en: 'ALL' },
  { key: 'UR', jp: 'UR', en: 'ULTRA RARE' },
  { key: 'SR', jp: 'SR', en: 'SUPER RARE' },
  { key: 'R', jp: 'R', en: 'RARE' },
  { key: 'N', jp: 'N', en: 'NORMAL' },
  { key: 'SE', jp: 'SE', en: 'SPECIAL' },
]

// sessionStorage keys — scoped to gallery so a future page can persist its own
// filters independently. Cleared on tab close, not navigation, so a quick
// return preserves the player's filter state without polluting localStorage.
const STORAGE_KEY_PACK = 'zcg-gallery-pack'
const STORAGE_KEY_RARITY = 'zcg-gallery-rarity'

const EASE_OUT: [number, number, number, number] = [0.22, 0.61, 0.36, 1]

// Crude kana → romaji is out of scope; we use the card's id-derived slug as a
// machine-readable secondary label under the title in the spotlight.
function romajiFromId(id: string): string {
  return id.replace(/[_-]+/g, ' ').toUpperCase()
}

export default function GalleryPage() {
  const allCards = useMemo(() => getAllCards(), [])
  const packs = useMemo(() => getPackNames(), [])

  const [selectedPack, setSelectedPack] = useState<string>('all')
  const [selectedRarity, setSelectedRarity] = useState<Rarity | 'ALL'>('ALL')
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [packOpen, setPackOpen] = useState(false)
  const [query, setQuery] = useState<string>('')
  // Last card the user opened the spotlight from (or stepped to). Drives focus
  // restoration when the spotlight closes — the keyboard user lands back on
  // the cell they were on instead of the page body.
  const [openerCardId, setOpenerCardId] = useState<string | null>(null)

  const packPickerRef = useRef<HTMLDivElement | null>(null)
  // Map of card.id → its grid cell button so we can restore focus on close.
  // Populated/cleaned by GalleryCell via the registerCellRef callback.
  const cellRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

  // Restore persisted pack + rarity on mount. Hydrating in an effect rather
  // than the useState initializer keeps the SSG-rendered HTML stable (the
  // server has no sessionStorage), avoiding a hydration mismatch.
  useEffect(() => {
    try {
      const storedPack = window.sessionStorage.getItem(STORAGE_KEY_PACK)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (storedPack) setSelectedPack(storedPack)
      const storedRarity = window.sessionStorage.getItem(STORAGE_KEY_RARITY)
      if (
        storedRarity === 'ALL' ||
        storedRarity === 'UR' ||
        storedRarity === 'SR' ||
        storedRarity === 'R' ||
        storedRarity === 'N' ||
        storedRarity === 'SE'
      ) {
        setSelectedRarity(storedRarity)
      }
    } catch {
      // sessionStorage can throw in private mode; silently ignore.
    }
  }, [])

  // Persist pack + rarity on every change.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY_PACK, selectedPack)
      window.sessionStorage.setItem(STORAGE_KEY_RARITY, selectedRarity)
    } catch {
      // ignore quota / private-mode failures
    }
  }, [selectedPack, selectedRarity])

  // --- filter pipeline ---------------------------------------------------
  // Query normalization is inlined into each memo so React Compiler can track
  // the dependency directly (a derived top-level const would block compilation
  // memoization preservation).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allCards.filter((c) => {
      if (selectedPack !== 'all' && !c.pack.includes(selectedPack)) return false
      if (selectedRarity !== 'ALL' && c.rare !== selectedRarity) return false
      if (q) {
        if (
          !c.title.toLowerCase().includes(q) &&
          !c.id.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [allCards, selectedPack, selectedRarity, query])

  // --- per-rarity counts (pack + query scope, ignoring rarity) -----------
  // Used to annotate each rarity pill so a player browsing 「カードを描く前に」
  // can see at a glance how many cards survive switching to SR vs. R, instead
  // of clicking each pill blind.
  const rarityCounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    const counts: Record<Rarity | 'ALL', number> = {
      ALL: 0, UR: 0, SR: 0, R: 0, N: 0, SE: 0,
    }
    for (const c of allCards) {
      if (selectedPack !== 'all' && !c.pack.includes(selectedPack)) continue
      if (q) {
        if (
          !c.title.toLowerCase().includes(q) &&
          !c.id.toLowerCase().includes(q)
        ) {
          continue
        }
      }
      counts.ALL += 1
      counts[c.rare] += 1
    }
    return counts
  }, [allCards, selectedPack, query])

  // --- pack picker: click-outside close ---------------------------------
  useEffect(() => {
    if (!packOpen) return
    function onDocMouseDown(e: MouseEvent) {
      const el = packPickerRef.current
      if (el && !el.contains(e.target as Node)) {
        setPackOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [packOpen])

  // --- spotlight: keyboard nav + hash sync ------------------------------
  const closeSpotlight = useCallback(() => {
    setSelectedCard(null)
    if (typeof window !== 'undefined' && window.location.hash) {
      // Strip the hash without re-triggering a scroll jump.
      const url = window.location.pathname + window.location.search
      window.history.replaceState(null, '', url)
    }
  }, [])

  const stepSpotlight = useCallback(
    (dir: -1 | 1) => {
      if (!selectedCard) return
      const idx = filtered.findIndex((c) => c.id === selectedCard.id)
      if (idx === -1) return
      const next = filtered[(idx + dir + filtered.length) % filtered.length]
      setSelectedCard(next)
      // Track the currently-viewed card so close restores focus to the cell
      // the user actually closed on, not the one they originally opened.
      setOpenerCardId(next.id)
    },
    [filtered, selectedCard],
  )

  // Stable cell select / ref registration callbacks so GalleryCell's memo
  // is preserved across filter changes (the 422-cell grid otherwise rebuilds
  // every cell on every state tick).
  const handleCardSelect = useCallback((card: Card) => {
    setOpenerCardId(card.id)
    setSelectedCard(card)
  }, [])
  const registerCellRef = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      if (el) cellRefs.current.set(id, el)
      else cellRefs.current.delete(id)
    },
    [],
  )

  // Focus restoration: when the spotlight closes (selectedCard → null) and a
  // last-opened cell is remembered, hand focus back so keyboard users can
  // continue tabbing from where they were. Click users see no difference.
  useEffect(() => {
    if (selectedCard) return
    if (!openerCardId) return
    const btn = cellRefs.current.get(openerCardId)
    btn?.focus()
  }, [selectedCard, openerCardId])

  useEffect(() => {
    if (!selectedCard) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSpotlight()
      else if (e.key === 'ArrowLeft') stepSpotlight(-1)
      else if (e.key === 'ArrowRight') stepSpotlight(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedCard, closeSpotlight, stepSpotlight])

  // Push the open card's id into the URL hash so it can be linked / shared.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedCard) return
    if (window.location.hash !== `#${selectedCard.id}`) {
      window.history.replaceState(null, '', `#${selectedCard.id}`)
    }
  }, [selectedCard])

  // Preload the full-res image for the two spotlight neighbors so arrow-key
  // navigation feels instant. Without this each step waits 300–800ms for the
  // 700×978 source to fetch. The grid already used the 480px thumb so the
  // browser cache only holds that; we want the *next* full-res before it's
  // asked for. Two cards × ≤500 KB = a cheap prefetch budget.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedCard || filtered.length === 0) return
    const idx = filtered.findIndex((c) => c.id === selectedCard.id)
    if (idx === -1) return
    const neighbors = [
      filtered[(idx - 1 + filtered.length) % filtered.length],
      filtered[(idx + 1) % filtered.length],
    ]
    for (const n of neighbors) {
      if (!n) continue
      const img = new window.Image()
      img.src = getLocalCardPath(n)
    }
  }, [selectedCard, filtered])

  // On mount: if a hash matches a known card, open the spotlight.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    const match = allCards.find((c) => c.id === hash)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) setSelectedCard(match)
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- render ------------------------------------------------------------
  return (
    <main className="mx-auto w-full max-w-[1248px] px-5 pb-16">
      {/* Page header — back link / display title / count */}
      <div className="my-8 flex items-baseline justify-between">
        <Link
          href="/"
          className="font-mono text-sm text-ink transition-colors hover:text-accent"
        >
          ← 戻る / Back
        </Link>
        <h1 className="font-display ink-offset text-5xl text-ink">GALLERY</h1>
        <span className="font-mono text-xs text-ink-dim">
          {filtered.length}枚
        </span>
      </div>
      <p className="mb-6 text-center font-body text-sm text-ink-dim">
        カードギャラリー
      </p>

      {/* Pack picker — custom dropdown */}
      <div
        ref={packPickerRef}
        className="relative mx-auto w-full max-w-[700px]"
      >
        <button
          type="button"
          onClick={() => setPackOpen((v) => !v)}
          aria-expanded={packOpen}
          aria-haspopup="listbox"
          className="stamp-reset relative flex h-11 w-full items-center border-2 border-ink bg-paper-deep px-4 transition-colors hover:bg-paper md:h-16"
        >
          <span
            className={`mr-3 inline-block font-mono text-base text-ink transition-transform ${
              packOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            ▾
          </span>
          <span className="flex-1 text-center font-display text-base text-ink md:text-xl">
            {selectedPack === 'all' ? '全パック / ALL PACKS' : selectedPack}
          </span>
          <span className="ml-3 w-4" aria-hidden />
        </button>

        <AnimatePresence>
          {packOpen && (
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="absolute left-0 right-0 top-full z-30 max-h-[60vh] overflow-y-auto border-2 border-t-0 border-ink bg-overprint text-paper"
            >
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPack('all')
                    setPackOpen(false)
                  }}
                  className="stamp-reset flex w-full items-center px-4 py-2 text-left font-body text-sm transition-colors hover:bg-overprint/80"
                >
                  <span
                    className={`mr-2 w-3 ${
                      selectedPack === 'all' ? 'text-accent' : 'text-transparent'
                    }`}
                    aria-hidden
                  >
                    ●
                  </span>
                  全パック / ALL PACKS
                </button>
              </li>
              {packs.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPack(p)
                      setPackOpen(false)
                    }}
                    className="stamp-reset flex w-full items-center px-4 py-2 text-left font-body text-sm transition-colors hover:bg-overprint/80"
                  >
                    <span
                      className={`mr-2 w-3 ${
                        selectedPack === p ? 'text-accent' : 'text-transparent'
                      }`}
                      aria-hidden
                    >
                      ●
                    </span>
                    {p}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Name search — placeholder mirrors the bilingual pattern of the pack
          picker. Pressing Escape clears the field. */}
      <div className="mx-auto mt-4 w-full max-w-[700px]">
        <label className="block">
          <span className="sr-only">カード名で検索 / Search by name</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('')
            }}
            placeholder="カード名で検索 / Search by name…"
            className="h-11 w-full border-2 border-ink bg-paper-deep px-4 font-body text-base text-ink placeholder:text-ink-dim focus:outline-none focus:bg-paper md:h-14 md:text-lg"
            aria-label="カード名で検索 / Search by name"
          />
        </label>
      </div>

      {/* Rarity pill row — each pill is annotated with a live count of matches
          within the current pack + search scope, so switching filters is
          predictable instead of blind. */}
      <div className="my-6 flex flex-wrap justify-center gap-3">
        {RARITY_OPTIONS.map((r) => {
          const count = rarityCounts[r.key]
          return (
            <StampBadge
              key={r.key}
              size="sm"
              variant={selectedRarity === r.key ? 'fill-accent' : 'outline'}
              jp={r.jp}
              en={`${r.en} · ${count}`}
              onClick={() => setSelectedRarity(r.key)}
              ariaLabel={`Filter rarity: ${r.en} (${count} matching)`}
            />
          )
        })}
      </div>

      {/* Card grid — verbatim zutomayocard.net spacing. Each cell is its own
          memo'd component with stable callbacks so filter/spotlight changes
          only re-render the handful of cells whose props actually moved. */}
      <div className="grid grid-cols-3 gap-[7px] md:grid-cols-5 md:gap-[10px]">
        {filtered.map((card) => (
          <GalleryCell
            key={card.id}
            card={card}
            onSelect={handleCardSelect}
            registerRef={registerCellRef}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center font-body text-sm text-ink-dim">
          該当するカードはありません / No cards match this filter.
        </p>
      )}

      {/* Spotlight modal */}
      <AnimatePresence>
        {selectedCard && (
          <Spotlight
            card={selectedCard}
            onClose={closeSpotlight}
            onPrev={() => stepSpotlight(-1)}
            onNext={() => stepSpotlight(1)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Spotlight modal
// ---------------------------------------------------------------------------

interface SpotlightProps {
  card: Card
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

function Spotlight({ card, onClose, onPrev, onNext }: SpotlightProps) {
  const cardNumber = card.id.match(/(\d+)/)?.[1] ?? card.id
  const packLabel = card.pack[0] ?? '—'
  const attrEn = ATTRIBUTE_EN[card.type]

  // Move keyboard focus onto the close control as soon as the spotlight
  // mounts so Enter/Space dismiss it without an extra Tab cycle. The
  // restore-to-opener handoff is owned by the gallery page's effect.
  useEffect(() => {
    // StampBadge doesn't forward a ref; aria-label lookup is exact and unique
    // within the dialog at mount time.
    const btn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Close spotlight"]',
    )
    btn?.focus()
  }, [])

  // Power readout: Character cards show their attack split; non-character
  // cards have a single set-power figure on the back of the card.
  const isCharacter = card.class === 'Character'

  // Stagger: backdrop + card first, marginalia 80ms after the card lands.
  const marginaliaDelay = 0.08 + 0.18

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Card spotlight: ${card.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.366, ease: EASE_OUT }}
      // overflow-y-auto + min-h-full so the ~950px-tall content (card + effect)
      // remains scrollable on a 390×844 mobile viewport — without it the effect
      // text was permanently cut off, which is the main reason a player opens
      // the spotlight at all.
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-8"
      style={{ backgroundColor: 'rgba(10, 62, 116, 0.6)' }}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
      {/* Close — top-right of viewport */}
      <div
        className="fixed right-4 top-4 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <StampBadge
          size="sm"
          variant="fill-ink"
          jp="閉じる"
          en="✕ CLOSE"
          onClick={onClose}
          ariaLabel="Close spotlight"
        />
      </div>

      {/* Prev — left edge (hidden on small screens; replaced by inline row below the effect) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onPrev()
        }}
        aria-label="Previous card"
        className="stamp-reset fixed left-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border-2 border-ink bg-paper-deep font-display text-2xl text-ink transition-colors hover:bg-accent-deep hover:text-paper md:flex"
      >
        ‹
      </button>

      {/* Next — right edge */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onNext()
        }}
        aria-label="Next card"
        className="stamp-reset fixed right-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border-2 border-ink bg-paper-deep font-display text-2xl text-ink transition-colors hover:bg-accent-deep hover:text-paper md:flex"
      >
        ›
      </button>

      {/* Centered card + marginalia stage. Stop clicks here from closing. */}
      <div
        className="relative flex w-full max-w-[1000px] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile-only marginalia ABOVE — title / rarity */}
        <div className="mb-4 flex w-full flex-col gap-2 md:hidden">
          <div className="flex items-start justify-between gap-3">
            <MarginaliaTitle card={card} delay={marginaliaDelay} mobile />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: marginaliaDelay, ease: EASE_OUT }}
            >
              <StampBadge
                size="sm"
                variant="fill-accent"
                jp={card.rare}
                en={rarityFullName(card.rare)}
              />
            </motion.div>
          </div>
        </div>

        {/* The card itself — orbit anchor */}
        <motion.div
          key={card.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, delay: 0.08, ease: EASE_OUT }}
          className="relative"
          style={{ maxHeight: '80vh' }}
        >
          <div
            className="relative mx-auto"
            style={{
              // Mobile-first sizing: cap at viewport width minus padding so the
              // card never spills off the sides of a 390px phone, with the same
              // 80vh height ceiling preserving the desktop look.
              // 234/328 ≈ 0.713 width:height.
              width: 'min(100% - 32px, calc(min(80vh, 656px) * 234 / 328))',
              aspectRatio: '234 / 328',
            }}
          >
            <CardView
              card={card}
              className="!w-full !h-full"
            />
          </div>

          {/* Desktop marginalia: orbit the card. Each label is absolutely
              positioned just outside the card edge with a hairline tying
              back to the chrome. */}
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            {/* Top-left — title + romaji */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: marginaliaDelay, ease: EASE_OUT }}
              className="pointer-events-auto absolute right-full top-0 mr-8 w-[240px] text-right"
            >
              <MarginaliaTitle card={card} delay={0} desktop />
              <div className="absolute right-[-32px] top-3 h-px w-8 bg-paper" />
            </motion.div>

            {/* Top-right — rarity stamp */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: marginaliaDelay, ease: EASE_OUT }}
              className="pointer-events-auto absolute left-full top-0 ml-8"
            >
              <StampBadge
                size="sm"
                variant="fill-accent"
                jp={card.rare}
                en={rarityFullName(card.rare)}
              />
              <div className="absolute left-[-32px] top-1/2 h-px w-8 bg-paper" />
            </motion.div>

            {/* Bottom-left — attribute + power */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: marginaliaDelay + 0.04, ease: EASE_OUT }}
              className="pointer-events-auto absolute bottom-2 right-full mr-8 w-[200px] text-right"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-paper/70">
                {attrEn} / {card.type}
              </div>
              {isCharacter ? (
                <div className="mt-1 flex items-baseline justify-end gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-paper/70">
                    NIGHT
                  </span>
                  <span className="font-numeric text-3xl leading-none text-paper">
                    {card.night_attack}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-paper/70">
                    DAY
                  </span>
                  <span className="font-numeric text-3xl leading-none text-paper">
                    {card.noon_attack}
                  </span>
                </div>
              ) : (
                <div className="mt-1 flex items-baseline justify-end gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-paper/70">
                    POWER
                  </span>
                  <span className="font-numeric text-3xl leading-none text-paper">
                    {card.power}
                  </span>
                </div>
              )}
              <div className="absolute right-[-32px] top-1/2 h-px w-8 bg-paper" />
            </motion.div>

            {/* Bottom-right — accession line (pack + card number) */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: marginaliaDelay + 0.04, ease: EASE_OUT }}
              className="pointer-events-auto absolute bottom-2 left-full ml-8 w-[200px]"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-paper/70">
                ACCESSION
              </div>
              <div className="mt-1 font-mono text-xs leading-snug text-paper">
                {packLabel}
              </div>
              <div className="mt-0.5 font-mono text-xs leading-snug text-paper/80">
                NO. {cardNumber}
              </div>
              <div className="mt-1 font-mono text-[10px] leading-snug text-paper/70">
                CLOCK {card.clock} · COST {card.cost}
              </div>
              <div className="absolute left-[-32px] top-1/2 h-px w-8 bg-paper" />
            </motion.div>
          </div>
        </motion.div>

        {/* Mobile-only marginalia BELOW — stats + accession */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: marginaliaDelay, ease: EASE_OUT }}
          className="mt-4 flex w-full flex-col gap-2 text-paper md:hidden"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper/70">
              {attrEn} / {card.type}
            </span>
            {isCharacter ? (
              <span className="font-numeric text-xl leading-none">
                {card.night_attack} <span className="text-[10px]">N</span>{' '}
                <span className="opacity-50">·</span> {card.noon_attack}{' '}
                <span className="text-[10px]">D</span>
              </span>
            ) : (
              <span className="font-numeric text-xl leading-none">
                {card.power}
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-paper/70">
            <span>{packLabel}</span>
            <span>
              NO. {cardNumber} · CLOCK {card.clock} · COST {card.cost}
            </span>
          </div>
        </motion.div>

        {/* Effect text — below the card */}
        {card.effect && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: marginaliaDelay + 0.06,
              ease: EASE_OUT,
            }}
            className="mx-auto mt-6 max-w-md border-2 border-ink bg-paper-deep p-3 font-body text-sm text-ink"
          >
            <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-ink-dim">
              <span>効果 / EFFECT</span>
              {/* Engine-support tag (Wave 4.1). Lets players see at a
                  glance whether the effect text actually fires during a
                  battle — the parser covers ~97 of 251 effect cards
                  today; the rest are unimplemented but still legible. */}
              <span
                className={
                  isEffectImplemented(card)
                    ? 'text-night-deep'
                    : 'text-ink-dim'
                }
                title={
                  isEffectImplemented(card)
                    ? 'Engine resolves this effect during battle.'
                    : 'Effect text is shown but does not yet fire — pattern coverage will expand in later updates.'
                }
              >
                {isEffectImplemented(card)
                  ? '稼働 · LIVE'
                  : '未実装 · NOT LIVE'}
              </span>
            </div>
            {card.effect}
          </motion.div>
        )}

        {/* Mobile-only prev/next row — below the effect box, where it sits
            below the card edge in normal flow. Fixed-position nav buttons
            (above) are md:flex-only so they don't overlap clipped art. */}
        <div className="mt-6 flex items-center justify-center gap-4 md:hidden">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPrev() }}
            aria-label="Previous card"
            className="stamp-reset flex h-12 w-12 items-center justify-center border-2 border-ink bg-paper-deep font-display text-2xl text-ink"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNext() }}
            aria-label="Next card"
            className="stamp-reset flex h-12 w-12 items-center justify-center border-2 border-ink bg-paper-deep font-display text-2xl text-ink"
          >
            ›
          </button>
        </div>
      </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Marginalia atoms
// ---------------------------------------------------------------------------

function MarginaliaTitle({
  card,
  delay,
  desktop = false,
  mobile = false,
}: {
  card: Card
  delay: number
  desktop?: boolean
  mobile?: boolean
}) {
  const align = desktop ? 'text-right' : 'text-left'
  return (
    <motion.div
      initial={mobile ? { opacity: 0, y: -4 } : false}
      animate={mobile ? { opacity: 1, y: 0 } : undefined}
      transition={mobile ? { duration: 0.3, delay, ease: EASE_OUT } : undefined}
      className={`${align} ${desktop ? 'text-paper' : 'text-paper'}`}
    >
      <div className="font-display text-xl leading-tight">{card.title}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-paper/70">
        {romajiFromId(card.id)}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rarityFullName(r: Rarity): string {
  switch (r) {
    case 'UR':
      return 'ULTRA RARE'
    case 'SR':
      return 'SUPER RARE'
    case 'R':
      return 'RARE'
    case 'N':
      return 'NORMAL'
    case 'SE':
      return 'SPECIAL'
  }
}

// ---------------------------------------------------------------------------
// GalleryCell — memo'd grid cell wrapping a bare CardView.
// ---------------------------------------------------------------------------

interface GalleryCellProps {
  card: Card
  onSelect: (card: Card) => void
  registerRef: (id: string, el: HTMLButtonElement | null) => void
}

const GalleryCell = memo(function GalleryCell({
  card,
  onSelect,
  registerRef,
}: GalleryCellProps) {
  const handleClick = useCallback(() => onSelect(card), [onSelect, card])
  // Stable per-card ref callback so React only invokes it on mount/unmount,
  // not on every render.
  const handleRef = useCallback(
    (el: HTMLButtonElement | null) => registerRef(card.id, el),
    [registerRef, card.id],
  )
  return (
    <CardView
      ref={handleRef}
      card={card}
      bare
      thumb
      onClick={handleClick}
      className="!w-full"
    />
  )
})
