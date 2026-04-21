import { useMemo, useState } from 'react'

import { useVexFlow, type Theme } from '../hooks/useVexFlow'
import type { StaffNotation } from '../lib/types'

interface StaffProps {
  notation: StaffNotation
  theme?: Theme
}

export function Staff({ notation, theme = 'dark' }: StaffProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  const stableNotation = useMemo(() => notation, [notation])
  useVexFlow(container, stableNotation, theme)

  return (
    <div
      ref={setContainer}
      className="vexflow-container w-full"
      aria-label="Music notation"
    />
  )
}
