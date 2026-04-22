import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../hooks/useVexFlow', () => ({
  CORRECT_COLOR: '#22c55e',
  useVexFlow: vi.fn(),
}))

const { micHookState } = vi.hoisted(() => ({
  micHookState: {
    currentNote: null as { letter: string; octave: number; accidental: null } | null,
    error: null as string | null,
    isListening: false,
    isSupported: true,
    debug: {
      environment: {
        hasGetUserMedia: true,
        isSecureContext: true,
        origin: 'https://example.com',
        protocol: 'https:',
      },
      audioContext: {
        state: 'running',
        sampleRate: 48000,
        resumeAttempted: true,
        resumeResult: 'running',
      },
      stream: {
        stage: 'idle' as string,
        errorName: null as string | null,
        errorMessage: null as string | null,
        trackEnabled: null as boolean | null,
        trackMuted: null as boolean | null,
        trackReadyState: null as string | null,
      },
      metrics: {
        frameCount: 0,
        rms: 0,
        frequency: 0,
        clarity: 0,
        hasPitch: false,
        rejectedBy: null as string | null,
      },
      detection: {
        activeNote: null as string | null,
        candidateNote: null as string | null,
        lastDetectedNote: null as string | null,
        lastReleaseReason: null as string | null,
      },
      events: [] as string[],
    },
    onNoteDetected: undefined as ((note: { letter: string; octave: number; accidental: null }) => void) | undefined,
    onNoteReleased: undefined as (() => void) | undefined,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  },
}))

vi.mock('../hooks/useMicrophoneInput', () => ({
  useMicrophoneInput: ({
    onNoteDetected,
    onNoteReleased,
  }: {
    onNoteDetected?: (note: { letter: string; octave: number; accidental: null }) => void
    onNoteReleased?: () => void
  }) => {
    micHookState.onNoteDetected = onNoteDetected
    micHookState.onNoteReleased = onNoteReleased

    return {
      currentNote: micHookState.currentNote,
      error: micHookState.error,
      isListening: micHookState.isListening,
      isSupported: micHookState.isSupported,
      debug: micHookState.debug,
      startListening: micHookState.startListening,
      stopListening: micHookState.stopListening,
    }
  },
}))

vi.mock('./ThemeToggle', () => ({
  ThemeToggle: ({ onToggle }: { onToggle: () => void }) => (
    <button type="button" onClick={onToggle}>
      Toggle theme
    </button>
  ),
}))

vi.mock('./PianoKeyboard', () => ({
  PianoKeyboard: ({
    startOctave = 4,
    onNoteClick,
    onNoteRelease,
  }: {
    startOctave?: number
    onNoteClick?: (note: { letter: 'E'; octave: 4; accidental: null }) => void
    onNoteRelease?: () => void
  }) => (
    <div aria-label="Piano keyboard" data-start-octave={startOctave}>
      <button type="button" aria-label={`C${startOctave}`}>
        C{startOctave}
      </button>
      <button
        type="button"
        aria-label="Play E4"
        onClick={() => onNoteClick?.({ letter: 'E', octave: 4, accidental: null })}
      >
        Play E4
      </button>
      <button type="button" aria-label="Release key" onClick={() => onNoteRelease?.()}>
        Release key
      </button>
    </div>
  ),
}))

vi.mock('./Staff', () => ({
  Staff: ({
    ghostNote,
    noteColor,
  }: {
    ghostNote?: { letter: string; octave: number; accidental: string | null } | null
    noteColor?: string
  }) => (
    <div
      aria-label="Music notation"
      data-ghost-note={ghostNote ? `${ghostNote.letter}${ghostNote.accidental ?? ''}${ghostNote.octave}` : ''}
      data-note-color={noteColor ?? ''}
    />
  ),
}))

import { NoteDisplay } from './NoteDisplay'

describe('NoteDisplay', () => {
  beforeEach(() => {
    micHookState.currentNote = null
    micHookState.error = null
    micHookState.isListening = false
    micHookState.isSupported = true
    micHookState.debug.stream.stage = 'idle'
    micHookState.debug.metrics.frameCount = 0
    micHookState.debug.metrics.rms = 0
    micHookState.debug.metrics.frequency = 0
    micHookState.debug.metrics.clarity = 0
    micHookState.debug.metrics.hasPitch = false
    micHookState.debug.metrics.rejectedBy = null
    micHookState.debug.detection.activeNote = null
    micHookState.debug.detection.candidateNote = null
    micHookState.debug.detection.lastDetectedNote = null
    micHookState.debug.detection.lastReleaseReason = null
    micHookState.debug.events = []
    micHookState.onNoteDetected = undefined
    micHookState.onNoteReleased = undefined
    micHookState.startListening.mockReset()
    micHookState.stopListening.mockReset()
  })

  it('switches the keyboard range when the clef is toggled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(<NoteDisplay />)

    expect(screen.getByRole('button', { name: 'Switch to bass clef' })).toBeInTheDocument()
    expect(screen.getByLabelText('C4')).toBeInTheDocument()
    expect(screen.queryByLabelText('C2')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to bass clef' }))

    expect(screen.getByRole('button', { name: 'Switch to treble clef' })).toBeInTheDocument()
    expect(screen.getByLabelText('C2')).toBeInTheDocument()
    expect(screen.queryByLabelText('C4')).not.toBeInTheDocument()
  })

  it('toggles microphone listening from the toolbar', () => {
    render(<NoteDisplay />)

    fireEvent.click(screen.getByRole('button', { name: 'Start microphone input' }))

    expect(micHookState.startListening).toHaveBeenCalledTimes(1)

    micHookState.isListening = true
    render(<NoteDisplay />)

    fireEvent.click(screen.getByRole('button', { name: 'Stop microphone input' }))

    expect(micHookState.stopListening).toHaveBeenCalledTimes(1)
  })

  it('routes detected microphone notes through the existing note handlers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(<NoteDisplay />)

    act(() => {
      micHookState.onNoteDetected?.({ letter: 'C', octave: 4, accidental: null })
    })

    expect(screen.getByLabelText('Music notation')).toHaveAttribute('data-ghost-note', 'C4')

    act(() => {
      micHookState.onNoteReleased?.()
    })

    expect(screen.getByLabelText('Music notation')).toHaveAttribute('data-ghost-note', '')

    act(() => {
      micHookState.onNoteDetected?.({ letter: 'E', octave: 4, accidental: null })
    })

    expect(screen.getByLabelText('Music notation')).toHaveAttribute('data-note-color', '#22c55e')
  })

  it('renders microphone diagnostics on screen', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    micHookState.isListening = true
    micHookState.currentNote = { letter: 'F', octave: 4, accidental: null }
    micHookState.debug.stream.stage = 'listening'
    micHookState.debug.stream.trackReadyState = 'live'
    micHookState.debug.stream.trackMuted = false
    micHookState.debug.metrics.frameCount = 42
    micHookState.debug.metrics.rms = 0.031
    micHookState.debug.metrics.frequency = 349.23
    micHookState.debug.metrics.clarity = 0.88
    micHookState.debug.metrics.hasPitch = false
    micHookState.debug.metrics.rejectedBy = 'clarity'
    micHookState.debug.detection.lastDetectedNote = 'F4'
    micHookState.debug.events = ['stream acquired', 'pitch rejected (clarity)']

    render(<NoteDisplay />)

    expect(screen.getByText('Microphone diagnostics')).toBeInTheDocument()
    expect(screen.getByText(/Secure: yes/i)).toBeInTheDocument()
    expect(screen.getByText(/AudioContext: running/i)).toBeInTheDocument()
    expect(screen.getByText(/Stream: listening/i)).toBeInTheDocument()
    expect(screen.getByText(/Track: live/i)).toBeInTheDocument()
    expect(screen.getByText(/RMS: 0.031/i)).toBeInTheDocument()
    expect(screen.getByText(/Frequency: 349.23 Hz/i)).toBeInTheDocument()
    expect(screen.getByText(/Rejected by: clarity/i)).toBeInTheDocument()
    expect(screen.getByText(/Target note: E4/i)).toBeInTheDocument()
    expect(screen.getByText(/Detected note: F4/i)).toBeInTheDocument()
    expect(screen.getByText(/Match result: wrong note/i)).toBeInTheDocument()
    expect(screen.getByText('pitch rejected (clarity)')).toBeInTheDocument()
  })

  it('can hide and show the diagnostics panel', () => {
    render(<NoteDisplay />)

    expect(screen.getByText('Microphone diagnostics')).toBeInTheDocument()
    expect(screen.getByText(/Secure: yes/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide diagnostics' }))

    expect(screen.getByRole('button', { name: 'Show diagnostics' })).toBeInTheDocument()
    expect(screen.queryByText(/Secure: yes/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show diagnostics' }))

    expect(screen.getByText(/Secure: yes/i)).toBeInTheDocument()
  })
})
