'use client'

import { useReducedMotion } from 'motion/react'
import { getTimePhase, getPositionLabel, CHRONOS_POSITIONS } from '@/lib/chronos'

interface ChronosClockProps {
  position: number
  size?: number
}

export default function ChronosClock({ position, size = 240 }: ChronosClockProps) {
  // Reduced-motion path: drop the SMIL pulse. SMIL is immune to the global CSS
  // media query so it has to be removed from the DOM rather than disabled.
  // The text readout below the clock is the accessible representation.
  const prefersReducedMotion = useReducedMotion()
  const timePhase = getTimePhase(position)
  const label = getPositionLabel(position)
  const center = size / 2
  const radius = size / 2 - 8

  const normalizedPos = ((position % CHRONOS_POSITIONS) + CHRONOS_POSITIONS) % CHRONOS_POSITIONS
  // -90 to start from top (position 0 = midnight at top)
  const angle = (normalizedPos / CHRONOS_POSITIONS) * 360 - 90
  const medalX = center + radius * 0.75 * Math.cos((angle * Math.PI) / 180)
  const medalY = center + radius * 0.75 * Math.sin((angle * Math.PI) / 180)

  // Midnight star (position 0) coordinates — top of circle
  const midnightAngle = -90
  const midnightX = center + radius * Math.cos((midnightAngle * Math.PI) / 180)
  const midnightY = center + radius * Math.sin((midnightAngle * Math.PI) / 180)

  // Tick projection: from outer ring inward
  const tickOuter = radius
  const tickInner = radius - 8

  return (
    <div className="flex flex-col items-center gap-2">
      {/* SVG is a redundant visual restatement of the text readout below.
          Hide from AT so screen readers don't enumerate the dome paths and
          tick lines — the position label + day/night text covers it. */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <defs>
          <pattern id="halftone-teal-clock" patternUnits="userSpaceOnUse" width="8" height="8">
            <rect width="8" height="8" fill="#f1ece2" />
            <circle cx="4" cy="4" r="1.5" fill="#00AEEF" />
          </pattern>
          <pattern id="halftone-pink-clock" patternUnits="userSpaceOnUse" width="8" height="8">
            <rect width="8" height="8" fill="#f1ece2" />
            <circle cx="4" cy="4" r="1.5" fill="#F15060" />
          </pattern>
        </defs>

        {/* Upper dome (night, positions 9-2) — halftone teal */}
        <path
          d={`M ${center - radius},${center} A ${radius},${radius} 0 0,1 ${center + radius},${center} Z`}
          fill="url(#halftone-teal-clock)"
          stroke="#1a1a1a"
          strokeWidth="2"
        />
        {/* Lower dome (day, positions 3-8) — halftone pink */}
        <path
          d={`M ${center - radius},${center} A ${radius},${radius} 0 0,0 ${center + radius},${center} Z`}
          fill="url(#halftone-pink-clock)"
          stroke="#1a1a1a"
          strokeWidth="2"
        />

        {/* Outer ring — 2.5px ink */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2.5"
        />

        {/* Position markers: 1px ink ticks projecting inward */}
        {Array.from({ length: CHRONOS_POSITIONS }).map((_, i) => {
          if (i === 0) return null // midnight gets the diamond stamp instead
          const a = (i / CHRONOS_POSITIONS) * 360 - 90
          const cos = Math.cos((a * Math.PI) / 180)
          const sin = Math.sin((a * Math.PI) / 180)
          const x1 = center + tickOuter * cos
          const y1 = center + tickOuter * sin
          const x2 = center + tickInner * cos
          const y2 = center + tickInner * sin
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#1a1a1a"
              strokeWidth="1"
            />
          )
        })}

        {/* Midnight stamp — 12px square rotated 45° (diamond), ink fill, centered on position 0 */}
        <g transform={`translate(${midnightX}, ${midnightY}) rotate(45)`}>
          <rect x={-6} y={-6} width={12} height={12} fill="#1a1a1a" />
        </g>

        {/* Medal indicator — 10px ink square with accent misregistration offset */}
        {/* Accent layer first (offset -1, -1 for riso feel) */}
        <rect
          x={medalX - 5 - 1}
          y={medalY - 5 - 1}
          width={10}
          height={10}
          fill="#F15060"
        />
        {/* Ink layer on top. The SMIL <animate> is conditionally omitted under
            prefers-reduced-motion — see the useReducedMotion call above. */}
        <rect
          x={medalX - 5}
          y={medalY - 5}
          width={10}
          height={10}
          fill="#1a1a1a"
        >
          {!prefersReducedMotion && (
            <animate
              attributeName="opacity"
              values="1;0.7;1"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </rect>
      </svg>

      {/* Hour readout — font-numeric, ink only, no color */}
      <div className="font-numeric text-ink text-sm tracking-wide uppercase">
        {label}
      </div>
      <div className="font-mono text-ink-dim text-[10px] uppercase tracking-widest">
        {timePhase === 'night' ? 'NIGHT' : 'DAY'}
      </div>
    </div>
  )
}
