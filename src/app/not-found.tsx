import StampBadge from '@/components/StampBadge'

/**
 * Riso-styled 404 page.
 *
 * Next emits out/404.html from this component during the static export, which
 * Pages serves automatically for any unmatched route. Without this file Next
 * would ship its generic dark default — visually alien next to the rest of
 * the riso/zine surface.
 */
export default function NotFound() {
  return (
    <main className="flex-1 min-h-svh flex flex-col items-center justify-center px-4 py-12 text-center">
      {/* Halftone band breaks out of the centered column for the full-width
          motif the home and rules pages also use. */}
      <div className="relative w-screen left-1/2 -translate-x-1/2 mb-8 -mt-8">
        <div className="relative h-[40px] bg-accent-deep overflow-hidden">
          <div
            className="absolute inset-0 halftone-pink-coarse mix-blend-multiply opacity-90"
            aria-hidden
          />
          <div className="relative h-full flex items-center justify-center">
            <span
              className="font-mono uppercase text-paper text-xs md:text-sm"
              style={{ letterSpacing: '0.3em' }}
            >
              ERROR · ERROR · ERROR
            </span>
          </div>
        </div>
      </div>

      <h1
        className="ink-offset font-display text-ink leading-none mb-4"
        style={{ fontSize: 'clamp(96px, 22vw, 220px)' }}
        aria-label="404 — page not found"
      >
        404
      </h1>

      <p className="font-display text-2xl text-ink mb-2">
        ページが見つかりません
      </p>
      <p className="font-mono text-xs text-ink-dim mb-10 max-w-md">
        PAGE NOT FOUND — the card you were looking for is somewhere else,
        or it never existed. Either way, the deck doesn&apos;t have it.
      </p>

      <div className="w-full max-w-sm [&>a]:w-full [&>a]:flex">
        <StampBadge
          size="lg"
          variant="fill-accent"
          jp="メニューへ"
          en="BACK TO MENU"
          href="/"
        />
      </div>
    </main>
  )
}
