You are a QA tester for a deployed Next.js app — the Zutomayo Card Game, a riso-styled hot-seat card battler. The live build is at https://dr-manda.github.io/zutomayo-card-game/.

Scope: Waves 1, 2, and 3 from IMPROVEMENTS.md are SHIPPED. Wave 4 is NOT yet shipped. This prompt covers BOTH:

- **Sections 1–3:** Test the shipped Waves 1–3. Surface any regressions.
- **Section 4:** Document the Wave 4 gap for each of the 10 backlog items. Each Wave 4 subsection lists what's currently broken / missing / suboptimal AND what the post-Wave-4 fix should achieve. Mark each as `GAP-OBSERVED` (broken state confirmed today) or `ALREADY-OK` (the gap is no longer present — the next session can skip that item).

The output of this whole prompt feeds a single fix-session that will land both Wave-1–3 regression fixes AND the Wave 4 implementation work in one pass.

## Setup

Before testing:

1. Drive the live URL with the Chrome MCP family (`mcp__Claude_in_Chrome__*`):
   - Call `mcp__Claude_in_Chrome__list_connected_browsers` to enumerate available browsers.
   - Call `mcp__Claude_in_Chrome__select_browser` to attach to one.
   - Call `mcp__Claude_in_Chrome__tabs_context_mcp` to open or focus a tab pointed at https://dr-manda.github.io/zutomayo-card-game/.
2. Computer-use tools (`mcp__computer-use__*`) are also available for native window resize or OS-level keyboard shortcuts if Chrome MCP can't reach a control.
3. Open DevTools Console BEFORE clicking anything on the page. Watch the console throughout testing and capture every red error verbatim (with stack frame) and notable yellow warnings.
4. Resize Chrome to the two target viewports as you test:
   - Mobile: 390x844 via `mcp__Claude_in_Chrome__resize_window`.
   - Desktop: 1280x800 via `mcp__Claude_in_Chrome__resize_window`. Also try 1440x900 and 1920x1080 where called out.
5. Save screenshots into a temp directory (e.g. `C:\Users\expre\AppData\Local\Temp\zcg-qa\` or your platform's equivalent) and reference the absolute path in each finding that benefits from one. Use `mcp__Claude_in_Chrome__computer` action `screenshot` (or `mcp__computer-use__screenshot` as a fallback).

## 1. Game mechanics & rules

This section drives full matches via Chrome MCP to surface rules-divergence between the shipped engine and the spec in IMPROVEMENTS.md. Play at least one complete match (start → deck-out or QUIT) plus the targeted scenarios below. Where a "shipped fix" is named, treat any deviation as a regression, not a feature request.

### 1.1 Baseline 5-turn run

1. From the title screen, tap NEW BATTLE and proceed through name entry / deck select with the defaults.
2. Skip both mulligans (see 1.2). Note hand size for P1 and P2 immediately after.
3. Play turns 1 through 5, alternating P1 and P2. At every transition (mulligan → initial → set → reveal → resolve → advance_time → draw → pass), record: current phase stamp, transient last-log caption under the stamp, hand counts for both players, Power Charger counts, Abyss counts, clock value.
4. Confirm phase progression never lands on `set_cards` or `process_effects` as a tappable screen with no UI (Wave 2.7 removed those dead taps). Either phase appearing as a blank screen requiring a tap-through is a finding.
5. Confirm the transient last-log caption appears under the phase stamp after each resolution and fades, not persists across multiple phases.

Expected: 5 full turns complete without console errors, no phase appears blank, hand counts stay internally consistent with what was played and drawn.

### 1.2 Mulligan behavior

1. New battle. At P1 mulligan, tap SKIP. Record hand size — must equal initial deal (5).
2. New battle. At P1 mulligan, select exactly 1 card, confirm. Hand size after must still equal initial deal; the redrawn slot must contain a different card than the discarded one in the vast majority of cases (not a hard finding, but flag if it returns the same card consistently — could indicate reshuffle-before-draw, the Wave 1.6 regression).
3. New battle. At P1 mulligan, select all 5 cards and confirm (full mulligan). Hand size after must equal 5. If hand drops below 5, that is the Wave 1.6 regression (mulligan must draw BEFORE reshuffling discards).
4. After each mulligan variant, look at the deck count indicator (if rendered) — it should decrease by exactly the number drawn from it, not by drawn + discarded.

### 1.3 Initial placement

1. Start a turn. From the initial-placement prompt, select a Character card and confirm. After reveal, verify: card sits in the battle zone, Power Charger count unchanged, Abyss count unchanged.
2. Restart and at initial placement select a non-Character (Area Enchant or Event). Confirm. After reveal verify: battle zone is empty, AND the card has flipped to Power Charger OR Abyss (Wave 1.4). If the card sits in the battle zone as if it were a Character, that is a regression. If the placement screen refuses non-Character selection, that is also a regression.
3. Check the placement screen accepts any card type from the hand without disabling non-Characters.

### 1.4 Set Cards screen

1. With a hand of 3+ cards, enter the set screen. Select one card — verify a badge "A" appears on it.
2. Select a second card — verify a "B" badge appears on the second card and the first retains "A" (Wave 2.8 — order-of-selection badges).
3. Deselect the A card. The remaining selected card should become A (badge re-derives from order), not stay B.
4. With set count required = 2, select only 1 card. The confirm button must be disabled. Tapping confirm anyway must not advance.
5. With set count required = 2 and hand size = 1, verify HandDrawer clamps the requirement to 1 (Wave 1.7) and the screen progresses.
6. Empty hand → screen must auto-continue without requiring a tap (Wave 1.5). If it stalls on an empty fan, finding.

### 1.5 End-of-turn draw count

1. Play a turn where P1's revealed attack > P2's revealed attack (P1 wins). At end-of-turn draw, count cards drawn by P1: must equal exactly cardsPlayedThisTurn[P1] for that turn. Most commonly 1 (one card played + one revealed). If P1 played 2 and draws 1, that is the Wave 1.1 regression.
2. Play a turn where P2 wins. Count P1's draw — same rule: equals cardsPlayedThisTurn[P1].
3. Play a tied turn (equal attack after power application). Both players draw cardsPlayedThisTurn[i] respectively. A draw should not award a win-bonus card to either side.
4. If at any point a player's hand shrinks across a turn boundary (excluding deck-out edge cases), record the exact turn, who, hand size before, hand size after, what was played.

### 1.6 Set-zone sweep at end-of-turn

1. On a turn where the set screen requires 2, place a Character in slot A and another Character in slot B.
2. Win the resolve so A's character promotes to the battle zone (or the engine's promotion rule fires). Confirm slot A empties.
3. Tap through end-of-turn. Verify slot B's leftover Character no longer occupies slot B at the start of P1's next turn. It must have moved to Power Charger or Abyss (Wave 1.2). If the Character remains in slot B for another turn, finding. If it silently disappears with no Abyss/Power increment, finding.
4. Repeat with a non-Character in slot B — same expectation: swept to Power/Abyss.

### 1.7 Chronos clock / advanceTime

1. Note the clock value at start of turn N.
2. During turn N play an Area Enchant (card that lands in slot C) plus any normal card.
3. After resolve, observe the clock advance for turn N. Then on turn N+1, advance_time must count only hand-played clock cards from THAT new turn, NOT re-count slot C (Wave 1.3). Compare clock delta on N+1 against the cards played that turn. A clock delta larger than hand-played clocks-this-turn by exactly the persistent slot C value is the 1.3 regression.

### 1.8 Hot-seat privacy

1. At every pass moment (mulligan handoff, end-of-turn pass, P2→P1 transition after P2's first turn — Wave 1.8), verify an opaque cover blocks the previous player's hand. Try to peek by inspecting the page momentarily before tapping continue — DOM should have hand contents blanked or aria-hidden while passActive (Wave 2.12).
2. Confirm the cover's label names the TARGET player ("Pass to P2"), not the previous one.
3. Tab into the cover with the keyboard. The continue button inside must receive focus and be operable (Wave 2.12). The cover wrapper must be aria-hidden so screen readers don't leak hand contents.
4. While in an active match, attempt to refresh the page (Ctrl+R) or navigate back. A beforeunload confirm must fire (Wave 2.13). On the menu, beforeunload must NOT fire.
5. Trigger the QUIT stamp. A confirm modal must offer resume / restart / menu (Wave 2.13). Test each branch: resume returns to the exact game state, restart re-runs setup with same players, menu returns to title and clears beforeunload.

### 1.9 Deck-out endgame

1. Play until one deck is exhausted. Continue play. The empty-deck player on their next draw-step must trigger the loss branch with the other player declared winner.
2. Construct a sequence where both decks empty on the same end-of-turn draw (Wave 1.9). The resulting screen must be a DRAW screen, not a winner banner for whichever side resolved first.
3. The end screen must be reachable from a beforeunload-cleared state — i.e., refreshing after game-over should not re-trigger the active-match guard.

### 1.10 Battle resolution & power-cost-attack-0

1. Reveal a Character whose cost exceeds the revealing player's Power Charger total. That Character's effective ATK must become 0 for resolution. If ATK is applied at face value, finding.
2. Cross-check by reading the on-card cost vs. the visible Power Charger count BEFORE the reveal animation, then watching the resolve outcome. If the high-cost reveal "wins" despite insufficient power, finding.
3. Verify that paying the cost (sufficient power) leaves Power Charger count unchanged unless the spec says otherwise — power is a gate, not a spend, per the current engine. Note any unexpected Power Charger decrement.
4. With both players revealing equal effective ATK (after the cost gate), the turn must be flagged as a draw, both draw `cardsPlayedThisTurn[i]` (see 1.5), and neither side accrues a win-only effect.

For every scenario above, capture: phase stamp at the moment of the issue, the transient last-log caption text, both players' hand/power/abyss/clock counts before and after, and a screenshot. Do not propose fixes — the next session owns that.

## 2. UI, UX, and responsive layout

Drive the live site at https://dr-manda.github.io/zutomayo-card-game/ in Chrome via the `mcp__Claude_in_Chrome__*` tools. Use `mcp__Claude_in_Chrome__resize_window` to switch between mobile (390x844) and desktop (1280x800) viewports. Take screenshots with `mcp__Claude_in_Chrome__computer` (action: screenshot) at every checkpoint and attach them to findings. For each finding, record: route, viewport size, exact reproduction steps, the observed behavior, the expected behavior, and a screenshot.

### 2.1 Mobile viewport (390x844)

Resize first with `mcp__Claude_in_Chrome__resize_window` to 390x844, then navigate via `mcp__Claude_in_Chrome__navigate`. Walk a full match: BATTLE -> deck pick -> mulligan -> initial placement -> several turns including SET CARDS, REVEAL, ADVANCE TIME.

Pass/fail criteria:
- **No horizontal scroll on BattleBoard at any phase.** Use `mcp__Claude_in_Chrome__javascript_tool` to read `document.documentElement.scrollWidth` and compare to `window.innerWidth`. Any value >390 on a battle route is a finding. Test mid-turn with both A and B slots populated for each player.
- **ChronosCorner must be the compact inline variant** on 390px: a small clock glyph and `HH:00` text inline near the top of the board, NOT a fixed 120px panel in the top-right corner. If you see a floating boxed panel, that is a Wave 2.3 regression.
- **PlayerField ZoneRow:** four zones (Character, A, B, C) should sit in a single fluid 4-column row. If columns wrap to 2x2 or stack vertically at 390px, capture it. Note: if a compact slot computes to less than ~85px wide and visibly clips the card or its label, flag it.
- **HandDrawer fan:** during mulligan/set/initial, the fan must not spill past the 390px viewport. Cards may overlap fanwise but no card should be visually clipped by the right or left edge. The drawer should auto-open on entry to these screens (Wave 2.6) without a tap.
- **RevealScreen:** after both initial placements, the two reveal cards must sit side-by-side without overlap or clipping. If they stack or one is cut off, flag it.

### 2.2 Desktop viewport (1280x800+)

Resize to 1280x800 and repeat a full match.

Pass/fail criteria:
- **ChronosCorner must be the fixed top-right panel** (~120px wide) showing the analog clock and time. If it stays inline-compact at desktop width, that is a regression.
- **PlayerField ZoneRow** must read as a balanced 4-column grid. Slot widths should look uniform; uneven gutters or one zone visibly wider than the others is a finding.
- Try 1440x900 and 1920x1080 too. Confirm content does not become absurdly small in a narrow center column or leave huge dead margins.

### 2.3 Home page

Navigate to `/`. Test at both 390x844 and 1280x800.

Pass/fail criteria:
- Four menu stamps (BATTLE, GALLERY, RULES, CREDITS) must each render full-width within the `max-w-sm` column and be tappable. If any stamp is narrower than its siblings, mis-aligned, or overflows, that is a finding.
- The pink halftone band behind the hero must extend edge-to-edge of the viewport (not clipped to the inner column).
- The "ずとまよ" hero wordmark must be large and visibly misregistered (pink + teal channels offset). If it renders as solid black or perfectly aligned, that is a riso-aesthetic regression.

### 2.4 Pass cover (hot-seat privacy)

In a battle, advance until a pass screen appears (e.g. after P1 sets, before P2 sets).

Pass/fail criteria:
- The cover must be **opaque** solid teal/blue. Use `mcp__Claude_in_Chrome__computer` screenshot then visually inspect: no card scans, hand fan, or zone contents should bleed through. Also confirm at P2->P1 transitions, not just P1->P2.
- The "TAP TO REVEAL" stamp button must be focused on mount. Without clicking, press Tab once and then Enter via `mcp__Claude_in_Chrome__computer` key actions. The cover should dismiss. If Tab moves focus elsewhere first, or Enter does nothing, flag it.
- Check that the label correctly names the *target* player (the one about to play), not the player who just finished.

### 2.5 Gallery

Navigate to `/gallery` at 390x844. Scroll the grid to confirm it does not jank or freeze (slow first paint is a known gap, not a bug). Click any card to open the Spotlight dialog.

Pass/fail criteria:
- The card image must fit within the viewport (no cropping by the dialog edges).
- The dialog must scroll vertically; effect text and metadata at the bottom must be reachable by scrolling inside the dialog.
- **Prev/Next buttons must appear inline below the effect text**, not fixed against the mid-left and mid-right viewport edges. Fixed mid-edge buttons are a Wave 2.5 regression.
- Effect text must be legible (>= 14px computed font-size). Use `mcp__Claude_in_Chrome__javascript_tool` to read `getComputedStyle` on the effect node if unsure.

### 2.6 Phase flow and battle log

Mid-battle at desktop width:

Pass/fail criteria:
- After both players have set, the phase stamp must read **"ADVANCE TIME"**, never "SET CARDS" or "PROCESS EFFECTS" lingering as a dead tap (Wave 2.7).
- Each tap that advances a phase should briefly show a transient log caption directly under the phase stamp.
- The battle log panel at the bottom must show the last ~5 entries at legible size. If text computes to ~7.5px or smaller, that is a Wave 2.1 regression (root font-size bug returning).
- A/B badges should appear on selected cards in selection order.

### 2.7 Mute toggle and persistence

Tap the mute control bottom-left.

Pass/fail criteria:
- Icon/label must swap between 音 / SOUND and 消音 / MUTED on each tap.
- Reload via `mcp__Claude_in_Chrome__navigate` to the same URL. Mute state must persist (read `localStorage` via `mcp__Claude_in_Chrome__javascript_tool` to confirm the key is set).
- The control's hit target must be at least 44x44 CSS px (Wave 2.10). Read its `getBoundingClientRect()` to verify.

### 2.8 404 and Credits

- Navigate to `/this-route-doesnt-exist`. A riso-styled custom 404 must render (pink/teal aesthetic, JP+EN copy). If Next's default dark error page appears, that is a finding.
- Navigate to `/credits`. Headings must be present, CC-BY 4.0 attribution text must be verbatim (compare to IMPROVEMENTS.md spec if uncertain), and external links must open in a new tab (`target="_blank"` with `rel="noopener"`).

### 2.9 Quit modal and unload guard

In an active battle, tap the QUIT stamp top-right.

Pass/fail criteria:
- A confirm modal must appear with three options: Resume, Restart, Menu. Each must function (Resume dismisses without state loss; Restart resets the match; Menu returns to `/`).
- Trigger a reload via `mcp__Claude_in_Chrome__javascript_tool` (`window.location.reload()`). The browser's beforeunload guard must fire (dialog or console-visible event). If the page reloads silently mid-match, that is a Wave 2.13 regression.
- From the home menu (no active match), the beforeunload guard must NOT fire on reload. False positives off-match are also findings.

## 3. Accessibility, edge cases, and cross-cutting concerns

This section is the easy-to-forget stuff: keyboard-only operation, screen reader hooks, touch ergonomics, contrast, console noise, network/perf, and weird state transitions. For each subsection, report findings as **PASS**, **FAIL**, or **DEFERRED-WAVE-4** with steps to reproduce and (where relevant) a screenshot or DOM excerpt.

### 3.1 Keyboard-only flow

Unplug the mouse mentally. Try to complete a full match using only `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Escape`.

1. Load `https://dr-manda.github.io/zutomayo-card-game/`. Tab through the home menu. Every stamp (Start, Gallery, Credits, etc.) should receive a visible focus ring, and `Enter` should activate the link. **FAIL** if any stamp is reachable but invisible-focused, or if Enter does nothing.
2. Navigate to `/battle/`. Step through the Initial Placement screen with Tab only. Each card in the HandDrawer should be reachable (every interactive `CardView` is rendered as a `<button>`). Confirm you can place A and B set cards entirely from the keyboard.
3. During a pass cover (hot-seat handoff), focus should auto-land on the inner "Tap to continue" button so a single `Enter` advances. **FAIL** if focus stays on body or is trapped behind the cover.
4. In the Gallery, open a card to enter spotlight mode. `Escape` should close (Wave 2.5). Left/Right arrow keys should step through neighbors. **FAIL** if arrow keys scroll the page instead.
5. SoundToggle (bottom-left): Tab to it, then press both `Space` and `Enter`. Both should toggle. **FAIL** if only one works.
6. Try `Shift+Tab` from mid-game back to the QUIT stamp and confirm tab order is sane (no random jumps to off-screen elements).

### 3.2 Touch tap targets

Wave 2.10 promised every interactive stamp is at least 44×44 px, and spotlight prev/next are 48×48. Verify with Chrome DevTools device toolbar (iPhone 14 preset) and the element inspector:

- Home menu stamps: measure bounding box of each. **FAIL** any < 44×44.
- HandDrawer cards in fan layout: tap area should be the visible card (cards are large, fine).
- SoundToggle: **FAIL** if < 44×44.
- Gallery spotlight `←` / `→` buttons: **FAIL** if < 48×48.
- QUIT stamp on BattleBoard: **FAIL** if < 44×44.

### 3.3 Pinch-zoom

Open `view-source:https://dr-manda.github.io/zutomayo-card-game/` and inspect the `<meta name="viewport">` tag. It should NOT contain `user-scalable=no` or `maximum-scale=1` (Wave 2.10). Then in the device toolbar, use the pinch gesture (Shift+drag) on the Gallery and on the BattleBoard. The page should zoom freely. **FAIL** if zoom is blocked.

### 3.4 Contrast

Use Chrome DevTools "Inspect" → contrast ratio readout on these targets:

- Tiny mono labels (HP, PWR, DECK, log entries): with `--font-size` Wave 2.1 fix, these are now correct rem sizes. Confirm they read as legible at default zoom. Note any that still look ~8 px.
- `fill-night` stamps (deep blue): paper-colored text on top should hit ≥ 4.5:1. **FAIL** if DevTools reports below.
- `fill-accent` stamps (deep red): same check.
- `ink-dim` body text should be `#616161` (not the old `#868686`). Inspect computed styles to confirm.

### 3.5 Screen-reader / a11y panel

Open DevTools → Accessibility tree.

- CardBackCover button's `aria-label` should include the *target* player's name (e.g. "Pass to Player 2"). **FAIL** if it says the previous player or is empty.
- The `motion.div` *wrapper* of the cover should NOT have `aria-hidden="true"` — only the announcement-text inner element should (Wave 2.12 review fix). **FAIL** if the whole motion wrapper is aria-hidden.
- Game log `aria-live` region: probably absent — note as **DEFERRED-WAVE-4** (4.x scope), not a bug.
- Spot-check role hierarchy: HandDrawer cards should be `role="button"`, not `role="img"`.

### 3.6 Reduced motion

DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Run a battle. Battle shake, card slide-ups, chronos clock pulse should be muted or skipped. This is Wave 4.8 — so **DEFERRED-WAVE-4** is expected for most. Flag what still animates so the next session has a punch list.

### 3.7 Console errors

Open DevTools Console BEFORE clicking anything. Hard-reload. Then play a full match from home → battle → quit → restart. Note every red error and yellow warning. Specifically watch for:

- React hydration mismatches (text content did not match…).
- `manifest.json` 404.
- Image decode errors from gallery JPGs.
- "Maximum update depth" or other React loop warnings.
- Howler audio errors (especially after mute → unmute).

Report each verbatim with the stack frame.

### 3.8 Network panel

Reload home with Network tab open and "Disable cache" OFF.

- JS bundle: confirm `content-encoding: gzip` (or br) and that a second reload pulls from disk cache.
- Card JPGs: should be lazy (only the visible ones load). **FAIL** if all 150 MB loads on home page.
- Manifest: must request `/zutomayo-card-game/manifest.json` and return 200. **FAIL** if path is `/manifest.json` or status is 404.

### 3.9 Performance feel

Capture qualitative "feels like" numbers (use Performance panel if you want hard numbers):

- Gallery first scroll: time to first thumb visible. Likely slow — **DEFERRED-WAVE-4** (4.4 thumbnails).
- Spotlight `next` latency: estimate ms. **DEFERRED-WAVE-4** if > 400 ms.
- BattleBoard interactions (set a card, reveal): should feel snappy (< 100 ms).

### 3.10 Edge case states

- **Idle 5 min**: start a match, switch tabs or walk away for 5 minutes, return. Anything frozen? Animations hung? Howler context suspended and not resuming?
- **QUIT during BattleAnimationOverlay**: trigger battle resolution animation, immediately tap QUIT. Does the confirm modal appear cleanly, or does it stack under the overlay / break the animation?
- **Mute mid-battle**: mute → start battle → unmute during a card reveal. Sound should resume at correct volume. **FAIL** if silent or blown out.
- **Route switch during battle**: in active match, type `/gallery/` in URL bar, then back to `/battle/`. Expected: game state resets (useGame is per-page). **FAIL** if it half-persists or crashes.
- **Multi-tab**: open game in two tabs. Toggle mute in tab A. Tab B should NOT auto-flip (localStorage is read at mount only). Verify no cross-interference with active match state.
- **Trailing slash**: try `/battle` (no slash) and `/battle/` (with slash). Both should resolve. **FAIL** if one 404s.

### 3.11 Privacy regression

During a pass cover, open DevTools Elements panel and `Ctrl+F` for known card titles from the previous player's hand. They must NOT appear in the DOM — visual cover alone is insufficient. **FAIL** if any prior-player card name, image src, or aria-label is present in markup behind the cover.

## 4. Wave 4 gap documentation

This section is NOT looking for regressions — it's an inventory of the 10 Wave 4 backlog items. For each one, the spec from IMPROVEMENTS.md is summarised and an EXPECTED FINAL STATE described. Your job: verify whether the gap still exists. Use one of:

- **GAP-OBSERVED** — broken state confirmed; provide the evidence (DOM excerpt, screenshot, network capture, file path that doesn't exist, etc.) so the fix-session has a clear punch list.
- **PARTIAL** — some work has happened but it's not fully there; describe what's done and what's missing.
- **ALREADY-OK** — gap is no longer present; the next session can skip this item entirely.

Use BOTH the live deployed URL AND the local repo at `C:\Users\expre\OneDrive\Documents\zutomayo-card-game\` to verify. Some items (4.2, 4.3) are infra-only — they can only be checked by reading the repo, not the live site.

Repo references in this section assume that path. Read the files directly with the appropriate tools (Read, Glob, Grep). DO NOT propose fixes — just observations and evidence.

### 4.1 Card-effect engine

Spec: 251 of 422 cards carry effect text but `process_effects` is currently a no-op. The fix lands `src/lib/effects.ts` as a pattern matcher over the JP effect strings with measured-coverage order (1. conditional self-attack-buff 164 cards / 2. power-charger disruption 48 / 3. abyss placement+mill 26 / 4. clock-set 12 / 5. HP heal 11 / 6. draw ~10–14 / 7. opponent attack debuff 4 / 8. move-to-power 12). Priority player = whichever seat side (`nightPlayerIndex`) matches the current `getTimePhase(chronosPosition)`. Cost gate evaluated AT the moment effects process. HP-0 ends the game the instant it happens (effect-damage check, not only post-battle). Sub-task: replace the hidden random `nightPlayerIndex` roll with a visible janken / "Player N is NIGHT SIDE" announcement before mulligan.

How to verify:
- Live: play a turn with a Character that has effect text printed on its card art (find one in /gallery first). Observe whether any text appears in the game log when `process_effects` runs.
- Repo: `Read C:\...\src\lib\effects.ts` — does it exist? `Grep` for `process_effects` in `src\hooks\useGame.ts` — is the case-arm still a single `state.currentPhase = 'battle'` skip? `Grep` for `attackModifier` in `src\lib\gameEngine.ts` — does `calculateBattle` apply effect-driven buffs?
- Repo: `Read C:\...\src\components\battle\PregameScreen.tsx` — is there a janken / night-side announcement, or is `nightPlayer` still set silently from `Math.random()` in `useGame.startGame`?
- Live: is there any UI badge on a Character card indicating its effect is `unimplemented`, or are all effects silent?

Expected report fields: count of cards whose effects fire visibly (best: a turn-log line per effect), state of the janken UI, state of the unimplemented-badge UI.

### 4.2 Engine unit tests (vitest)

Spec: add `vitest.config.ts` and `src/lib/__tests__/gameEngine.test.ts` (plus `effects.test.ts` once 4.1 lands). Coverage targets: end-of-turn draw counts (winner 1 / loser 2 / draw 1 / turn 1), advanceTime including the turn-1 prep-clock branch, end-of-turn sweep of ALL set-zone leftovers, mulligan draw-before-shuffle (seeded shuffle), simultaneous deck-out → draw, power-cost attack-0, HP-0 immediate end, replacement A-priority, chronos night/day mapping. Fixed card fixtures preferred over the full cards.json.

How to verify (repo-only):
- `Read package.json` — does `devDependencies` include `vitest`? Does `scripts` have a `test` entry?
- `Glob` for `vitest.config.*` at repo root.
- `Glob` for `src/lib/__tests__/**/*.test.ts`.
- If tests exist: `Bash` run `npx vitest run` and capture exit code + summary.

### 4.3 Playwright E2E + CI workflow

Spec: depends on 4.2. New `playwright.config.ts`, `e2e/battle.spec.ts` playing a full hot-seat turn loop at 390×844, and `.github/workflows/ci.yml` running lint + tsc + vitest + build + Playwright on push/PR. Optional: gate the existing Pages deploy workflow on CI passing.

How to verify (repo-only):
- `Glob` for `playwright.config.*`, `e2e/**/*.spec.ts`, `.github/workflows/ci.yml`.
- `Read .github/workflows/deploy.yml` — does the `build` job have `needs: ci` or similar?
- If E2E exists: note the scenarios it covers (mulligan / pass cover / non-Character initial placement / a few turns / horizontal-scroll assertion).

### 4.4 Card thumbnails (perf)

Spec: card JPGs are 700×978, avg 361 KB, 149.65 MB total. Fix: one-shot sharp script at `scripts/make-thumbs.mjs` writing `public/cards/thumbs/<same-name>.jpg` at 480px wide / quality ~70 (~18 MB total). Add `getLocalCardThumbPath(card)` to `cardAssets.ts` and a `thumb` boolean prop to `CardView`. Pass `thumb` everywhere except the gallery Spotlight (full-res). Also preload spotlight neighbors via `new window.Image().src = …` keyed on `selectedCard` so arrow-key navigation doesn't stall.

How to verify:
- Live (390×844 mobile viewport): open /gallery, DevTools Network → Img filter, hard-reload. Observe total transferred bytes when only the top of the grid is visible. Expected after Wave 4: ~1.5 MB initial. Current expected: ~14 MB.
- Live: in the same DevTools session, open a spotlight, arrow Right to the next card. Time the latency until the next card image renders (estimate ms).
- Repo: `Glob` for `scripts/make-thumbs.*` and `public/cards/thumbs/**`. `Grep` for `getLocalCardThumbPath` in `src/lib/cardAssets.ts`. `Grep` for a `thumb` prop on `CardView`.

### 4.5 Gallery render performance: bare CardView + memoization

Spec: 422 inline `onClick` props re-create every render → reconciles all 422 cells on each filter/spotlight change. Fix: `export default React.memo(CardView)`, memoized `GalleryCell` with stable `useCallback` `onSelect`, new `bare` prop on `CardView` that renders ONLY the bordered artwork (no attribute kanji, no rarity stamp, no caption). Use bare in the grid; metadata lives in the spotlight.

How to verify:
- Live: in DevTools Performance, record a filter-pill click. Look at the time spent inside the React commit. Hundreds of cells reconciling is the symptom.
- Repo: `Grep` for `React.memo` or `memo(` in `src/components/CardView.tsx`. `Grep` for a `bare` prop. `Grep` for `useMemo` / `useCallback` around the grid `map` in `src/app/gallery/page.tsx`.
- Live: visually compare a grid cell to a spotlight render. Are the same chrome elements (attribute kanji, rarity stamp, caption) duplicated in both?

### 4.6 Font loading: drop unused Noto weights, add JP fallbacks

Spec: Noto Sans JP currently loads weights 400/500/700, but every bold/medium use is on `font-numeric` (Barlow Condensed) — 500/700 can never render. Fix: change Noto to `weight: "400"` (saves ~60 KB gzip blocking CSS + ~4 MB dead woff2). Also add `fallback: ['Yu Gothic', 'YuGothic']` to both JP fonts so JP-first UI text doesn't FOUT-then-shift.

How to verify:
- Repo: `Read src/app/layout.tsx`. Inspect the `Noto_Sans_JP({ weight: [...] })` call. Is it still `["400", "500", "700"]`?
- Repo: do `Yusei_Magic` and `Noto_Sans_JP` calls include a `fallback: [...]` array?
- Live: DevTools Network, "Other" filter, hard-reload home. Count `.woff2` requests and total bytes. Expected after Wave 4: fewer Noto weight files.
- Live: hard-reload, watch for layout shift on "ずとまよ" hero text as fonts load. CLS > 0.05 on initial paint is the symptom.

### 4.7 Sound hygiene: trim ui-click, fix StrictMode double-fire

Spec: `public/sfx/processed/ui-click.mp3` is 8.125 s; every StampBadge click stacks overlapping 8-second cassette tails. Fix: re-export trimmed via `ffmpeg -t 0.25 -af "afade=t=out:st=0.2:d=0.05"` (128 KB → ~6 KB). Separately, five components (`CardBackCover`, `BattleAnimationOverlay`, `HandDrawer`, `RevealScreen`, `GameOverScreen`) call `play()` in mount effects with no idempotency guard → React 19 StrictMode dev double-fires every cue. Fix: move into the event handler that causes the transition, OR add a `useRef` fired-flag mirroring `BattleBoard`'s `prevChronos` pattern.

How to verify:
- Live: open DevTools → Sources → load `public/sfx/processed/ui-click.mp3` (the URL is `https://dr-manda.github.io/zutomayo-card-game/sfx/processed/ui-click.mp3`). Read the `Content-Length` header — current is ~128 KB. After Wave 4: ~6 KB.
- Live: tap several stamps in quick succession. Listen for overlapping 8-second cassette tails. If you hear a sustained drone over multiple clicks, gap confirmed.
- Repo: `Read src/components/CardBackCover.tsx`, `BattleAnimationOverlay.tsx`, `HandDrawer.tsx`, `RevealScreen.tsx`, `GameOverScreen.tsx`. Look for `useEffect(() => { ... play(...) ... }, [...])` patterns with no `useRef` fired-flag.

### 4.8 prefers-reduced-motion support

Spec: nothing references reduced motion. Motion-sensitive users get every Framer slide/scale, the battle shake, CSS shakeHit, smooth scroll, and an infinitely-pulsing SMIL `<animate>` on the clock medal. Three pieces:
1. Wrap children in `<MotionConfig reducedMotion="user">` from `motion/react` in the app-wide client wrapper (post-3.3 that's `SfxProvider` itself).
2. Add `@media (prefers-reduced-motion: reduce)` block in `globals.css` disabling `.animate-fade-in / .animate-slide-up / .animate-shake` and forcing `transition-duration: 0.01ms !important` everywhere.
3. In `ChronosClock` use `useReducedMotion()` and conditionally render the SMIL `<animate>` (SMIL is immune to CSS media queries — must be removed from DOM).

How to verify (with DevTools → Rendering → "Emulate prefers-reduced-motion: reduce"):
- Live: hard-reload home, watch the hero fade-in animation. Then battle, watch the slide-up cues and the battle shake on damage. Then watch ChronosClock — does the medal still pulse?
- Repo: `Grep` for `MotionConfig` and `useReducedMotion` in `src/`. `Grep` for `prefers-reduced-motion` in `src/app/globals.css`.
- Repo: `Read src/components/ChronosClock.tsx` — is the SMIL `<animate>` conditionally rendered?

### 4.9 Screen-reader announcements + dialog focus management

Spec: battle state is silent to screen readers and modals don't manage focus. Six fixes:
1. `aria-live="polite"` on the game log `<ul>` (appended `<li>`s announce).
2. HP track div gets `role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={player.hp} aria-label={...}`.
3. `aria-hidden="true"` on the `ChronosClock` `<svg>` (text readout below is the accessible representation).
4. `BattleAnimationOverlay` — keep a permanently-mounted visually-hidden assertive live region in BattlePage; update its text when battle result is computed (the current overlay's own `aria-live` never announces because the region mounts WITH its content).
5. `HandDrawer` gains `aria-modal="true"`, Escape-to-close, focuses first card button on open, restores focus on close.
6. Spotlight focuses the close control on open and restores focus to the originating grid cell on close.

How to verify (DevTools → Accessibility tree, plus a screen reader if available):
- Live: open accessibility tree on /battle. Find the game log — does the `<ul>` have `aria-live="polite"`?
- Live: find the HP bar div. Does it have `role="meter"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`?
- Live: find the ChronosClock SVG. Is it `aria-hidden="true"`?
- Live: open a HandDrawer. Press Escape — does it close? Open it again, press Tab — does focus land on the first card button?
- Live: open Gallery spotlight. Close it. Did focus return to the originating grid cell?

### 4.10 Gallery findability: name search + rarity counts + persistent filters

Spec: only the pack dropdown and rarity pills exist today. Fix, all in `gallery/page.tsx`:
1. `<input type="search">` styled like the pack picker (placeholder 「カード名で検索 / Search by name…」) filtering on `c.title.includes(query) || c.id.includes(query.toLowerCase())`.
2. Per-rarity counts within the current pack+query scope via a `useMemo` Map, appended to each pill's `en` label (e.g. "RARE · 87").
3. Persist `selectedPack`/`selectedRarity` to sessionStorage in an effect and hydrate in a mount effect (NOT a useState initializer — SSG-hydration-safe).

How to verify:
- Live: navigate to /gallery. Is there a search input? If yes, type a known card name and confirm filter narrows.
- Live: are rarity pills showing counts in their EN label?
- Live: pick a non-default pack and rarity. Navigate to /, then back to /gallery. Did selection persist?
- Repo: `Grep` for `<input type="search"` in `src/app/gallery/page.tsx`. `Grep` for `sessionStorage` in the same file.

For each Wave 4 subsection, the report block should follow the same format as Sections 1–3 — but the Severity field becomes one of `GAP-OBSERVED`, `PARTIAL`, or `ALREADY-OK` instead of blocker/high/medium/low/nit.

## Reporting format

Report every finding using this EXACT format so the user can paste them into the fix-session unchanged:

```md
## Finding <ID>: <one-line title>
- **Severity:** blocker / high / medium / low / nit  (Sections 1–3)
              | GAP-OBSERVED / PARTIAL / ALREADY-OK   (Section 4)
- **Wave item:** e.g. "Wave 1.6 regression" or "Wave 4.4"
- **Where:** route + element / screen / interaction
- **Steps to reproduce:**
  1. ...
  2. ...
- **Observed:** what actually happened (or, for Section 4: the current broken/missing state — DOM excerpt, file-not-found, network capture, etc.)
- **Expected:** what should have happened (cite the rule or Wave item if applicable)
- **Screenshot:** path to a saved screenshot if helpful
```

End your report with TWO summary tables:

1. **Section 1–3 regressions** — sorted by severity (blocker → nit), with Finding ID + one-line title per row.
2. **Section 4 Wave-4 gap inventory** — one row per Wave 4 item (4.1 through 4.10), columns: `Item · Status (GAP-OBSERVED / PARTIAL / ALREADY-OK) · One-line summary`.

NO fix suggestions — fix design is the next session's job. Just observations and evidence.

---

Put the full findings list at the very end of your turn, formatted exactly as specified above (one block per finding, then the two summary tables). Do not edit, reorder, or wrap that final block — the user will copy-paste it verbatim into an ultracode fix-session.
