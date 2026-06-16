import type { Attribute, CardClass, Rarity } from '@/types/game'

export type { Attribute, CardClass, Rarity }

export const ATTRIBUTE_COLORS: Record<Attribute, string> = {
  '闇': '#1a1a1a',
  '炎': '#F15060',
  '電気': '#00AEEF',
  '風': '#535353',
  'カオス': '#0a3e74',
}

export const ATTRIBUTE_EN: Record<Attribute, string> = {
  '闇': 'Darkness',
  '炎': 'Flame',
  '電気': 'Electric',
  '風': 'Wind',
  'カオス': 'Chaos',
}

export const RARITY_COLORS: Record<Rarity, string> = {
  UR: '#F15060',
  SR: '#00AEEF',
  R: '#1a1a1a',
  N: '#868686',
  SE: '#0a3e74',
}

export const CLASS_EN: Record<CardClass, string> = {
  'Character': 'Character',
  'Enchant': 'Enchant',
  'Area Enchant': 'Area Enchant',
}
