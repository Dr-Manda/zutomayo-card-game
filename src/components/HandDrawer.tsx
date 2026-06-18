'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Card } from '@/types/game'
import CardView from './CardView'
import StampBadge from './StampBadge'
import { useSfx } from './SfxProvider'

export interface HandDrawerProps {
  hand: Card[]
  /** Single-select: fires when a card is tapped in drawer state. */
  onSelect?: (handIndex: number) => void
  /** Multi-select: fires with all selected indices when confirm is tapped. */
  onConfirm?: (selectedIndices: number[]) => void
  /** Default 1; if >1, drawer becomes a multi-select confirm flow. */
  maxSelections?: number
  /** Minimum number of selections required before the confirm stamp activates.
   *  Defaults to 1. Use to enforce "must set exactly N" rules (e.g. loser owes 2). */
  minSelections?: number
  /** Optional dimming filter — cards not matching are non-interactive at 40% opacity. */
  filterClass?: 'Character' | 'Enchant' | 'Area Enchant'
  /** Title shown at top of expanded drawer. */
  title?: string
  /** Subtitle below title, font-mono dim. */
  subtitle?: string
  /** JP label for the primary confirm stamp. */
  confirmLabel?: string
  /** JP label for the optional skip stamp. */
  skipLabel?: string
  /** When provided, renders the secondary "skip / keep all" stamp. */
  onSkip?: () => void
  /** Open the drawer expanded on mount — for screens whose ONLY purpose is
   *  to make a hand decision (mulligan, initial placement, set cards). */
  initialExpanded?: boolean
}

/**
 * HandDrawer — fan-and-drawer hand interaction.
 *
 * Replaces the old HandSelector. Two states managed internally:
 *
 *   1. **Fan**     — a compact, always-visible peek at the bottom of the
 *                    viewport. Tap to expand into the drawer.
 *   2. **Drawer**  — a 70vh sheet sliding up from the bottom with full-size
 *                    cards in a horizontal snap-scroll. Single-select mode
 *                    fires `onSelect` and closes immediately; multi-select
 *                    mode tracks `selected` until confirm.
 *
 * The component is self-contained — it owns its expanded/selected state and
 * exposes only the high-level select/confirm/skip callbacks. The caller
 * just feeds in a hand and reacts to the outgoing decisions.
 */
export default function HandDrawer({
  hand,
  onSelect,
  onConfirm,
  maxSelections = 1,
  minSelections = 1,
  filterClass,
  title = '手札 / Hand',
  subtitle,
  confirmLabel,
  skipLabel,
  onSkip,
  initialExpanded = false,
}: HandDrawerProps) {
  // If `minSelections` exceeds the hand size, clamp to hand size — prevents a
  // soft-lock when the player owes 2 but has only 1 card. With an empty hand
  // SetCardsScreen will auto-continue before this component matters.
  const effectiveMin = Math.min(minSelections, Math.max(0, hand.length))
  const [expanded, setExpanded] = useState(initialExpanded)
  const [selected, setSelected] = useState<number[]>([])
  const { play } = useSfx()
  // StrictMode dev double-mounts would re-fire the open cue. Latch on
  // expanded→true; reset on expanded→false so re-opens still cue.
  const openFiredRef = useRef(false)
  // The fan-state trigger button — focus restoration target on drawer close.
  // Set by the fan render branch via ref callback; tickets if the fan ever
  // unmounts mid-life (it doesn't today, but the ref-clear keeps GC honest).
  const fanRef = useRef<HTMLButtonElement | null>(null)
  // Container for the drawer's card row — used as the focus scope for "focus
  // first card on open" and for the keyboard Escape listener mount.
  const drawerCardsRef = useRef<HTMLDivElement | null>(null)
  // We only restore focus to the fan button if the drawer was OPENED at some
  // point during this mount — otherwise (initialExpanded=true with no opener)
  // there's no sensible target and stealing focus from the page is rude.
  const everOpenedRef = useRef(false)

  // Drawer raise → flip cue.
  useEffect(() => {
    if (!expanded) {
      openFiredRef.current = false
      return
    }
    if (openFiredRef.current) return
    openFiredRef.current = true
    play('card-flip')
  }, [expanded, play])

  // Keyboard / focus management. The drawer is used dozens of times per
  // hot-seat game (mulligan, initial placement, every set step) — a keyboard
  // user must be able to dismiss it with Escape and not be stranded after
  // close. Three concerns wired here:
  //   1. On open: focus the first allowed card so Enter/Space confirms it
  //      without an extra Tab cycle.
  //   2. While open: Escape closes (without selecting).
  //   3. On close: restore focus to the fan trigger, but only if the user
  //      had actually opened the drawer in this mount.
  useEffect(() => {
    if (expanded) {
      everOpenedRef.current = true
      const firstBtn =
        drawerCardsRef.current?.querySelector<HTMLButtonElement>('button')
      // Defer one frame so the slide-up animation has committed and the
      // user doesn't see the focus ring flash on an offscreen card.
      const raf = window.requestAnimationFrame(() => firstBtn?.focus())
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setExpanded(false)
      }
      document.addEventListener('keydown', onKey)
      return () => {
        window.cancelAnimationFrame(raf)
        document.removeEventListener('keydown', onKey)
      }
    }
    // Drawer just closed — restore focus to the fan trigger.
    if (everOpenedRef.current) {
      fanRef.current?.focus()
    }
  }, [expanded])

  const fitsFilter = (card: Card) => !filterClass || card.class === filterClass

  // Single-select short-circuits to onSelect/onConfirm and closes the drawer.
  // Multi-select toggles inclusion, capped at maxSelections.
  const toggleSelect = (i: number) => {
    if (!fitsFilter(hand[i])) return
    if (maxSelections === 1) {
      play('card-flip')
      if (onSelect) onSelect(i)
      else if (onConfirm) onConfirm([i])
      setExpanded(false)
      setSelected([])
      return
    }
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i)
      if (prev.length >= maxSelections) return prev
      play('card-flip')
      return [...prev, i]
    })
  }

  const handleConfirm = () => {
    play('card-set')
    if (onConfirm) onConfirm(selected)
    setExpanded(false)
    setSelected([])
  }

  const handleSkip = () => {
    if (onSkip) onSkip()
    setExpanded(false)
    setSelected([])
  }

  // Center index used to fan cards symmetrically around the middle.
  const centerIdx = (hand.length - 1) / 2

  return (
    <>
      {/* ─── Fan state — bottom-center peek ────────────────────────── */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            key="fan"
            className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-2"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <span className="font-mono text-xs text-ink-dim mb-1">
              手札 / Hand · {hand.length}枚 — タップで開く / tap to open
            </span>
            <button
              ref={fanRef}
              type="button"
              onClick={() => setExpanded(true)}
              className="stamp-reset relative"
              style={{ width: 240, height: 110 }}
              aria-label="Open hand"
            >
              {hand.map((card, i) => {
                const offset = i - centerIdx
                return (
                  <div
                    key={`${card.id}-${i}`}
                    className="absolute left-1/2 top-0 pointer-events-none"
                    style={{
                      transform: `translateX(calc(-50% + ${offset * 28}px)) translateY(${Math.abs(offset) * 4}px) rotate(${offset * 5}deg)`,
                      transformOrigin: 'center bottom',
                      width: 70,
                      height: 98,
                      zIndex: 10 - Math.abs(Math.round(offset)),
                    }}
                  >
                    {/* `!w-[70px]` overrides CardView's fixed compact w-[164px] —
                        otherwise each card renders 2.3× its slot and spills 120px
                        past the bottom screen edge. */}
                    <CardView card={card} compact thumb className="!w-[70px]" />
                  </div>
                )
              })}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Drawer state — fullscreen backdrop + bottom sheet ──────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="drawer-backdrop"
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(10,62,116,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(false)}
          >
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-paper-deep border-t-2 border-ink flex flex-col"
              style={{ height: '70vh' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              {/* Header — title + subtitle on the left, close stamp on the right. */}
              <div className="flex items-start justify-between px-4 py-3 border-b border-ink-secondary">
                <div>
                  <h2 className="font-display text-xl text-ink leading-none">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="font-mono text-xs text-ink-dim mt-1">
                      {subtitle}
                    </p>
                  )}
                </div>
                <StampBadge
                  size="xs"
                  variant="outline"
                  jp="閉じる"
                  en="✕ CLOSE"
                  onClick={() => setExpanded(false)}
                />
              </div>

              {/* Cards row — horizontal scroll with snap. drawerCardsRef
                  anchors the "focus first card on open" effect. */}
              <div
                ref={drawerCardsRef}
                className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
              >
                <div className="flex gap-3 px-4 py-4 h-full items-center">
                  {hand.map((card, i) => {
                    const allowed = fitsFilter(card)
                    // Selection-order index → slot letter. The engine maps the
                    // first chosen card to slot A and slot A characters advance
                    // to the battle zone on replace_character — so surfacing
                    // A/B here is rules-significant, not cosmetic.
                    const selectionOrder = selected.indexOf(i)
                    const slotLetter =
                      selectionOrder === 0 ? 'A'
                      : selectionOrder === 1 ? 'B'
                      : null
                    return (
                      <div
                        key={`${card.id}-${i}`}
                        className="flex-shrink-0 snap-center relative"
                        style={{ width: 234 }}
                      >
                        <CardView
                          card={card}
                          thumb
                          selected={selected.includes(i)}
                          onClick={allowed ? () => toggleSelect(i) : undefined}
                          className={
                            allowed ? '' : 'opacity-40 pointer-events-none'
                          }
                        />
                        {slotLetter && maxSelections > 1 && (
                          <div
                            aria-hidden="true"
                            className="absolute -top-2 -left-2 z-10 flex h-10 w-10 items-center justify-center border-2 border-ink bg-accent-deep text-paper font-display text-xl leading-none"
                            title={
                              slotLetter === 'A'
                                ? 'Slot A — enters battle zone if Character'
                                : 'Slot B'
                            }
                          >
                            {slotLetter}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer — confirm / skip stamps. Hidden if neither handler given. */}
              {(onConfirm || onSkip) && (
                <div className="flex gap-3 justify-center px-4 py-3 border-t border-ink-secondary">
                  {onSkip && (
                    <StampBadge
                      size="lg"
                      variant="outline"
                      jp={skipLabel || 'スキップ'}
                      en="SKIP"
                      onClick={handleSkip}
                    />
                  )}
                  {onConfirm && (
                    <StampBadge
                      size="lg"
                      variant="fill-accent"
                      jp={confirmLabel || 'セット'}
                      en={`SET (${selected.length}/${effectiveMin === maxSelections ? maxSelections : `${effectiveMin}-${maxSelections}`})`}
                      onClick={
                        selected.length >= effectiveMin ? handleConfirm : undefined
                      }
                      disabled={selected.length < effectiveMin}
                      sfx="none"
                    />
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
