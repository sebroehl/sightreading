import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../hooks/useVexFlow', () => ({
  CORRECT_COLOR: '#22c55e',
  useVexFlow: vi.fn(),
}))

const { micHookState } = vi.hoisted(() => ({
  micHookState: {
    currentNote: null,
    error: null,
    isListening: false,
    isSupported: true,
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
})
