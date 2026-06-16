'use client'

import { Howl, Howler } from 'howler'

const BASE_PATH = process.env.NODE_ENV === 'production' ? '/zutomayo-card-game' : ''
const sfx = (file: string) => `${BASE_PATH}/sfx/processed/${file}`

export type SfxId =
  | 'card-flip'
  | 'card-set'
  | 'impact'
  | 'clock-tick'
  | 'damage-tick'
  | 'ui-click'
  | 'sting-start'
  | 'sting-end'

type SoundConfig = {
  src: string
  volume: number
  rateRange?: [number, number]
}

const SOUND_CONFIGS: Record<SfxId, SoundConfig> = {
  'card-flip':   { src: sfx('card-flip.mp3'),   volume: 0.5, rateRange: [0.95, 1.05] },
  'card-set':    { src: sfx('card-set.mp3'),    volume: 0.5, rateRange: [0.92, 1.08] },
  'impact':      { src: sfx('impact.mp3'),      volume: 0.6 },
  'clock-tick':  { src: sfx('clock-tick.mp3'),  volume: 0.3 },
  'damage-tick': { src: sfx('damage-tick.mp3'), volume: 0.5 },
  'ui-click':    { src: sfx('ui-click.mp3'),    volume: 0.35 },
  'sting-start': { src: sfx('sting-start.mp3'), volume: 0.7 },
  'sting-end':   { src: sfx('sting-end.mp3'),   volume: 0.7 },
}

// A 1-frame near-silent WAV (44 bytes RIFF header + tiny PCM payload) used to
// nudge the WebAudio graph awake on the first user gesture.
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

interface ISoundManager {
  init(): void
  unlock(): void
  play(id: SfxId): void
  stopAll(): void
  setMasterVolume(volume: number): void
}

class SoundManager implements ISoundManager {
  private sounds: Map<SfxId, Howl> = new Map()
  private unlocked = false
  private initialized = false

  init(): void {
    if (this.initialized) return
    this.initialized = true

    ;(Object.keys(SOUND_CONFIGS) as SfxId[]).forEach((id) => {
      const cfg = SOUND_CONFIGS[id]
      const shouldPreload = id !== 'sting-start' && id !== 'sting-end'
      const howl = new Howl({
        src: [cfg.src],
        volume: cfg.volume,
        preload: shouldPreload,
        html5: false,
      })
      this.sounds.set(id, howl)
    })
  }

  unlock(): void {
    if (this.unlocked) return
    this.unlocked = true

    try {
      const ctx = Howler.ctx
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        // Fire-and-forget; promise rejection is non-fatal.
        void ctx.resume()
      }
    } catch {
      // Howler.ctx may not be ready yet in some environments; ignore.
    }

    try {
      const silent = new Howl({
        src: [SILENT_WAV_DATA_URI],
        volume: 0,
        preload: true,
        html5: false,
      })
      silent.play()
    } catch {
      // Silent unlock failure is non-fatal.
    }
  }

  play(id: SfxId): void {
    if (!this.initialized) this.init()
    if (!this.unlocked) this.unlock()

    const sound = this.sounds.get(id)
    if (!sound) return

    const cfg = SOUND_CONFIGS[id]
    if (cfg.rateRange) {
      const [min, max] = cfg.rateRange
      const r = Math.random()
      const rate = min + r * (max - min)
      sound.rate(rate)
    }

    sound.play()
  }

  stopAll(): void {
    this.sounds.forEach((sound) => sound.stop())
  }

  setMasterVolume(volume: number): void {
    try {
      Howler.volume(volume)
    } catch {
      // No-op if Howler global isn't ready.
    }
  }
}

// SSR-safe no-op stub matching the SoundManager surface.
const noopManager: ISoundManager = {
  init: () => {},
  unlock: () => {},
  play: () => {},
  stopAll: () => {},
  setMasterVolume: () => {},
}

let instance: ISoundManager | null = null

export function getSoundManager(): ISoundManager {
  if (typeof window === 'undefined') {
    return noopManager
  }
  if (!instance) {
    instance = new SoundManager()
  }
  return instance
}
