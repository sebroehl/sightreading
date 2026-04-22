import { useCallback, useEffect, useMemo, useState } from 'react'

import { useMicrophoneInput } from '../hooks/useMicrophoneInput'
import { CORRECT_COLOR, type Theme } from '../hooks/useVexFlow'
import { generateNoteQueue, getNoteLabel, notePitchEquals, randomNote } from '../lib/notation'
import type { Clef, NotePitch } from '../lib/types'
import { PianoKeyboard } from './PianoKeyboard'
import { Staff } from './Staff'
import { ThemeToggle } from './ThemeToggle'

const NOTE_COUNT = 8

const ICON_SIZE = 20
const PAD = 0.3

interface GlyphDef {
  char: string
  sw: [number, number]
  ne: [number, number]
}

const GLYPHS = {
  treble: { char: '\uE050', sw: [0, -2.632], ne: [2.684, 4.392] },
  bass: { char: '\uE062', sw: [-0.02, -2.54], ne: [2.736, 1.048] },
  quarter: { char: '\uE1D5', sw: [0, -0.564], ne: [1.328, 3.5] },
} satisfies Record<string, GlyphDef>

function BravuraIcon({ glyph, opacity = 1 }: { glyph: GlyphDef; opacity?: number }) {
  const x0 = glyph.sw[0] - PAD
  const y0 = -glyph.ne[1] - PAD
  const w = glyph.ne[0] - glyph.sw[0] + PAD * 2
  const h = glyph.ne[1] - glyph.sw[1] + PAD * 2

  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox={`${x0} ${y0} ${w} ${h}`}
      fill="currentColor"
      style={{ opacity }}
    >
      <text
        x="0"
        y="0"
        fontFamily="Bravura, Academico, serif"
        fontSize="4"
      >
        {glyph.char}
      </text>
    </svg>
  )
}

function MicrophoneIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        fill={active ? 'currentColor' : 'none'}
      />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  )
}

export function NoteDisplay() {
  const [clef, setClef] = useState<Clef>('treble')
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

  const {
    currentNote: detectedNote,
    debug,
    error: microphoneError,
    isListening,
    isSupported: isMicrophoneSupported,
    startListening,
    stopListening,
  } = useMicrophoneInput({
    onNoteDetected: handleNoteClick,
    onNoteReleased: handleNoteRelease,
  })

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

  const toggleMicrophone = useCallback(() => {
    if (isListening) {
      stopListening()
      return
    }

    void startListening()
  }, [isListening, startListening, stopListening])

  const toggleClef = useCallback(() => {
    setClef((currentClef) => {
      const nextClef = currentClef === 'treble' ? 'bass' : 'treble'
      setNotes(generateNoteQueue(nextClef, NOTE_COUNT))
      setNoteColor(undefined)
      setGhostNote(null)
      setSliding(false)
      return nextClef
    })
  }, [])

  const activeNoteLabel = getNoteLabel(activeNote)
  const detectedNoteLabel = detectedNote ? getNoteLabel(detectedNote) : debug.detection.lastDetectedNote
  const matchResult = !detectedNoteLabel
    ? 'waiting for note'
    : notePitchEquals(detectedNote ?? activeNote, activeNote) && detectedNote
      ? 'correct note'
      : 'wrong note'

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg)] transition-colors duration-500">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-6 px-8">
        <div className="flex items-center gap-1">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            type="button"
            onClick={toggleClef}
            aria-label={`Switch to ${clef === 'treble' ? 'bass' : 'treble'} clef`}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 text-[var(--color-icon)] hover:text-[var(--color-icon-hover)] cursor-pointer overflow-hidden"
          >
            <BravuraIcon glyph={clef === 'treble' ? GLYPHS.treble : GLYPHS.bass} />
          </button>
          <button
            type="button"
            onClick={toggleLabels}
            aria-label={showLabels ? 'Hide note names' : 'Show note names'}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 text-[var(--color-icon)] hover:text-[var(--color-icon-hover)] cursor-pointer overflow-hidden"
          >
            <BravuraIcon glyph={GLYPHS.quarter} opacity={showLabels ? 1 : 0.5} />
          </button>
          {isMicrophoneSupported && (
            <button
              type="button"
              onClick={toggleMicrophone}
              aria-label={isListening ? 'Stop microphone input' : 'Start microphone input'}
              aria-pressed={isListening}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 text-[var(--color-icon)] hover:text-[var(--color-icon-hover)] cursor-pointer overflow-hidden"
            >
              <MicrophoneIcon active={isListening} />
              {isListening && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-icon-hover)]" />
              )}
            </button>
          )}
        </div>
        {(microphoneError || isListening) && (
          <div
            className="min-h-5 text-sm text-[var(--color-text-muted)]"
            aria-live="polite"
          >
            {microphoneError
              ? microphoneError
              : detectedNote
                ? `Listening: ${detectedNote.letter}${detectedNote.accidental ?? ''}${detectedNote.octave}`
                : 'Listening...'}
          </div>
        )}
        {isMicrophoneSupported && (
          <div className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-text-muted)]">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Microphone diagnostics</h2>
            <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
              <div>Secure: {debug.environment.isSecureContext ? 'yes' : 'no'}</div>
              <div>API available: {debug.environment.hasGetUserMedia ? 'yes' : 'no'}</div>
              <div>AudioContext: {debug.audioContext.state}</div>
              <div>Resume result: {debug.audioContext.resumeResult ?? 'pending'}</div>
              <div>Stream: {debug.stream.stage}</div>
              <div>Track: {debug.stream.trackReadyState ?? 'n/a'}</div>
              <div>Track muted: {debug.stream.trackMuted === null ? 'n/a' : debug.stream.trackMuted ? 'yes' : 'no'}</div>
              <div>Sample rate: {debug.audioContext.sampleRate ?? 'n/a'}</div>
              <div>RMS: {debug.metrics.rms.toFixed(3)}</div>
              <div>Frequency: {debug.metrics.frequency.toFixed(2)} Hz</div>
              <div>Clarity: {debug.metrics.clarity.toFixed(2)}</div>
              <div>Frame count: {debug.metrics.frameCount}</div>
              <div>Has pitch: {debug.metrics.hasPitch ? 'yes' : 'no'}</div>
              <div>Rejected by: {debug.metrics.rejectedBy ?? 'n/a'}</div>
              <div>Target note: {activeNoteLabel}</div>
              <div>Detected note: {detectedNoteLabel ?? 'n/a'}</div>
              <div>Match result: {matchResult}</div>
              <div>Error: {microphoneError ?? 'none'}</div>
            </div>
            <div className="mt-3">
              <div className="font-medium text-[var(--color-text)]">Event log</div>
              <ul className="mt-1 space-y-1">
                {debug.events.length === 0 ? (
                  <li>waiting for microphone activity</li>
                ) : (
                  debug.events.map((event) => <li key={event}>{event}</li>)
                )}
              </ul>
            </div>
          </div>
        )}
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
        <div className={`w-full transition-opacity duration-300 ${isListening ? 'opacity-60' : ''}`}>
          <PianoKeyboard
            startOctave={clef === 'treble' ? 4 : 2}
            octaveCount={2}
            showLabels={showLabels}
            onNoteClick={handleNoteClick}
            onNoteRelease={handleNoteRelease}
          />
        </div>
      </div>
    </div>
  )
}
