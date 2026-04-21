import { useCallback } from 'react'

import { ensureAudioResumed, playNote } from '../lib/audio'
import type { NotePitch } from '../lib/types'

export function useAudio() {
  const play = useCallback((note: NotePitch) => {
    ensureAudioResumed()
    playNote(note)
  }, [])

  return { playNote: play }
}
