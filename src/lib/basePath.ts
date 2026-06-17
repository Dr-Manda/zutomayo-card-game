/**
 * Single source of truth for the production base path.
 *
 * The repo is named `zutomayo-card-game` on GitHub, so GitHub Pages serves
 * the site under `/zutomayo-card-game`. next.config.ts threads this into
 * Next's built-in basePath handling for routes and asset prefixes — but
 * a handful of things bypass that pipeline and need this constant:
 *
 *  - `metadata.manifest` in layout.tsx — verified empirically that Next
 *    does NOT prefix this field; without manual prefixing, /manifest.json
 *    404s on Pages and the install prompt never shows.
 *  - Image src strings we build by hand in cardAssets.ts and sound.ts —
 *    we don't go through next/image's loader for these, so basePath
 *    doesn't apply automatically.
 *
 * Keep all three call sites importing from here so the prefix never drifts.
 * If the repo is ever renamed, this constant + next.config.ts are the
 * two edits that need to happen together.
 */
export const BASE_PATH =
  process.env.NODE_ENV === 'production' ? '/zutomayo-card-game' : ''
