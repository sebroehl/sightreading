import { useCallback, useEffect, useMemo, useState } from 'react'

import { CORRECT_COLOR, type Theme } from '../hooks/useVexFlow'
import { generateNoteQueue, notePitchEquals, randomNote } from '../lib/notation'
import type { Clef, NotePitch } from '../lib/types'
import { PianoKeyboard } from './PianoKeyboard'
import { Staff } from './Staff'
import { ThemeToggle } from './ThemeToggle'

const NOTE_COUNT = 8

export function NoteDisplay() {
  const [clef] = useState<Clef>('treble')
  const [notes, setNotes] = useState(() => generateNoteQueue('treble', NOTE_COUNT))
  const [theme, setTheme] = useState<Theme>('dark')
  const [showLabels, setShowLabels] = useState(false)
  const [noteColor, setNoteColor] = useState<string | undefined>()
  const [ghostNote, setGhostNote] = useState<NotePitch | null>(null)
  const [sliding, setSliding] = useState(false)

  const activeNote = notes[0]

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const notation = useMemo(() => ({ notes, clef }), [notes, clef])

  const handleNoteClick = useCallback(
    (played: NotePitch) => {
      if (sliding) return

      if (notePitchEquals(played, activeNote)) {
        setNoteColor(CORRECT_COLOR)
        setGhostNote(null)
        setSliding(true)
      } else {
        setGhostNote(played)
      }
    },
    [activeNote, sliding],
  )

  const handleNoteRelease = useCallback(() => {
    if (!sliding) {
      setNoteColor(undefined)
      setGhostNote(null)
    }
  }, [sliding])

  const handleSlideComplete = useCallback(() => {
    setSliding(false)
    setNoteColor(undefined)
    setGhostNote(null)
    setNotes((prev) => [...prev.slice(1), randomNote(clef)])
  }, [clef])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const toggleLabels = useCallback(() => {
    setShowLabels((s) => !s)
  }, [])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg)] transition-colors duration-500">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-6 px-8">
        <div className="flex items-center gap-1">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            type="button"
            onClick={toggleLabels}
            aria-label={showLabels ? 'Hide note names' : 'Show note names'}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 text-[var(--color-icon)] hover:text-[var(--color-icon-hover)] cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: showLabels ? 1 : 0.5 }}
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </button>
        </div>
        <div className="w-full">
          <Staff
            notation={notation}
            theme={theme}
            noteColor={noteColor}
            ghostNote={ghostNote}
            sliding={sliding}
            onSlideComplete={handleSlideComplete}
          />
        </div>
        <div className="w-full">
          <PianoKeyboard showLabels={showLabels} onNoteClick={handleNoteClick} onNoteRelease={handleNoteRelease} />
        </div>
      </div>
    </div>
  )
}
