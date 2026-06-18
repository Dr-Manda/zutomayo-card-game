import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — single mobile project at 390×844 (the iPhone-ish
 * viewport every Wave 2 layout fix was sized against). One mobile project
 * is enough for the regression net we care about; if we ever add desktop
 * checks, just append another project below.
 *
 * The webServer block boots `next dev` and waits for http://localhost:3000
 * before the suite runs. CI sets `process.env.CI=true`, which switches to
 * single-worker + retries so a flaky network-load doesn't false-fail the
 * deploy gate.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
