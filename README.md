# ずとまよ Card Game

> 非公式ファンメイド · Unofficial fanmade · not affiliated with EARN-A-ROCK / ZUTOMAYO.

A two-player hot-seat web implementation of the ZUTOMAYO Card Game, presented
in a riso-print / zine aesthetic. Built with Next.js 15 and statically exported
for GitHub Pages.

## Stack

- Next.js 15 (App Router, `output: 'export'`)
- React 19
- Tailwind v4 (no PostCSS plugins — `@theme inline` tokens)
- TypeScript 5
- Motion (Framer Motion successor) + Howler (lazy-loaded)
- No backend, no database — fully static.

## Local development

```bash
npm install
npm run dev          # localhost:3000
npm run lint
npm run build        # produces ./out/
npx tsc --noEmit
```

The development server runs without basePath; the production build prefixes
every asset with `/zutomayo-card-game/` to match the GitHub Pages URL.

## Deployment

Push to `main` and GitHub Actions runs `.github/workflows/deploy.yml`, which
builds the static export and publishes it via the Pages deployment.
The first push needs **Settings → Pages → Source: GitHub Actions** to be set
manually.

The repo MUST be named exactly `zutomayo-card-game` — `next.config.ts`
hardcodes that as the production `basePath`. Renaming requires editing
`next.config.ts` and `src/lib/basePath.ts` in lockstep.

## Project layout

```
src/
├── app/                  # Next.js routes
│   ├── battle/            #   /battle — hot-seat match
│   ├── gallery/           #   /gallery — card catalog
│   ├── rules/             #   /rules — game rules
│   ├── credits/           #   /credits — CC-BY attributions
│   └── layout.tsx, page.tsx, globals.css
├── components/           # Shared UI atoms + battle screens
├── hooks/                #   useGame() — the dispatcher + state machine
├── lib/                  # Engine, deck builder, sound, basePath, theme
├── data/                 #   cards.json — 422-card catalog
└── types/                #   GameState, Card, PlayerState, ...
public/
├── cards/                # ~150MB of card scans (NOT covered by repo license)
├── mat/                  # Riso play-mat background images
└── sfx/                  # Card-flip / clock-tick / impact / sting clips
```

## Backlog

See [`IMPROVEMENTS.md`](./IMPROVEMENTS.md). It's organized into 4 waves
(Correctness → Core experience → Ship it → Depth & hygiene); Waves 1 and 2
ship in the initial commit, Wave 3 is the deploy plumbing, Wave 4 is the
effects engine and test infra.

## Licensing

- **Source code** (everything under `src/`, plus config files) is released
  under the [MIT License](./LICENSE).
- **Assets** under `public/cards/`, `public/mat/`, and `public/sfx/` are
  NOT covered by the source license. The card and mat artwork belongs to
  EARN-A-ROCK / ZUTOMAYO and is used here purely for fan-project purposes
  with no claim of ownership. The SFX files have their own licenses
  documented in `public/sfx/CREDITS.txt` (see also the in-app
  `/credits` page).

If you are an EARN-A-ROCK / ZUTOMAYO rightsholder and would like any
specific asset removed, open an issue or email and it will be removed
the same day.
