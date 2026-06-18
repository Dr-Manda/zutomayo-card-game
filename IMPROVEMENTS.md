# ZUTOMAYO CARD GAME — Improvement Backlog

Synthesized 2026-06-10 from six independent review reports: official-rules accuracy, engine/state-machine correctness, UX + mobile usability, performance, GitHub Pages deploy readiness, and accessibility/polish. Duplicates have been merged; 40 items total.

## Progress (last updated 2026-06-18)

- **Wave 1** (correctness blockers, 9 items) — ✓ SHIPPED.
- **Wave 2** (core experience, 13 items) — ✓ SHIPPED.
- **Wave 3** (ship-it polish, 8 items) — ✓ SHIPPED.
- **Wave 3.5** (QA-discovered regressions, 2 items) — ✓ SHIPPED (Session 1, 2026-06-18). See "Wave 3.5" section below.
- **Wave 4** (depth & hygiene, 10 items) — IN PROGRESS across multiple sessions. Per-item status is on each subsection heading.
  - 4.1 (card-effect engine) — DEFERRED to its own dedicated session.

## How to use this file

- This backlog is designed to be handed to Claude (ultracode) **one wave at a time**. Each wave is independently shippable: the app builds, runs, and is strictly better after each one.
- Execute waves in order. Within a wave, items are ordered so that dependencies come first (dependencies are called out explicitly with "Depends on").
- **After every wave run: `npx tsc --noEmit`, the project lint, and `npm run build`** — all three must pass before the wave is considered done. Wave 1 items are pure logic; `tsc` passes today, so any new error is a regression.
- All file paths are relative to the repo root: `C:\Users\expre\OneDrive\Documents\zutomayo-card-game`. Line numbers were verified at review time and may drift a few lines as earlier items land.
- Japanese quotes are from the **official rules** (zutomayocard.net/start-guide/ and ルールガイド Ver.1.0.0, 2026/2/16). They are the ground truth for Wave 1 and Wave 4 — do not paraphrase them away; implement exactly what they say.
- Environment note: the repo currently lives inside OneDrive. `npm install` / `next build` churn ~22,000 files / ~820 MB of sync per run. Before the test/CI work in Wave 4, the human should move the project out of OneDrive or exclude `node_modules`, `.next`, and `out` from sync.

---

## Wave 1 — Correctness & blockers (9 items)

Rules divergences, engine bugs, soft-locks, and hidden-information leaks. After this wave the game plays by the official rules and cannot dead-end.

### 1.1 Fix end-of-turn draw count — always draws 1, and from the wrong turn's battle result

**Size:** M · **Files:** `src/lib/gameEngine.ts:322-340`, `src/lib/gameEngine.ts:109-130`, `src/types/game.ts:54-64`

Official rule: 「このターンに手札から出したカードの枚数分だけデッキからカードを引きます」 — at end of turn each player draws **exactly as many cards as they played from hand this turn** (previous battle's winner set 1 → draws 1; loser set 2 → draws 2). Two stacked bugs in `endTurn()`: (a) `drawCards(player, cardsPlayed > 0 ? 1 : 0)` always draws 1 since `cardsPlayed` is always 1 or 2; (b) `cardsPlayed` is derived from `state.lastBattleWinner === i ? 1 : 2`, but `lastBattleWinner` was already overwritten by THIS turn's battle earlier in the same turn — the set count was determined by the PREVIOUS turn's result, so the source is wrong even once (a) is fixed; also `null === i` on a drawn battle yields 2 for both players, contradicting `getCardsToSet`'s draw→1. Consequence: the loser's hand shrinks by 1 every lost turn until it empties (soft-lock, see 1.5), and deck-out pacing — a real victory route (「ターン終了時にデッキがなくなりカードが引けない場合、引けないプレイヤーの負け」) — is wrong.

Fix: add `cardsPlayedThisTurn: [number, number]` to `GameState`; initialize in `initializeGame`; increment in `setCardsFromHand` by the number of selections actually applied and in the turn-1 initial-placement path; reset to `[0,0]` each turn (in `endTurn` after drawing). In `endTurn` replace the draw with `drawCards(player, state.cardsPlayedThisTurn[i])`, keeping the existing deckEmpty→loss check (`drawCards` already reports partial draws).

### 1.2 Sweep ALL leftover set-zone cards at end of turn (remove the Character exemption)

**Size:** S · **Files:** `src/lib/gameEngine.ts:306-320` (the `card.class !== 'Character'` condition at :312), `src/lib/gameEngine.ts:119-126`, `src/lib/gameEngine.ts:167-198`

Official end-of-turn step 9: 「このターンに手札から出したカードがセットゾーンA、またはBにあれば、そのカードを SEND TO POWER の有無に応じてパワーチャージャー/アビスに置きます」 — EVERY card still in set zone A/B at end of turn moves to power charger or abyss, **no class exception**. The implementation skips Characters, so a slot-B Character left over after `replaceCharacter` promotes slot A: survives into the next turn, (a) gets its clock double-counted by `advanceTime`, (b) gets wrongly auto-promoted to the battle zone as if newly set, and (c) if the player sets new cards, `setCardsFromHand` overwrites it with no occupancy check — the card vanishes from the game entirely (not in hand, deck, charger, or abyss).

Fix: delete the `card.class !== 'Character'` condition so all remaining A/B cards route to `powerCharger` if `card.power > 0` else `abyss` (`power === 0` in cards.json reliably encodes "no SEND TO POWER"; 204 cards have power 0, none null). Defense-in-depth: in `setCardsFromHand`, push any non-null card being overwritten into `player.abyss` before assignment.

### 1.3 Stop re-counting zone C (area enchant) clock in advanceTime every turn

**Size:** S · **Files:** `src/lib/gameEngine.ts:136-152` (delete the `if (c) totalClock += c.clock` line at :144) · **Depends on:** 1.2

Official: 「このターンに各プレイヤーが手札から出したカードに書かれた時計の数値を合計し、その数だけクロノス上のメダルを進めます」 — time advances only by the clocks on **this turn's hand-played cards**. At the `advance_time` phase, a newly set area enchant is still in slot A/B; slot C holds an area enchant placed on a *previous* turn — yet `advanceTime` sums a, b, AND c, so a persisting area enchant adds its clock to Chronos every turn it stays in play, racing time ahead. Time pacing drives the night/day attack flips, so this visibly distorts every game in which an area enchant is played. With 1.2 landed, slots a/b at advance_time contain exactly this turn's hand-played cards, so removing the `c` term makes the sum faithful to the rule.

### 1.4 Initial placement: allow ANY card; flip non-Characters to power/abyss on reveal (also fixes the zero-Character soft-lock)

**Size:** M · **Files:** `src/lib/gameEngine.ts:95-107`, `src/components/battle/InitialPlacementScreen.tsx:42-52`, `src/hooks/useGame.ts:69-83`, `src/components/battle/RevealScreen.tsx`

Official prep steps 8–9: 「手札からカードを１枚選びバトルゾーンに裏向きにして置きます」 then 「『嫌（やぁ）』と言って、セットしたカードを同時にめくり、ゲームを開始します。※めくられたカードがキャラクター以外のカードなら、すぐにパワーチャージャー/アビスに置きます」 — ANY card may be placed face-down; a revealed non-Character immediately goes to the Power Charger (if it has SEND TO POWER) or Abyss, leaving an empty battle zone (attack 0) but seeded power. Turn 1's time advance explicitly counts those cards: 「※対戦準備時に、パワーチャージャー/アビスに置いたカードの時計も含まれます」. The implementation forbids all of this (`placeInitialBattleCard` rejects non-Characters; `InitialPlacementScreen` filters to `filterClass="Character"`), removing a real official strategy — and a 5-card hand with zero Characters (~0.4% per player per game, also reachable deliberately via mulligan) leaves nothing clickable: hard soft-lock.

Two reviewers proposed different fixes (forced redraw vs. official any-card rule). **Implement the official rule** — it is both more accurate and eliminates the soft-lock. Fix: remove the class guard in `placeInitialBattleCard`; drop `filterClass` from `InitialPlacementScreen`. In `useGame.placeInitial` (after both placed, before `advanceTime`): for each player whose battleZone card is not a Character, move it to `powerCharger` if `card.power > 0` else `abyss`, null the battleZone, and accumulate its clock into a `prepClock` consumed by the turn-1 branch of `advanceTime` (replace the current turn-1 battle-zone-clock loop with battle-zone Character clocks + prep power/abyss clocks). `calculateBattle` already treats a null battleZone as 0 attack. Update `RevealScreen` to show the flip-to-power/abyss outcome.

### 1.5 Auto-continue SetCardsScreen with an empty hand (soft-lock)

**Size:** S · **Files:** `src/components/battle/SetCardsScreen.tsx:44-51`, `src/components/HandDrawer.tsx:240-246`

`SetCardsScreen` passes no `onSkip` to `HandDrawer`, and the confirm stamp is `disabled={selected.length === 0}` — with an empty hand (reachable today via bug 1.1; still reachable after the fix if a player sets their whole hand) the turn can never advance. Fix: when `hand.length === 0`, call `onConfirm([])` automatically (a `useEffect`, or render a "手札なし — 続行 / no cards — continue" stamp). The engine path already tolerates an empty selections array (the loop and filter are no-ops) — verify and keep it that way.

### 1.6 Fix mulligan order: draw replacements BEFORE reshuffling the discards

**Size:** S · **Files:** `src/lib/gameEngine.ts:71-93` (the swap is at :80-85)

Official: 「…手札から選んだカードを裏向きのままフィールドのわかりやすい場所に伏せます。その後、宣言した枚数のカードをデッキの上から引き、フィールドに伏せていたカードをデッキに戻し再度よく混ぜます」 — set the discards aside, draw the declared number from the top of the deck FIRST, and only then shuffle the discards back in; the discarded cards can never be redrawn in the mulligan. The implementation does the reverse, so a player can draw back the exact cards they threw away. Fix in `mulligan()`: draw `cardIndices.length` from the untouched remaining deck, then `result.player.deck = shuffleDeck([...result.player.deck, ...returnedCards])`. The once-only and any-number aspects are already correct — don't change them.

### 1.7 Enforce exact set-card counts (loser must set 2, not "up to 2")

**Size:** S · **Files:** `src/components/HandDrawer.tsx:235-246`, `src/components/battle/SetCardsScreen.tsx:44-51`, optionally `src/lib/gameEngine.ts:109-130`

Official set counts are fixed amounts, not maxima: 「前のターンのバトルで攻撃力が高く勝利したプレイヤーは…セットできるカードが『１枚』になります。…敗北したプレイヤーは…『２枚』になります。…引き分け…『１枚』になります」. `getCardsToSet()` encodes this correctly, but `HandDrawer`'s confirm enables at `selected.length > 0`, so a loser owing 2 can confirm with 1, gaining hand economy. Fix: add a `minSelections?: number` prop to `HandDrawer` (default 1), disable confirm until `selected.length >= minSelections`, show the requirement in the SET (x/y) label; pass `minSelections={Math.min(count, hand.length)}` from `SetCardsScreen` (the clamp avoids re-introducing a soft-lock with a short hand). Optionally assert the exact count in `setCardsFromHand`.

### 1.8 Hot-seat privacy: make the pass cover opaque and cover the P2→P1 handoffs

**Size:** M · **Files:** `src/components/CardBackCover.tsx:70`, `src/app/battle/page.tsx:25-31, 94-98, 141-167, 173-179`

Three leaks defeat the pass-device screen in a hidden-information game: (1) `CardBackCover`'s backdrop is `rgba(10,62,116,0.6)` — only 60% opaque — and the dispatcher intentionally renders the previous P1 screen underneath, whose `HandDrawer` fan shows P1's cards FACE-UP, readable through the wash. (2) After P2's mulligan, `subScreen` jumps straight to `initial_p1` with P1's hand fan visible while P2 still holds the device. (3) Tapping END TURN on the shared board immediately mounts `set_p1` with P1's hand — whoever tapped (often P2) sees it. `passLabel` is also hardcoded to "プレイヤー 2 / Player 2".

Fix: (a) while `passActive`, skip rendering the underlying `body` entirely (preferred over just making the backdrop opaque — it also kills the fade-in flash window); (b) add `pass_to_p1_initial` and `pass_to_p1_set` to the `BattleSubScreen` union, route `mulligan_p2 → pass_to_p1_initial` and `end_turn → pass_to_p1_set`, extend `handlePassReady` and the `underlyingSubScreen` mapping (a pass_to_p1 state must never render a P2 screen underneath); (c) derive `passLabel` and `isNightPlayer` from the target player index instead of hardcoding index 1.

### 1.9 Resolve simultaneous deck-out as a draw (currently always awards the win to P2)

**Size:** S · **Files:** `src/lib/gameEngine.ts:328-340`, `src/hooks/useGame.ts:157-158`

`endTurn` draws sequentially (i = 0 then 1) and returns game_over the moment one draw fails — but decks are equal-sized and draws symmetric, so simultaneous deck-out is the COMMON case, and player 0 is always checked first and always loses. The early return also skips player 1's set-zone sweep, leaving stale cards on the game-over screen. Fix: perform both players' sweeps and draws first, collecting `deckEmpty` flags; both true → `winner = null` with a draw log (GameOverScreen already renders a DRAW branch); exactly one true → other player wins. Note: `useGame`'s gameOver check is `winner !== null` — also gate on `currentPhase === 'game_over'` (or a boolean flag) so a drawn game actually reaches the game-over screen.

---

## Wave 2 — Core experience (13 items)

The UX/mobile/feedback work that makes it feel like a real game on a 390px phone and a desktop. **Item 2.1 first — every other layout fix depends on it.**

### 2.1 Remove the 62.5% root font-size (it shrinks every Tailwind rem utility to 62.5%)

**Size:** M · **Files:** `src/app/globals.css:3-5, 76-85` · **Do first in this wave**

`:root { font-size: 62.5% }` (1rem = 10px) with compensation only on `body` breaks Tailwind v4's rem-based theme: `text-xs` renders 7.5px, `h-12` 30px, `max-w-lg` 320px (the battle board even on a 1280px desktop), `max-w-sm` 240px (home menu buttons). All font-mono labels (HP, PWR, DECK, log) render at 7.5–8.75px — illegible on a phone. Fix: delete `font-size: 62.5%` from `:root`, change body `font-size: 1.6rem` to `1rem`, then do a one-pass visual check of all five routes for values implicitly tuned to 10px-rem: `max-w-lg` on `src/components/battle/BattleBoard.tsx:77` (becomes 512px — fine), home `max-w-sm`, rules `max-w-3xl`, and `text-Nxl` headings that grow 1.6×. The hero wordmark uses px-based `clamp()` and is unaffected.

### 2.2 PlayerField zone rows: fluid grid instead of fixed-width cards (board overflows from turn 1)

**Size:** M · **Files:** `src/components/PlayerField.tsx:92-134`, `src/components/CardView.tsx:68`, `src/components/battle/BattleBoard.tsx:77` · **Depends on:** 2.1

Occupied slots render `CardView` compact at a fixed `w-[164px]` inside a container that is at most ~291px of inner width at 390px; with set cards placed the row reaches 450–678px — the page scrolls horizontally, fields tear out of their ink borders, and the phase button drifts off-axis. This survives the rem fix (608px row vs 464px container at 16px rem). Fix: change ZoneRow to `grid grid-cols-4 gap-2` (preserve the mirrored P1 layout via order/direction classes), render `<CardView card compact className="!w-full" />` in each cell, and give empty placeholders `w-full aspect-[234/328]` instead of fixed h/w. At 390px each slot becomes ~85px wide, and the whole board (2 fields + top bar + divider + log) fits 844px without scrolling.

### 2.3 ChronosCorner: inline compact variant on mobile (fixed 120px corner overlaps the board)

**Size:** M · **Files:** `src/components/ChronosCorner.tsx:12-17, 32`, `src/components/battle/BattleBoard.tsx:98-114` · **Depends on:** 2.1, 2.2

The clock is `fixed top-4 right-4` at hard `width: 120, minHeight: 140`; at 390px it covers the DAY/NIGHT stamp in the board's top bar and the upper-right of P1's mirrored zone row (P1's battle card — the most important card on the board), and it smears over content while the page scrolls. Fix: add a `size: 'compact'` prop to `ChronosCorner` (ChronosClock at `size={44}` plus the HH:00 label inline, ~56px tall) and render it statically inside BattleBoard's top bar row on small screens; keep the fixed 120px corner only on `md:`, anchored absolute within `main` (beside the board) rather than fixed to the viewport.

### 2.4 Fix fixed-width CardView overflow in the HandDrawer fan and RevealScreen

**Size:** S · **Files:** `src/components/HandDrawer.tsx:123-148, 199-220`, `src/components/battle/RevealScreen.tsx:57-87`, `src/components/CardView.tsx:68`

Fan slots are 70×98px but the child `CardView compact` is a fixed 164px wide — each card renders 2.3× its slot, spilling ~120px past the bottom screen edge, and taps on the overflow do nothing; drawer-state wrappers are `width: 220` vs a 234px card, breaking snap-centering. RevealScreen places two fixed 234px cards side by side (483px row) in a 390px viewport — the opening reveal's centerpiece cards are clipped on both sides. Fix: in the fan loop pass `className="!w-[70px]"` to CardView (the `!` arbitrary width wins because className is appended last; alternatively add a numeric `width` prop to CardView); fix the drawer wrapper to 234 (or pass `!w-[220px]`); in RevealScreen wrap each card in `w-[min(40vw,234px)]` and pass `className="!w-full"`.

### 2.5 Gallery spotlight at 390px: card wider than the viewport, effect text unreachable

**Size:** M · **Files:** `src/app/gallery/page.tsx:310-312, 330-353, 389-402, 529-545`

The spotlight sizes the card by height (`min(80vh, 656px)` at aspect 234/328), which on a 390×844 phone derives a 468px width — clipped both sides — and the dialog root (`fixed inset-0 flex items-center justify-center`) has no `overflow-y-auto` while the column is ~950px tall, so the Japanese effect text (the main reason to open a card) is permanently cut off; the fixed prev/next buttons also overlap the clipped card. Fix: (1) add `overflow-y-auto` to the dialog root and change the stage wrapper to `min-h-full py-16`; (2) make sizing width-driven on mobile: `width: min(100% - 32px, calc(min(80vh, 656px) * 234 / 328)); height: auto; aspectRatio: '234/328'`; (3) below `md`, move prev/next into a row beneath the effect box instead of fixed mid-edges.

### 2.6 Hand-decision screens: lift instructions out of the drawer and auto-expand it

**Size:** S · **Files:** `src/components/battle/MulliganScreen.tsx:32-55`, `src/components/battle/InitialPlacementScreen.tsx:29-53`, `src/components/battle/SetCardsScreen.tsx:31-52`, `src/components/HandDrawer.tsx:109-128`

Mulligan/placement/set screens render only a centered "プレイヤー N" stamp; the actual instruction lives in HandDrawer's title/subtitle, invisible until the player discovers the bottom fan is tappable (its only affordance is a 7.5px caption). Fix: (1) render the title/subtitle strings as an `h2` + `p` in the center of each of the three screens, above the fan; (2) add an `initialExpanded?: boolean` prop to HandDrawer (initializing the `expanded` state) and pass it from these three screens so the drawer opens automatically — these screens exist solely to make one drawer decision.

### 2.7 Phase flow: remove the dead taps, auto-skip no-op phases, and narrate every tap

**Size:** M · **Files:** `src/hooks/useGame.ts:133-140`, `src/app/battle/page.tsx:105-115`, `src/lib/gameEngine.ts:167-230`, `src/components/battle/BattleBoard.tsx:128-139, 151-166`

A player taps the center stamp 5–6 times per turn but only `advance_time` and `battle` produce visible output. Two compounding problems: (a) phase desync — after both players set, `currentPhase` is still `set_cards`, so the stamp reads "カードセット / SET CARDS" and the first two taps (set_cards → reveal_cards → advance_time) are no-ops with misleading labels; (b) `replaceCharacter`/`replaceAreaEnchant` silently swap cards with no log entry, and `process_effects` is a no-op that still demands a tap. Fix: in the dispatcher, after P2's set is applied, advance the engine straight to `advance_time` (the per-turn reveal is implicit — set zones render face-up on the shared board); auto-skip `process_effects` until Wave 4 lands effects; append log entries in `replaceCharacter`/`replaceAreaEnchant` (including "no change"); render the last log entry as a transient one-line caption directly under the phase stamp (key on `log.length`, reuse `.animate-slide-up`). While in here, remove the dead state: `GameState.activePlayerIndex` is never written but drives a permanent pink "active" frame on P1's field (`PlayerField.tsx:154-155` via `BattleBoard.tsx:117-125`) — delete it or repurpose as `lastBattleWinner` highlight; also delete `useGame`'s unused `screen`/`setScreen` machine so the dispatcher's `subScreen` is the single source of routing truth.

### 2.8 Make set-zone slot A/B assignment explicit in the UI

**Size:** S · **Files:** `src/components/battle/SetCardsScreen.tsx`, `src/app/battle/page.tsx:105-115`

Slot A is rules-significant: 「※セットゾーンに２枚のキャラクターを出した場合、セットゾーンAに置かれたものをバトルゾーンに置きます」 — but the UI maps tap ORDER to slots invisibly (first tap → A), so a player setting two Characters cannot deliberately choose which one battles. Fix (minimum viable, keeping the existing index→slot mapping): when `count === 2`, show A/B badges on selected cards reflecting selection order, add a swap control, and a subtitle "Aのキャラクターがバトルゾーンへ / Slot A Character enters the Battle Zone". One reviewer proposed a full chooser overlay during the `replace_character` phase (L) — deferred; ship the labeling now and revisit with Wave 4 effects if needed.

### 2.9 Mute toggle with localStorage persistence

**Size:** S · **Files:** `src/components/SfxProvider.tsx:22-61`, `src/components/SfxProviderClient.tsx`, `src/app/layout.tsx:62-64`

`SfxProvider` exposes `muted`/`setMuted` but nothing in src/ consumes `setMuted` — an always-on-audio game with no way to turn sound off. Fix: (1) hydrate `muted` from `localStorage('zcg-muted')` in a mount effect (not initial state — SSG-safe) and write it back in the existing muted effect next to `setMasterVolume`; (2) add a global `SoundToggle` client component rendered after `{children}`: StampBadge `size="xs" variant="outline"`, fixed bottom-4 left-4 z-40 (avoids ChronosCorner top-right and HandDrawer bottom-center), `jp={muted ? '消音' : '音'}`, `aria-pressed={muted}`, no click-sfx when muting.

### 2.10 Tap targets ≥ 44px and re-enable pinch zoom

**Size:** S · **Files:** `src/components/StampBadge.tsx:39-48`, `src/app/layout.tsx:46-52`, `src/app/gallery/page.tsx:330-353` · **Depends on:** 2.1

Interactive stamps are 22–31px tall (even the phase button tapped 5–6× per turn), spotlight nav is 30×30px — all below the 44px iOS / 48px Android floor — and the viewport export sets `maximumScale: 1, userScalable: false`, so users can't zoom to compensate (WCAG 1.4.4 failure; iOS ignores it anyway, so it only penalizes Android). Fix: in `StampBadge` add `interactive && 'min-h-[44px] min-w-[44px]'` to baseClasses; size spotlight nav to 48px; delete `maximumScale` and `userScalable` from the viewport export. If double-tap zoom bothers battle tapping, use `touch-action: manipulation` on the battle `main` and `.stamp-reset` instead.

### 2.11 Fix failing color-contrast pairs (ink-dim, accent fills, night fills)

**Size:** M · **Files:** `src/app/globals.css:12, 15-17`, `src/components/StampBadge.tsx:55-61`, `src/components/CardView.tsx:136-145`

Computed WCAG ratios that fail: ink-dim `#868686` on paper 3.09:1 (used almost exclusively on 9–12px mono labels — HP/PWR/DECK/LOG, fan hint); accent `#F15060` on paper 2.95:1; paper-on-accent 2.95:1 (every primary CTA: START GAME, phase stamp, SET confirm); paper-on-night `#00AEEF` 2.15:1. Token-level fix so call sites don't change: (1) darken `--color-ink-dim` to `#616161` (5.26:1 / 4.71:1 — passes); (2) add `--color-accent-deep: #C2303F` (~5.3:1) and `--color-night-deep: #007CAD` (~4.7:1) in the `@theme` block; (3) switch StampBadge `fill-accent`/`fill-night` variants and CardView's night/day power overlay to the deep variants, keeping the fluorescent originals for large display graphics (halftones, clock domes, hero band). Re-verify with WCAG luminance math after the change.

### 2.12 Make the CardBackCover pass overlay keyboard-operable

**Size:** S · **Files:** `src/components/CardBackCover.tsx:66-78` · **Depends on:** 1.8 (same component)

The handoff cover is a `motion.div` with `role="button"` and `onClick` but no `tabIndex` and no key handler — the only hard keyboard blocker in the battle flow, and every turn goes through it, so a keyboard-only player cannot play at all. Fix: keep the motion.div as a presentational backdrop and render a real full-bleed `<button type="button" className="stamp-reset absolute inset-0" aria-label={...} onClick={handleReady}>` inside it; focus it on mount (`useEffect(() => { if (active) btnRef.current?.focus() }, [active])`). This also gives screen-reader users an announced actionable element on the screen.

### 2.13 Quit/restart control and leave-guard for active battles

**Size:** M · **Files:** `src/app/battle/page.tsx:65-277` (BattleSession), `src/components/battle/BattleBoard.tsx:100-114`

Once a battle starts there is no in-app way to quit or restart until game over, nothing persists, and there is no `beforeunload` guard — an accidental back-swipe or refresh silently destroys a 20-minute two-player match. Fix: (1) add a `jp="終了" en="QUIT"` xs outline StampBadge to BattleBoard's top bar opening a confirm overlay (続ける/RESUME, もう一回/RESTART → existing `onReplay`, メニュー/MENU → `router.push('/')`), threading `onQuit`/`onReplay` from BattleSession; (2) in BattleSession add a `beforeunload` listener (`e.preventDefault()`) active while `gameState && !gameOver`.

---

## Wave 3 — Ship it (8 items)

Everything between the local build and a working public URL on GitHub Pages. **Human decision required before this wave: repo visibility/legal posture (see Open Questions).**

### 3.1 Initialize git, create the GitHub repo, add the Pages Actions workflow

**Size:** S · **Files:** new `.github/workflows/deploy.yml`; existing `.gitignore` (already correct — excludes `/out/`, `/.next/`)

There is currently no `.git`, no remote, no workflow — zero path to a public URL. The repo MUST be named exactly `zutomayo-card-game` (basePath is hardcoded in `next.config.ts:5`; any other name 404s every asset). `npm run build` verified exiting 0, exporting `out/` (~159 MB, largest file 0.65 MB — under Pages' 1 GB site / 100 MB file limits). Steps: `git init`, commit, create the GitHub repo, push; Settings → Pages → Source = "GitHub Actions"; add this workflow:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: touch out/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out
  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

The `.nojekyll` is free insurance: the artifact flow skips Jekyll, but a future switch to branch-based deploy would otherwise silently drop `_next/`.

### 3.2 Static-export config fixes: manifest basePath, BASE_PATH consolidation, trailingSlash

**Size:** S · **Files:** `src/app/layout.tsx:43`, new `src/lib/basePath.ts`, `src/lib/cardAssets.ts:3`, `src/lib/sound.ts:5`, `next.config.ts:3-9` · **Do before 3.5**

Verified empirically in the built HTML: Next does NOT apply basePath to `metadata.manifest` — `out/index.html` emits `href="/manifest.json"`, which 404s on Pages (every other asset IS prefixed). Fix: create `src/lib/basePath.ts` (`export const BASE_PATH = process.env.NODE_ENV === 'production' ? '/zutomayo-card-game' : ''`), use it in layout.tsx (`manifest: \`${BASE_PATH}/manifest.json\``), and refactor `cardAssets.ts` and `sound.ts` to import it instead of their own copies (kills 3-way string drift). Also add `trailingSlash: true` to `next.config.ts`: the current flat export serves `/battle` but 404s `/battle/`; with trailingSlash, Pages serves both. Re-build and confirm `out/index.html` emits the prefixed manifest href and `out/battle/index.html` exists. All navigation goes through next/link (verified — no raw absolute `<a>`s), so nothing else changes.

### 3.3 Stop exporting empty HTML shells — lazy-load the howler MODULE, not the React tree

**Size:** M · **Files:** `src/lib/sound.ts:3`, `src/components/SfxProviderClient.tsx:10-13`, `src/app/layout.tsx:63`

Verified: every exported page's `<body>` is empty except `<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">`, because layout wraps ALL children in `SfxProviderClient` which uses `dynamic(..., { ssr: false })` — solely because `sound.ts` imports howler at module top level (it touches `window` at import time). On Pages that means a blank paper page until 119–194 kB of JS hydrates, and zero crawlable content. Fix: remove the top-level howler import; inside `SoundManager.init()` (only ever called in the browser) do `const { Howl, Howler } = await import('howler')` and store the constructors (init becomes async fire-and-forget; `play()` no-ops pre-init, matching current behavior). Delete `SfxProviderClient.tsx`, import `SfxProvider` directly in layout. Re-build and confirm `out/index.html` contains the hero markup (「ずとまよ」) instead of the bailout template.

### 3.4 Create PWA manifest icons and replace the stock Next favicon

**Size:** M · **Files:** `public/manifest.json:10-21`, `src/app/favicon.ico`, new `public/manifest-icon-192.png`, `public/manifest-icon-512.png`

`manifest.json` declares two icon files that do not exist in `public/` (404 → invalid manifest, no install prompt, console errors), and `src/app/favicon.ico` is byte-identical to the create-next-app default — the tab shows the Next.js triangle. Fix: author one 512×512 riso-style mark as SVG (paper `#f1ece2` square, hard ink border, the character 「ず」 in the display font with the signature pink `#F15060` / teal `#00AEEF` misregistration offset matching the `.ink-offset` idiom), rasterize with sharp via a one-off Node script into the two PNGs (names must match manifest.json exactly), and replace favicon.ico with a 32px render (or drop `icon.png` into `src/app/`). Check the SVG source into the repo. Fallback if icon work is deferred: delete the icons array from manifest.json — do not ship 404ing entries.

### 3.5 OG/Twitter metadata with metadataBase, og.png, and per-route titles

**Size:** M · **Files:** `src/app/layout.tsx:39-44`, new `public/og.png`, new `src/app/{battle,gallery,rules,credits}/layout.tsx` · **Depends on:** 3.2

Built HTML contains zero `og:*`/`twitter:*` tags — shared links render as bare text on Discord/Twitter/LINE, exactly where a ZUTOMAYO fan project gets shared. Every route also shows the identical tab title (all pages are `'use client'` and cannot export metadata). Fix: (1) create `public/og.png` (1200×630, riso style, giant ずとまよ display type, pink halftone band, the fanmade disclaimer small at bottom — same SVG→sharp pipeline as 3.4); (2) in layout metadata add `metadataBase: new URL('https://<github-username>.github.io/zutomayo-card-game')` (**fill in the real username**; metadataBase DOES handle prefixing, unlike the manifest field), `openGraph: { ..., images: ['/og.png'], locale: 'ja_JP' }`, `twitter: { card: 'summary_large_image', images: ['/og.png'] }`, and change `title` to `{ default: 'ZUTOMAYO CARD — THE BATTLE BEGINS', template: '%s — ZUTOMAYO CARD' }`; (3) add thin server layout files per route exporting only `metadata = { title: 'GALLERY' | 'BATTLE' | 'RULES' }` and returning children.

### 3.6 README, LICENSE, and repo hygiene

**Size:** S · **Files:** `README.md`, new `LICENSE`, delete `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`

README is untouched create-next-app boilerplate and there is no LICENSE — while the repo would redistribute ~151 MB of copyrighted ZUTOMAYO card scans. Fix: rewrite README (project name, screenshot, the exact bilingual disclaimer already used in-app at `src/app/page.tsx:98` — 非公式ファンメイド / unofficial fanmade, not affiliated with EARN-A-ROCK / ZUTOMAYO — a takedown-on-request statement, install/dev/build instructions, live URL). Add MIT LICENSE with an explicit carve-out: license covers source code only; everything under `public/cards`, `public/mat`, `public/sfx` is excluded and remains property of its rights holders. Delete the five unused starter SVGs (verified unreferenced). The public-vs-private visibility call is a human decision — see Open Questions.

### 3.7 Credits page for CC-BY sound attribution (license compliance, not polish)

**Size:** S · **Files:** new `src/app/credits/page.tsx`, `public/sfx/CREDITS.txt` (source text), `src/app/page.tsx` (menu nav, ~:62-80)

`CREDITS.txt` states two clips are CC-BY 4.0 and MUST appear in the game's credits screen or accompanying documentation: "Card slap" by f4ngy (freesound.org/people/f4ngy/sounds/240776/) and Freesound #351567 (freesound.org/s/351567/). A file in `public/sfx/` that no UI links to does not satisfy CC-BY for a deployed site. Fix: create `/credits` matching the rules-page layout idiom — the two CC-BY attributions verbatim with links (including creativecommons.org/licenses/by/4.0/), a courtesy list of the CC0 authors (Splashdust, Breviceps, modusmogulus, Erokia), the fanmade disclaimer — and add a クレジット / CREDITS StampBadge to the home menu.

### 3.8 Riso-styled not-found.tsx

**Size:** S · **Files:** new `src/app/not-found.tsx`

Pages automatically serves `out/404.html` (verified emitted), but without `src/app/not-found.tsx` it renders Next's generic black-and-white default — visually alien next to every other screen. Fix: paper background, ink-offset "404" display type, JP line 「ページが見つかりません」, a StampBadge home link, the pink halftone band motif. Note it will be client-rendered until 3.3 lands — the two fixes compound, order doesn't matter.

---

## Wave 3.5 — QA-discovered regressions (2 items)

Surfaced by the live QA pass against the deployed build (`TESTING_PROMPT.md`, run 2026-06-18). Two items qualify as Wave 1–3 regressions; the rest of the QA findings are Wave 4 GAP-OBSERVED confirmations and are tracked inline on those items. Ship before continuing Wave 4 so the next session inherits a clean baseline.

### 3.5.1 RevealScreen kanji: 嫌！→ 公開！

**Size:** XS · **Files:** `src/components/battle/RevealScreen.tsx:53` · **Status:** ✓ SHIPPED (Session 1, 2026-06-18)

The reveal headline read `嫌！/ Reveal!`. 嫌 means "dislike / refuse" in JP and reads as visually wrong next to the EN gloss "Reveal!" — composer likely meant a stylistic exclamation but it pairs as an emotional refusal to a JP audience. Replaced with 公開！ to match the existing phase-label "カード公開" used in BattleBoard.

### 3.5.2 Cost-gated attack overlay still shows printed face value

**Size:** S · **Files:** `src/components/CardView.tsx`, `src/components/PlayerField.tsx`, `src/components/battle/RevealScreen.tsx`, `src/app/battle/page.tsx` · **Status:** ✓ SHIPPED (Session 1, 2026-06-18)

The engine power-cost gate (Wave 1.10) correctly clamps a Character's attack to 0 when `card.cost > calculateTotalPower(player)` inside `calculateBattle`, but `CardView.showPowerOverlay` rendered `card.night_attack` / `card.noon_attack` unconditionally. Players saw "30 vs 0" on turn 1 with empty Power Chargers but the resolver read "0 vs 0 / draw" — misleading even though the engine was right.

Fix: added a `costGated?: boolean` prop to `CardView`. When true with the power overlay active, the stamp renders neutral `bg-ink-secondary` with `0` (instead of the night/day color + printed value) and the aria-label states "Attack 0 — cost N not paid (printed M)". `PlayerField` computes `card.class === 'Character' && card.cost > totalPower` for the battleZone slot and passes through. `RevealScreen` accepts `p0CostGated` / `p1CostGated` props; `battle/page.tsx` computes them via `calculateTotalPower` and threads them through.

---

## Wave 4 — Depth & hygiene (10 items)

The card-effect engine, tests, CI, performance, and deep accessibility.

### 4.1 Card-effect engine: pattern-based interpreter with official priority-player ordering

**Size:** L · **Status:** ▣ DEFERRED to its own dedicated session (Session 3). The other 4.x items ship first so this lands on a clean baseline. · **Files:** new `src/lib/effects.ts`, `src/hooks/useGame.ts:116-119` (the no-op `process_effects` case), `src/lib/gameEngine.ts` (calculateBattle, chronos), `src/data/cards.json`, `src/components/battle/PregameScreen.tsx`, `src/hooks/useGame.ts:41-50`

251 of 422 cards carry effect text but `process_effects` does nothing — ~60% of every card's identity is dead. Official turn step 6: 「キャラクター、エンチャント、エリアエンチャントに効果が記載されている場合、クロノス上のメダルがある側から効果を発動します。※各カードのパワーコストが足りていない場合、効果は発動しません」 — effects fire starting from the player on whose seat side (night/day) the Chronos medal currently sits; that priority player resolves all of their effects in any order first; power cost is evaluated **at the moment the effect is processed**; and 「どちらかのHPが０になった瞬間にゲームは終了します」 — HP-0 ends the game the instant it happens, so effect damage/heal must check the winner immediately, not only after battle.

Build `src/lib/effects.ts` as a pattern-matcher over effect strings producing typed `{condition, action}` objects, implemented in measured coverage order: (1) conditional self attack buff 「(条件)なら攻撃力+N」 — 164 cards (conditions: own/opponent attribute 闇/炎/電気/風/カオス, abyss contents アビスにN枚/N種類, current time 今が夜/昼なら・真夜中なら, power-charger counts, HP comparison) — store as an `attackModifier` applied inside `calculateBattle` since +N must affect the battle comparison; (2) power-charger disruption — 48 cards (e.g. 2nd_8 「相手のパワーチャージャーからSEND TO POWER★★のカードを１枚選び、相手のデッキの底に置く」); (3) abyss placement/mill — 26 cards (e.g. 1st_104); (4) clock set — 12 cards (e.g. 2nd_36 「時計が真夜中になる」, 3rd_26 「真夜中の前後２マスも真夜中として扱う」 — set `chronosPosition` absolutely; support the widened-midnight window); (5) HP heal — 11 cards (clamp 0–100, immediate winner check); (6) draw — ~10–14 cards; (7) opponent attack debuff — 4 cards; (8) move-to-power — 12 cards. Wire into `useGame`'s `process_effects`: priority player = the player whose seat side (`nightPlayerIndex`, currently unused for this) matches `getTimePhase(chronosPosition)`; gate each effect on `calculateTotalPower(player) >= card.cost` at processing time. Tag unparsed effect texts as `unimplemented` and surface that in the UI so players know which effects are live. Sub-task: the night-side seat becomes rules-relevant here — replace the hidden random `nightPlayerIndex` roll in `startGame` with a visible moment (official: 「じゃんけんを行い、勝ったプレイヤーは「夜側」のプレイヤーとなります」 — a janken step in PregameScreen, or at minimum an announcement interstitial "プレイヤーNが夜側 / Player N is NIGHT SIDE" before mulligan). Un-skip the `process_effects` phase tap from item 2.7 once effects are live.

### 4.2 Engine unit tests (vitest)

**Size:** M · **Status:** □ PENDING (Session 2) · **Files:** new `vitest.config.ts`, new `src/lib/__tests__/gameEngine.test.ts` (and `effects.test.ts` alongside 4.1)

The engine is pure functions over `GameState` — ideal test surface, currently zero tests. Add vitest and cover, at minimum, every Wave 1 fix as a regression test: end-of-turn draw counts (winner 1 / loser 2 / draw 1 / turn 1), advanceTime summing only this turn's hand-played clocks (incl. the turn-1 prep-clock branch from 1.4), end-of-turn sweep of ALL set-zone leftovers, mulligan draw-before-shuffle (seed/stub the shuffle), simultaneous deck-out → draw, power-cost attack-0 (「キャラクターのパワーコストが足りていない場合、キャラクターの最終的な攻撃力は０となります」), HP-0 immediate end, replacement A-priority, and chronos night/day mapping (night = positions 9–2, day = 3–8, midnight = 0). Use fixed card fixtures rather than the full cards.json where possible.

### 4.3 Playwright E2E battle flow + CI workflow

**Size:** M · **Status:** □ PENDING (Session 2) · **Files:** new `playwright.config.ts`, new `e2e/battle.spec.ts`, new `.github/workflows/ci.yml` · **Depends on:** 4.2

Add one Playwright spec that plays a full hot-seat turn loop at 390×844: start game → janken/pregame → both mulligans (verifying the pass cover fully hides P1's hand — regression for 1.8) → initial placement (including a non-Character placement, regression for 1.4) → reveal → several full turns of set/pass/phase taps → assert HP/log changes and no horizontal scroll (regression for 2.2). Add `.github/workflows/ci.yml` running `npm ci`, lint, `tsc --noEmit`, `vitest run`, `npm run build`, and the Playwright job on push/PR; make the Pages deploy workflow (3.1) depend on CI passing if desired.

### 4.4 Generate card thumbnails — stop fetching 150 MB of 700×978 scans into ~110-240px cells

**Size:** M · **Status:** □ PENDING (Session 2) · **Files:** new `scripts/make-thumbs.mjs`, `src/lib/cardAssets.ts`, `src/components/CardView.tsx:89-96`, `src/app/gallery/page.tsx:246-255`, plus HandDrawer/PlayerField/battle zones

Card JPGs are 700×978, avg 361 KB, 149.65 MB total (94% of the export); with `images.unoptimized: true` there is no srcset, so the gallery grid pulls ~14 MB on first paint and ~150 MB on a full scroll, and battle screens fetch full-size files for 164–234px renders. Fix: one-shot sharp script writing `public/cards/thumbs/<same-name>.jpg` at 480px wide / quality ~70 (~18 MB total, still 2× DPR for 240px cells); add `getLocalCardThumbPath(card)` to `cardAssets.ts` and a `thumb` boolean prop on CardView; pass `thumb` everywhere except the gallery Spotlight, which keeps full-res. Expected: gallery initial transfer ~14 MB → ~1.5 MB. Also preload spotlight neighbors: a `useEffect` keyed on `selectedCard` that sets `new window.Image().src = getLocalCardPath(neighbor)` for `filtered[idx±1]`, so arrow-key navigation stops waiting 300–800 ms per step.

### 4.5 Gallery render performance: bare grid variant + memoized cells

**Size:** M · **Status:** □ PLANNED (Session 1, batch 3) · **Files:** `src/components/CardView.tsx:33, 99-161`, `src/app/gallery/page.tsx:46-47, 84-104, 246-255`

All filter/spotlight state lives in the component that maps 422 CardViews, each with a fresh inline onClick — every arrow-key step and filter toggle reconciles all 422 cells (thousands of nodes). At ~117px cells the full CardView chrome (attribute kanji, sub-legible rarity stamp, duplicate caption) is also pure noise. Fix: (1) `export default React.memo(CardView)`; (2) a memoized `GalleryCell` receiving `card` + a stable `useCallback` `onSelect`; (3) add a `bare?: boolean` CardView prop rendering only the bordered artwork window (metadata is already in the spotlight) and use it in the grid, with a `bg-paper-deep` placeholder class on the artwork window so unloaded cells read as intentional slots.

### 4.6 Font loading: drop unused Noto weights, add metric-adjacent JP fallbacks

**Size:** M · **Status:** ✓ SHIPPED (Session 1, 2026-06-18) · **Files:** `src/app/layout.tsx:11-37`, `src/app/globals.css:46-49`

Render-blocking CSS is 408 KB raw / 129 KB gzip per route — ~95% of it @font-face rules. Noto Sans JP loads weights 400/500/700, but every bold/medium usage in src/ is on font-numeric (Barlow Condensed) elements (verified) — 500/700 can never render. Fix: change Noto to `weight: "400"` (saves ~60 KB gzip blocking CSS + ~4 MB of dead woff2 in the export). All four fonts also declare `subsets: ['latin']` only, so JP-first UI text (hero ずとまよ, every stamp, card titles) flashes Yu Gothic then swaps with layout shift. Cheap mitigation now: `fallback: ['Yu Gothic', 'YuGothic']` on both JP fonts. Optional follow-up: pyftsubset the ~100 chrome glyphs of Yusei Magic into a local preloaded woff2 via next/font/local, keeping the Google full font as supplement.

### 4.7 Sound hygiene: trim the 8-second ui-click, guard StrictMode double-fire

**Size:** S · **Status:** ✓ SHIPPED (Session 1, 2026-06-18) — ui-click.mp3 trimmed 131,283 → 3,806 bytes (97% reduction) via `ffmpeg -t 0.25 -af afade=t=out:st=0.2:d=0.05`; useRef fired-flag guards added to CardBackCover/BattleAnimationOverlay/HandDrawer/RevealScreen/GameOverScreen so StrictMode dev double-mount no longer stacks cues. · **Files:** `public/sfx/processed/ui-click.mp3`, `src/lib/sound.ts:97-113`, `src/components/CardBackCover.tsx:52-55`, `src/components/battle/BattleAnimationOverlay.tsx:44-55`, `src/components/HandDrawer.tsx:64-67`, `src/components/battle/RevealScreen.tsx:38-41`, `src/components/battle/GameOverScreen.tsx:39-42`

`ui-click.mp3` is 8.125 s (every other SFX is 4–32 KB) and `play()` has no sprite support, so every StampBadge click stacks overlapping 8-second cassette tails. Fix: re-export trimmed — `ffmpeg -i ui-click.mp3 -t 0.25 -af "afade=t=out:st=0.2:d=0.05" ...` (also cuts 128 KB → ~6 KB; preferred over adding sprite support). Separately, five components call `play()` in mount effects with no idempotency guard, so React 19 StrictMode dev double-fires every cue: move the calls into the event handlers that cause the transition, or add a `useRef` fired-flag mirroring BattleBoard's existing `prevChronos` pattern (`BattleBoard.tsx:64-73`).

### 4.8 prefers-reduced-motion support (MotionConfig + CSS + SMIL guard)

**Size:** M · **Status:** □ PLANNED (Session 1, batch 3) · **Files:** `src/app/layout.tsx` (app-wide client wrapper, post-3.3), `src/app/globals.css:72-74, 150-157`, `src/components/ChronosClock.tsx:114-121`

Nothing references reduced motion; motion-sensitive users get every Framer slide/scale, the battle shake (`x: [0,-6,6,-4,4,0]`), CSS shakeHit, smooth scroll, and an infinitely repeating SMIL opacity pulse on the clock medal. Three pieces: (1) wrap children in `<MotionConfig reducedMotion="user">` from `motion/react` in the app-wide client wrapper (after 3.3 this is `SfxProvider` itself); (2) add a `@media (prefers-reduced-motion: reduce)` block in globals.css: `html { scroll-behavior: auto }`, disable `.animate-fade-in/.animate-slide-up/.animate-shake`, `* { transition-duration: 0.01ms !important }`; (3) in ChronosClock use `useReducedMotion()` and conditionally render the `<animate>` element — SMIL is immune to CSS media queries and must be removed from the DOM.

### 4.9 Screen-reader announcements and dialog focus management

**Size:** M · **Status:** □ PLANNED (Session 1, batch 3) · **Files:** `src/components/battle/BattleBoard.tsx:152-166`, `src/components/PlayerField.tsx:72-87`, `src/components/ChronosClock.tsx:33`, `src/components/battle/BattleAnimationOverlay.tsx:67-77`, `src/components/HandDrawer.tsx:154-253`, `src/app/gallery/page.tsx:95-104, 301-313`

Battle state is silent to screen readers and modals don't manage focus. Fixes: (a) `aria-live="polite"` on the game log `<ul>` (appended `<li>`s announce); (b) HP track div gets `role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={player.hp} aria-label={...}`; (c) `aria-hidden="true"` on the ChronosClock `<svg>` (the text readout below is the accessible representation); (d) BattleAnimationOverlay's `aria-live` never announces because the region mounts WITH its content — instead keep a permanently-mounted visually-hidden assertive live region in BattlePage and set its text when the battle result is computed; (e) HandDrawer: add `aria-modal="true"`, Escape-to-close (the gallery Spotlight already handles Escape; the drawer used dozens of times per battle does not), focus the first card button on open, and restore focus to the fan button on close; (f) Spotlight: focus the close control on open and restore focus to the originating grid cell on close. Initial-focus + Escape + restore is sufficient; a full focus trap is nice-to-have.

### 4.10 Gallery findability: name search, rarity counts, persistent filters

**Size:** M · **Status:** ✓ SHIPPED (Session 1, 2026-06-18) — search input filtering title+id (case-insensitive, Escape clears); per-rarity counts (within current pack+query scope) annotate each pill's EN label (`UR · 24`); selectedPack and selectedRarity persisted to sessionStorage and hydrated in a mount effect (SSG-safe). · **Files:** `src/app/gallery/page.tsx:24-31, 53-59, 231-243`

With 422 cards the only tools are the pack dropdown and rarity pills — no name search (the most natural lookup for a fan), no result counts, and filters reset on every visit. Fix, all in gallery/page.tsx: (1) a `<input type="search">` styled like the pack picker (placeholder 「カード名で検索 / Search by name…」) filtering on `c.title.includes(query) || c.id.includes(query.toLowerCase())`; (2) per-rarity counts within the current pack+query scope via a `useMemo` Map, appended to each pill's `en` label; (3) persist selectedPack/selectedRarity to sessionStorage in an effect and hydrate in a mount effect (not a useState initializer — SSG-hydration-safe).

---

## Dropped from the backlog (recorded so they aren't re-litigated)

- `cards.json` runtime fetch instead of bundling (~70–80 kB gzip JS saved) — low value vs loader churn; revisit only if first-load JS becomes a problem.
- RevealScreen 「嫌！」 headline wording, JetBrains Mono kana fallback in the log, CardView hover-lift sticking on touch — cosmetic nitpicks.
- Full focus trap in modals, landscape-orientation tuning — superseded by the lighter fixes in 4.9 / 2.10.
- OneDrive sync exclusion — real, but a human/machine-config action, not a code item (see preamble).
