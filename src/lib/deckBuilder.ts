import { Card } from '@/types/game'
import allCards from '@/data/cards.json'

const cardPool = allCards as Card[]

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function generateRandomDeck(): Card[] {
  const characters = shuffle(cardPool.filter(c => c.class === 'Character'))
  const enchants = shuffle(cardPool.filter(c => c.class === 'Enchant'))
  const areaEnchants = shuffle(cardPool.filter(c => c.class === 'Area Enchant'))

  const deck: Card[] = []
  const used = new Map<string, number>()

  function addCard(card: Card): boolean {
    const count = used.get(card.id) || 0
    if (count >= 2) return false
    used.set(card.id, count + 1)
    deck.push(card)
    return true
  }

  // At least 10 characters (50%+ of 20)
  let charCount = 0
  for (const card of characters) {
    if (charCount >= 12) break
    if (addCard(card)) charCount++
  }

  // Add some enchants
  for (const card of enchants) {
    if (deck.length >= 18) break
    addCard(card)
  }

  // Add area enchants
  for (const card of areaEnchants) {
    if (deck.length >= 20) break
    if (addCard(card)) break
  }

  // Fill remaining slots with any available cards
  const remaining = shuffle(cardPool)
  for (const card of remaining) {
    if (deck.length >= 20) break
    if (!deck.includes(card)) addCard(card)
  }

  return deck.slice(0, 20)
}

export function getPackNames(): string[] {
  const packs = new Set<string>()
  cardPool.forEach(c => c.pack.forEach(p => packs.add(p)))
  return [...packs]
}

export function getCardsByPack(packName: string): Card[] {
  return cardPool.filter(c => c.pack.includes(packName))
}

export function getAllCards(): Card[] {
  return cardPool
}
