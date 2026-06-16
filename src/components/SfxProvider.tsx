'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getSoundManager, type SfxId } from '@/lib/sound'

interface SfxContextValue {
  play: (id: SfxId) => void
  unlocked: boolean
  setMuted: (muted: boolean) => void
  muted: boolean
}

const SfxContext = createContext<SfxContextValue | null>(null)

const MUTED_STORAGE_KEY = 'zcg-muted'

export function SfxProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  // Initial state is `false` (SSG-safe — localStorage doesn't exist server-side)
  // and the persisted value is hydrated on mount via the effect below.
  const [muted, setMuted] = useState(false)

  // Hydrate persisted mute state from localStorage on mount. We can't read it
  // in useState's lazy initializer because the layout still renders during
  // dynamic-import SSR-skip and `window` is undefined there.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(MUTED_STORAGE_KEY) === '1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMuted(true)
      }
    } catch {
      // localStorage can throw in private mode / disabled storage. Default to false.
    }
  }, [])

  useEffect(() => {
    const mgr = getSoundManager()
    mgr.init()

    const unlock = () => {
      mgr.unlock()
      setUnlocked(true)
    }

    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })

    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    getSoundManager().setMasterVolume(muted ? 0 : 0.6)
    try {
      window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0')
    } catch {
      // Storage unavailable — fail soft; setting persists for the session only.
    }
  }, [muted])

  const play = useCallback(
    (id: SfxId) => {
      if (muted) return
      getSoundManager().play(id)
    },
    [muted],
  )

  return (
    <SfxContext.Provider value={{ play, unlocked, setMuted, muted }}>
      {children}
    </SfxContext.Provider>
  )
}

export function useSfx(): SfxContextValue {
  const ctx = useContext(SfxContext)
  if (!ctx) {
    return {
      play: () => {},
      unlocked: false,
      setMuted: () => {},
      muted: false,
    }
  }
  return ctx
}
