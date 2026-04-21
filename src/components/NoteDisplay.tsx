import { useCallback, useEffect, useState } from 'react'

import type { Theme } from '../hooks/useVexFlow'
import { randomNote } from '../lib/notation'
import type { Clef, Note } from '../lib/types'
import { PianoKeyboard } from './PianoKeyboard'
import { Staff } from './Staff'
import { ThemeToggle } from './ThemeToggle'

function nextNote(clef: Clef): Note {
  return randomNote(clef)
}

export function NoteDisplay() {
  const [clef] = useState<Clef>('treble')
  const [note] = useState<Note>(() => nextNote('treble'))
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg)] transition-colors duration-500">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-6 px-8">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <div className="w-full">
          <Staff notation={{ notes: [note], clef }} theme={theme} />
        </div>
        <div className="w-full">
          <PianoKeyboard />
        </div>
      </div>
    </div>
  )
}
