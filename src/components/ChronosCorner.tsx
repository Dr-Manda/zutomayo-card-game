'use client'

import ChronosClock from './ChronosClock'
import { getTimePhase, CHRONOS_POSITIONS } from '@/lib/chronos'

interface ChronosCornerProps {
  position: number
  corner?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  onExpand?: () => void
  /** 'corner' = fixed 120×140 floating panel; 'compact' = small inline row.
   *  Use 'compact' inside the BattleBoard top bar on mobile so the clock no
   *  longer overlaps P1's mirrored battle slot. */
  size?: 'corner' | 'compact'
}

const cornerClasses: Record<NonNullable<ChronosCornerProps['corner']>, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
}

export default function ChronosCorner({
  position,
  corner = 'top-right',
  onExpand,
  size = 'corner',
}: ChronosCornerProps) {
  const normalized = ((position % CHRONOS_POSITIONS) + CHRONOS_POSITIONS) % CHRONOS_POSITIONS
  const phase = getTimePhase(normalized)
  // position 0 = midnight (00:00); each step = 2 hours
  const hour = (normalized * 2) % 24
  const label = `${String(hour).padStart(2, '0')}:00 / ${phase === 'night' ? 'NIGHT' : 'DAY'}`

  const expandable = typeof onExpand === 'function'

  if (size === 'compact') {
    // Inline horizontal row — small clock + HH:00 text. Stays in flow so it
    // can't cover P1's mirrored battle slot or the DAY/NIGHT stamp.
    return (
      <div
        role="status"
        aria-label={`Chronos clock, ${label}`}
        className="card-isolate bg-paper-deep border-2 border-ink px-2 py-1 flex items-center gap-2"
      >
        <ChronosClock position={position} size={44} />
        <span className="font-numeric font-bold text-xs ink-offset-tight text-ink whitespace-nowrap">
          {label}
        </span>
      </div>
    )
  }

  const baseClasses = `fixed ${cornerClasses[corner]} z-30 card-isolate bg-paper-deep border-2 border-ink p-2 flex flex-col items-center gap-1 transition-colors`

  if (expandable) {
    return (
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Chronos clock, ${label}. Expand for details.`}
        className={`${baseClasses} stamp-reset cursor-pointer hover:bg-paper relative`}
        style={{ width: 120, minHeight: 140 }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 font-numeric text-[10px] leading-none text-ink-secondary"
        >
          &#x2295;
        </span>
        <ChronosClock position={position} size={88} />
        <div className="w-full h-px bg-ink-secondary" />
        <span className="font-numeric font-bold text-xs ink-offset-tight text-ink">
          {label}
        </span>
      </button>
    )
  }

  return (
    <div
      role="status"
      aria-label={`Chronos clock, ${label}`}
      className={baseClasses}
      style={{ width: 120, minHeight: 140 }}
    >
      <ChronosClock position={position} size={88} />
      <div className="w-full h-px bg-ink-secondary" />
      <span className="font-numeric font-bold text-xs ink-offset-tight text-ink">
        {label}
      </span>
    </div>
  )
}
