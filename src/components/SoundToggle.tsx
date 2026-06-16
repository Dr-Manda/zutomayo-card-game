'use client'

import StampBadge from './StampBadge'
import { useSfx } from './SfxProvider'

/**
 * SoundToggle — global mute switch.
 *
 * Fixed-position bottom-left so it sits clear of ChronosCorner (top-right)
 * and HandDrawer (bottom-center). Toggle is silent in BOTH directions: when
 * muting, a confirmation cue would contradict the user's intent; when
 * unmuting, SfxProvider.play() bails early on muted=true, so the cue would
 * be dropped before reaching the sound manager. State is persisted in
 * localStorage by SfxProvider.
 */
export default function SoundToggle() {
  const { muted, setMuted } = useSfx()
  return (
    <div className="fixed bottom-4 left-4 z-40">
      <StampBadge
        size="xs"
        variant="outline"
        jp={muted ? '消音' : '音'}
        en={muted ? 'MUTED' : 'SOUND'}
        onClick={() => setMuted(!muted)}
        ariaLabel={muted ? 'Unmute sound' : 'Mute sound'}
        sfx="none"
      />
    </div>
  )
}
