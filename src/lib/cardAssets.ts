import type { Card } from '@/types/game'

const BASE_PATH = process.env.NODE_ENV === 'production' ? '/zutomayo-card-game' : ''

export function getLocalCardPath(card: Card): string {
  const filename = card.img.split('/').pop() || ''
  return `${BASE_PATH}/cards/${filename}`
}

export function getCardBackPath(): string {
  return `${BASE_PATH}/cards/_back.jpg`
}

export function getMatImagePath(dim = true): string {
  return `${BASE_PATH}/mat/${dim ? 'zutomayo_field01_dim.jpg' : 'zutomayo_field01.jpg'}`
}
