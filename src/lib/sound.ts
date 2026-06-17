'use client'

// Lazy-loaded inside SoundManager.init() so this module stays import-safe
// for SSR/SSG. Howler touches `window` at module-load time — pulling it
// in eagerly forced layout.tsx into ssr:false-via-dynamic, which exported
// empty HTML shells with no crawlable content. See IMPROVEMENTS.md 3.3.
import type { Howl as HowlType, Howler as HowlerType } from 'howler'
import { BASE_PATH } from './basePath'

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
  private sounds: Map<SfxId, HowlType> = new Map()
  private unlocked = false
  private initialized = false
  // Captured at the end of init() so play/unlock can `new Howl(...)` without
  // re-importing. Pre-init calls to play() no-op (matching the previous
  // top-level-import behavior, just without forcing ssr:false on the layout).
  private HowlCtor: typeof HowlType | null = null
  private HowlerNs: typeof HowlerType | null = null

  init(): void {
    if (this.initialized) return
    this.initialized = true

    // Fire-and-forget — eager callers (e.g. SfxProvider's mount effect) get a
    // no-op play() until the dynamic import resolves; this is identical to the
    // user experience before, because no SFX fire before first interaction.
    void import('howler').then(({ Howl, Howler }) => {
      this.HowlCtor = Howl
      this.HowlerNs = Howler

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
    })
  }

  unlock(): void {
    if (this.unlocked) return
    if (!this.HowlCtor || !this.HowlerNs) return // Howler module hasn't resolved yet
    this.unlocked = true

    try {
      const ctx = this.HowlerNs.ctx
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        // Fire-and-forget; promise rejection is non-fatal.
        void ctx.resume()
      }
    } catch {
      // Howler.ctx may not be ready yet in some environments; ignore.
    }

    try {
      const silent = new this.HowlCtor({
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
    // Howler module not yet resolved → drop this play. The user gets silence
    // for the first ~10ms of the session, which they wouldn't notice anyway.
    if (!this.HowlCtor) return
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
    if (!this.HowlerNs) return
    try {
      this.HowlerNs.volume(volume)
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
