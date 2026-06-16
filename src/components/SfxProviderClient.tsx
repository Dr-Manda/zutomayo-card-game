'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

// Howler accesses `window` at module-load time. Importing SfxProvider statically
// into the server bundle (via layout.tsx) crashes the static export. This thin
// client wrapper defers the load until after hydration so the howler module
// never reaches the server.
const SfxProvider = dynamic(
  () => import('./SfxProvider').then((mod) => mod.SfxProvider),
  { ssr: false }
)

// Same dynamic pattern for the toggle — it consumes useSfx() so it has to live
// inside the SfxProvider tree, which is itself ssr:false.
const SoundToggle = dynamic(() => import('./SoundToggle'), { ssr: false })

export function SfxProviderClient({ children }: { children: ReactNode }) {
  return (
    <SfxProvider>
      {children}
      <SoundToggle />
    </SfxProvider>
  )
}
