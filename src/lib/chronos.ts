import { TimePhase } from '@/types/game'

export const CHRONOS_POSITIONS = 12

// Night: positions 9, 10, 11, 0, 1, 2 (top half of clock)
// Day: positions 3, 4, 5, 6, 7, 8 (bottom half of clock)
const NIGHT_POSITIONS = new Set([9, 10, 11, 0, 1, 2])

export function getTimePhase(position: number): TimePhase {
  const normalized = ((position % CHRONOS_POSITIONS) + CHRONOS_POSITIONS) % CHRONOS_POSITIONS
  return NIGHT_POSITIONS.has(normalized) ? 'night' : 'day'
}

export function advanceChronos(currentPosition: number, clockValue: number): number {
  return (currentPosition + clockValue) % CHRONOS_POSITIONS
}

export function getChronosAngle(position: number): number {
  return (position / CHRONOS_POSITIONS) * 360
}

export function getPositionLabel(position: number): string {
  const normalized = ((position % CHRONOS_POSITIONS) + CHRONOS_POSITIONS) % CHRONOS_POSITIONS
  const labels: Record<number, string> = {
    0: '真夜中 / Midnight',
    1: '深夜 / Late Night',
    2: '未明 / Before Dawn',
    3: '夜明け / Dawn',
    4: '早朝 / Early Morning',
    5: '午前 / Morning',
    6: '正午 / Noon',
    7: '午後 / Afternoon',
    8: '夕方 / Evening',
    9: '日暮れ / Dusk',
    10: '宵 / Nightfall',
    11: '夜半 / Late Evening',
  }
  return labels[normalized] || ''
}
