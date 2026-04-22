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
const TOOLBAR_BUTTON_CLASS =
  'relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-icon)] shadow-sm transition-all duration-200 hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-icon-hover)] cursor-pointer overflow-hidden'

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

function DiagnosticsIcon({ active }: { active: boolean }) {
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
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M8 20h8" />
      <path d="M10 16v4" />
      <path d="M14 16v4" />
      <path d="M8 9h.01" />
      <path d="M12 9h4" opacity={active ? 1 : 0.7} />
      <path d="M12 12h2" opacity={active ? 1 : 0.5} />
    </svg>
  )
}

export function NoteDisplay() {
  const [clef, setClef] = useState<Clef>('treble')
  const [notes, setNotes] = useState(() => generateNoteQueue('treble', NOTE_COUNT))
  const [theme, setTheme] = useState<Theme>('dark')
  const [showLabels, setShowLabels] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(true)
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

  const toggleDiagnostics = useCallback(() => {
    setShowDiagnostics((current) => !current)
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
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            type="button"
            onClick={toggleClef}
            aria-label={`Switch to ${clef === 'treble' ? 'bass' : 'treble'} clef`}
            className={`${TOOLBAR_BUTTON_CLASS} ${clef === 'bass' ? 'bg-[var(--color-surface-strong)] text-[var(--color-icon-hover)]' : ''}`}
          >
            <BravuraIcon glyph={clef === 'treble' ? GLYPHS.treble : GLYPHS.bass} />
          </button>
          <button
            type="button"
            onClick={toggleLabels}
            aria-label={showLabels ? 'Hide note names' : 'Show note names'}
            className={`${TOOLBAR_BUTTON_CLASS} ${showLabels ? 'bg-[var(--color-surface-strong)] text-[var(--color-icon-hover)]' : ''}`}
          >
            <BravuraIcon glyph={GLYPHS.quarter} opacity={showLabels ? 1 : 0.5} />
          </button>
          {isMicrophoneSupported && (
            <button
              type="button"
              onClick={toggleMicrophone}
              aria-label={isListening ? 'Stop microphone input' : 'Start microphone input'}
              aria-pressed={isListening}
              className={`${TOOLBAR_BUTTON_CLASS} ${isListening ? 'bg-[var(--color-surface-strong)] text-[var(--color-icon-hover)]' : ''}`}
            >
              <MicrophoneIcon active={isListening} />
              {isListening && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-icon-hover)]" />
              )}
            </button>
          )}
          {isMicrophoneSupported && (
            <button
              type="button"
              onClick={toggleDiagnostics}
              aria-label={showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
              aria-pressed={showDiagnostics}
              className={`${TOOLBAR_BUTTON_CLASS} ${showDiagnostics ? 'bg-[var(--color-surface-strong)] text-[var(--color-icon-hover)]' : ''}`}
            >
              <DiagnosticsIcon active={showDiagnostics} />
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
        {isMicrophoneSupported && showDiagnostics && (
          <section
            className="fixed z-30 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] text-[var(--color-text-muted)] shadow-lg backdrop-blur-sm"
            style={{
              top: 'max(1rem, calc(env(safe-area-inset-top) + 1rem))',
              right: 'max(1rem, calc(env(safe-area-inset-right) + 1rem))',
              padding: '28px',
            }}
          >
            <div style={{ paddingBottom: '8px' }}>
              <h2 className="text-xs font-semibold text-[var(--color-text)]">
                Microphone diagnostics
              </h2>
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
                Use this while testing on iPad to see where the mic pipeline is failing.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--color-bg)] p-5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text)]">
                  Environment
                </div>
                <div className="space-y-1">
                  <div>Secure: {debug.environment.isSecureContext ? 'yes' : 'no'}</div>
                  <div>API available: {debug.environment.hasGetUserMedia ? 'yes' : 'no'}</div>
                  <div>AudioContext: {debug.audioContext.state}</div>
                  <div>Resume result: {debug.audioContext.resumeResult ?? 'pending'}</div>
                  <div>Sample rate: {debug.audioContext.sampleRate ?? 'n/a'}</div>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--color-bg)] p-5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text)]">
                  Stream
                </div>
                <div className="space-y-1">
                  <div>Stream: {debug.stream.stage}</div>
                  <div>Track: {debug.stream.trackReadyState ?? 'n/a'}</div>
                  <div>
                    Track muted:{' '}
                    {debug.stream.trackMuted === null ? 'n/a' : debug.stream.trackMuted ? 'yes' : 'no'}
                  </div>
                  <div>Error: {microphoneError ?? 'none'}</div>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--color-bg)] p-5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text)]">
                  Signal
                </div>
                <div className="space-y-1">
                  <div>RMS: {debug.metrics.rms.toFixed(3)}</div>
                  <div>Frequency: {debug.metrics.frequency.toFixed(2)} Hz</div>
                  <div>Clarity: {debug.metrics.clarity.toFixed(2)}</div>
                  <div>Frame count: {debug.metrics.frameCount}</div>
                  <div>Has pitch: {debug.metrics.hasPitch ? 'yes' : 'no'}</div>
                  <div>Rejected by: {debug.metrics.rejectedBy ?? 'n/a'}</div>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--color-bg)] p-5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text)]">
                  Note matching
                </div>
                <div className="space-y-1">
                  <div>Target note: {activeNoteLabel}</div>
                  <div>Detected note: {detectedNoteLabel ?? 'n/a'}</div>
                  <div>Match result: {matchResult}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-[var(--color-bg)] p-5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text)]">
                Event log
              </div>
              <ul className="space-y-1">
                {debug.events.length === 0 ? (
                  <li>waiting for microphone activity</li>
                ) : (
                  debug.events.map((event) => <li key={event}>{event}</li>)
                )}
              </ul>
            </div>
          </section>
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
