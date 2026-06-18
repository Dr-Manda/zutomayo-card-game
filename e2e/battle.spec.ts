import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end hot-seat battle smoke test, run at the 390×844 mobile viewport
 * declared in playwright.config.ts. Walks the transition graph that the
 * Wave 1 / Wave 2 fixes care about:
 *
 *   pregame
 *     → mulligan_p1 → pass_to_p2_mulligan → mulligan_p2
 *     → pass_to_p1_initial → initial_p1 → pass_to_p2_initial → initial_p2
 *     → reveal → phase_flow (BattleBoard rendered)
 *
 * Engine correctness is covered by `src/lib/__tests__/gameEngine.test.ts`
 * (Wave 1.1–1.9 unit regressions). This spec is the visible-flow gate:
 * every pass cover stays reachable, the dispatcher routes through all the
 * sub-screens without dead-ending, and the BattleBoard renders inside the
 * 390 px viewport without horizontal overflow (the Wave 2.2 regression).
 *
 * StampBadge computes its aria-label as "${jp} (${en})", so every selector
 * here matches via regex against the EN portion — labels can be JP-tweaked
 * without false-failing the suite.
 */

const DIALOG = '[role="dialog"]'

/** Click the pass cover currently on top of the device hand-off overlay. */
async function tapPassCover(page: Page) {
  await page.getByRole('button', { name: /tap to reveal/i }).click()
}

/** Pick the Nth card button inside the open HandDrawer dialog. The first
 *  in-DOM button (index 0) is the dialog's CLOSE stamp, so card buttons
 *  start at 1. In single-select mode (maxSelections=1) the drawer fires
 *  onConfirm and closes immediately on this click — no follow-up confirm
 *  press needed. */
async function pickCard(page: Page, cardIndex: number) {
  await page
    .locator(`${DIALOG} button`)
    .nth(1 + cardIndex)
    .click()
}

test.describe('Battle hot-seat flow', () => {
  test('walks pregame → mulligans → placements → reveal → battle board', async ({
    page,
  }) => {
    await page.goto('/battle')

    // ─── Pregame ──────────────────────────────────────────────────────
    await expect(
      page.getByRole('button', { name: /START GAME/i }),
    ).toBeVisible()
    await page.getByRole('button', { name: /START GAME/i }).click()

    // ─── Mulligan P1 (skip — keep all 5 cards) ────────────────────────
    await expect(page.locator(DIALOG)).toBeVisible()
    await page.getByRole('button', { name: /Keep All/i }).click()

    // ─── Pass to P2, then P2 skip mulligan ────────────────────────────
    await tapPassCover(page)
    await expect(page.locator(DIALOG)).toBeVisible()
    await page.getByRole('button', { name: /Keep All/i }).click()

    // ─── Pass to P1 for initial placement ─────────────────────────────
    await tapPassCover(page)
    await expect(page.locator(DIALOG)).toBeVisible()
    // Single-select drawer (maxSelections=1). The click itself fires the
    // engine's placeInitialBattleCard and routes to the next pass cover —
    // no SET button confirmation step. The chosen card's class is whatever
    // the shuffle produced; the engine's class-blind initial placement
    // (Wave 1.4) is covered exhaustively by the vitest suite.
    await pickCard(page, 0)

    // ─── Pass to P2 for initial placement ─────────────────────────────
    await tapPassCover(page)
    await expect(page.locator(DIALOG)).toBeVisible()
    await pickCard(page, 0)

    // ─── Reveal screen → start the battle phase loop ──────────────────
    await expect(
      page.getByRole('button', { name: /START BATTLE/i }),
    ).toBeVisible()
    await page.getByRole('button', { name: /START BATTLE/i }).click()

    // ─── BattleBoard renders with both players' HP meters ─────────────
    // role="meter" is the stable accessibility signal Wave 4.9 added — two
    // meters means both PlayerField components mounted, which only happens
    // when the dispatcher reached `phase_flow` cleanly.
    await expect(page.locator('[role="meter"]')).toHaveCount(2)

    // ─── Mobile layout regression (Wave 2.2) ──────────────────────────
    // After everything has settled, the document body must not exceed
    // the 390 px viewport horizontally. A positive overflow here is the
    // "board overflows from turn 1" regression returning.
    const horizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth - root.clientWidth
    })
    expect(horizontalOverflow).toBeLessThanOrEqual(0)
  })

  test('home menu surfaces a link into /battle', async ({ page }) => {
    await page.goto('/')
    // Smoke check: the hero wordmark renders and a BATTLE entry into
    // /battle is reachable as a Link. (We don't follow it here because
    // the main flow test already exercises /battle directly.)
    await expect(page.getByText(/ずとまよ|ZUTOMAYO/i).first()).toBeVisible()
    const battleLink = page.getByRole('link', { name: /BATTLE|対戦/i }).first()
    await expect(battleLink).toBeVisible()
  })
})
