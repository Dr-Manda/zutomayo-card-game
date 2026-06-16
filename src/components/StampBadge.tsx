'use client'

import Link from 'next/link'
import type { ReactNode, MouseEvent } from 'react'
import { useSfx } from './SfxProvider'
import type { SfxId } from '@/lib/sound'

export type StampBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type StampBadgeVariant =
  | 'outline'
  | 'fill-accent'
  | 'fill-ink'
  | 'fill-night'
  | 'fill-paper'

export interface StampBadgeProps {
  size?: StampBadgeSize
  variant?: StampBadgeVariant
  jp?: string
  en?: string
  children?: ReactNode
  onClick?: (e: MouseEvent<HTMLElement>) => void
  href?: string
  disabled?: boolean
  offset?: boolean
  className?: string
  ariaLabel?: string
  /**
   * SFX id to play on interactive click. Defaults to 'ui-click'.
   * Pass 'none' to disable sound on this badge.
   */
  sfx?: SfxId | 'none'
}

/**
 * Size token table. Padding + JP font size + EN font size per size.
 * Tailwind-only so the class strings stay statically analyzable.
 */
const SIZE_CLASSES: Record<
  StampBadgeSize,
  { pad: string; jp: string; en: string }
> = {
  xs: { pad: 'px-2 py-1', jp: 'text-xs', en: 'text-[8px]' },
  sm: { pad: 'px-3 py-1.5', jp: 'text-sm', en: 'text-[9px]' },
  md: { pad: 'px-4 py-2', jp: 'text-base', en: 'text-[10px]' },
  lg: { pad: 'px-5 py-2.5', jp: 'text-lg', en: 'text-[11px]' },
  xl: { pad: 'px-6 py-3', jp: 'text-2xl', en: 'text-xs' },
}

/**
 * Variant token table. Each variant declares its resting state classes plus the
 * hover-state classes used when the badge is interactive (group-hover swap to
 * fill-accent for outline, scale-down for the rest is handled at the root).
 */
const VARIANT_CLASSES: Record<StampBadgeVariant, string> = {
  outline: 'border-2 border-ink bg-paper-deep text-ink',
  // Use the WCAG-deep variants on filled badges so paper-on-fill text passes
  // contrast (the fluorescent originals are reserved for large display
  // graphics — halftones, halftone bands, the hero band, the clock dome).
  'fill-accent': 'border-2 border-ink bg-accent-deep text-paper',
  'fill-ink': 'border-2 border-ink bg-ink text-paper',
  'fill-night': 'border-2 border-ink bg-night-deep text-paper',
  'fill-paper': 'border-2 border-ink bg-paper text-ink',
}

/**
 * Outline-only hover swap: cross-fade background to accent (pink) and text to
 * paper. Other variants get the active:scale-95 affordance instead since
 * recoloring a knockout fill reads as glitch, not feedback.
 */
const INTERACTIVE_HOVER: Record<StampBadgeVariant, string> = {
  outline: 'hover:bg-accent-deep hover:text-paper',
  'fill-accent': '',
  'fill-ink': '',
  'fill-night': '',
  'fill-paper': '',
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function StampBadge({
  size = 'md',
  variant = 'outline',
  jp,
  en,
  children,
  onClick,
  href,
  disabled = false,
  offset = false,
  className,
  ariaLabel,
  sfx = 'ui-click',
}: StampBadgeProps) {
  const sizeTok = SIZE_CLASSES[size]
  const variantTok = VARIANT_CLASSES[variant]
  const { play } = useSfx()

  const interactive = !disabled && (Boolean(onClick) || Boolean(href))

  // Fire SFX before any user-supplied onClick, but only on interactive
  // variants (button + Link with onClick). Read-only <span> branches skip this
  // wrapper entirely and stay silent.
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (sfx !== 'none') play(sfx)
    onClick?.(e)
  }

  const baseClasses = cx(
    // Layout: inline-flex so the badge sits naturally in flow.
    'inline-flex items-center justify-center select-none',
    // Reset any user-agent button styling without losing focus ring.
    'stamp-reset',
    // No rounded corners — chrome rule.
    'rounded-none',
    sizeTok.pad,
    variantTok,
    offset && 'border-offset',
    interactive && 'cursor-pointer transition-colors duration-200',
    interactive && INTERACTIVE_HOVER[variant],
    interactive && 'active:scale-95 transition-transform',
    // WCAG 2.5.5 / iOS 44pt / Android 48dp tap target — applied only to
    // interactive badges so read-only label stamps stay snug in flow.
    interactive && 'min-h-[44px] min-w-[44px]',
    interactive && 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  )

  // JP text gets the riso ink-offset misregistration on the largest size
  // because that's where the display-type idiom reads.
  const jpClasses = cx(
    'font-display leading-none',
    sizeTok.jp,
    size === 'xl' && 'ink-offset',
  )
  const enClasses = cx(
    'font-mono uppercase tracking-widest leading-none',
    sizeTok.en,
  )

  const content: ReactNode = children ? (
    children
  ) : (
    <span className="flex flex-col items-center gap-0">
      {jp && <span className={jpClasses}>{jp}</span>}
      {en && <span className={enClasses}>{en}</span>}
    </span>
  )

  // Aria label: prefer explicit, otherwise derive from jp/en.
  const computedAria =
    ariaLabel ?? (jp && en ? `${jp} (${en})` : jp ?? en)

  // Render as <a> via Next Link when href is provided.
  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={baseClasses}
        aria-label={computedAria}
        onClick={handleClick}
      >
        {content}
      </Link>
    )
  }

  // Render as <button> when onClick is provided (or disabled+onClick context).
  if (onClick !== undefined) {
    return (
      <button
        type="button"
        className={baseClasses}
        onClick={handleClick}
        disabled={disabled}
        aria-label={computedAria}
      >
        {content}
      </button>
    )
  }

  // Otherwise, render a read-only <span>.
  return (
    <span className={baseClasses} aria-label={computedAria}>
      {content}
    </span>
  )
}

export default StampBadge
