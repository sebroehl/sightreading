import { useMemo, useState } from 'react'

import { useVexFlow, type Theme } from '../hooks/useVexFlow'
import type { NotePitch, StaffNotation } from '../lib/types'

interface StaffProps {
  notation: StaffNotation
  theme?: Theme
  noteColor?: string
  ghostNote?: NotePitch | null
  sliding?: boolean
  onSlideComplete?: () => void
}

export function Staff({ notation, theme = 'dark', noteColor, ghostNote, sliding, onSlideComplete }: StaffProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  const stableNotation = useMemo(() => notation, [notation])
  useVexFlow(container, stableNotation, theme, noteColor, ghostNote, sliding, onSlideComplete)

  return (
    <div
      ref={setContainer}
      className="vexflow-container w-full"
      aria-label="Music notation"
    />
  )
}
