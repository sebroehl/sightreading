import { useCallback, useRef, useState } from 'react'

import { useAudio } from '../hooks/useAudio'
import type { NoteAccidental, NoteLetter, NotePitch } from '../lib/types'

interface PianoKey {
  note: NotePitch
  isBlack: boolean
  label: string
}

const WHITE_NOTES: NoteLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

const BLACK_KEY_INDICES = new Set([0, 1, 3, 4, 5])

function buildKeys(startOctave: number, octaveCount: number): PianoKey[] {
  const keys: PianoKey[] = []

  for (let oct = startOctave; oct < startOctave + octaveCount; oct++) {
    for (let i = 0; i < WHITE_NOTES.length; i++) {
      const letter = WHITE_NOTES[i]
      keys.push({
        note: { letter, octave: oct },
        isBlack: false,
        label: `${letter}${oct}`,
      })

      if (BLACK_KEY_INDICES.has(i)) {
        keys.push({
          note: { letter, octave: oct, accidental: '#' as NoteAccidental },
          isBlack: true,
          label: `${letter}#${oct}`,
        })
      }
    }
  }

  return keys
}

interface PianoKeyboardProps {
  startOctave?: number
  octaveCount?: number
  showLabels?: boolean
  onNoteClick?: (note: NotePitch) => void
  onNoteRelease?: () => void
}

export function PianoKeyboard({
  startOctave = 4,
  octaveCount = 2,
  showLabels = false,
  onNoteClick,
  onNoteRelease,
}: PianoKeyboardProps) {
  const { playNote } = useAudio()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const isPressed = useRef(false)

  const keys = buildKeys(startOctave, octaveCount)
  const whiteKeys = keys.filter((k) => !k.isBlack)
  const blackKeys = keys.filter((k) => k.isBlack)

  const whiteKeyCount = whiteKeys.length

  const handlePress = useCallback(
    (key: PianoKey) => {
      isPressed.current = true
      setActiveKey(key.label)
      playNote(key.note)
      onNoteClick?.(key.note)
    },
    [playNote, onNoteClick],
  )

  const handleRelease = useCallback(() => {
    if (!isPressed.current) return
    isPressed.current = false
    setActiveKey(null)
    onNoteRelease?.()
  }, [onNoteRelease])

  const getBlackKeyPosition = (key: PianoKey): number => {
    const oct = key.note.octave
    const octaveOffset = (oct - startOctave) * 7
    const whiteIndex = WHITE_NOTES.indexOf(key.note.letter)

    // Place each black key at the boundary between its natural note and the next white key
    const boundaryIndex = octaveOffset + whiteIndex + 1

    return (boundaryIndex / whiteKeyCount) * 100
  }

  return (
    <div
      className="piano-keyboard"
      role="group"
      aria-label="Piano keyboard"
    >
      {whiteKeys.map((key) => (
        <button
          key={key.label}
          className={`piano-key piano-key--white ${activeKey === key.label ? 'piano-key--active' : ''}`}
          aria-label={key.label}
          onPointerDown={() => handlePress(key)}
          onPointerUp={handleRelease}
          onPointerLeave={handleRelease}
        >
          {showLabels && (
            <span className="piano-key__label piano-key__label--white">
              {key.note.letter}{key.note.accidental === '#' && '#'}<span className="piano-key__octave">{key.note.octave}</span>
            </span>
          )}
        </button>
      ))}

      {blackKeys.map((key) => (
        <button
          key={key.label}
          className={`piano-key piano-key--black ${activeKey === key.label ? 'piano-key--active' : ''}`}
          aria-label={key.label.replace('#', ' sharp ')}
          style={{ left: `${getBlackKeyPosition(key)}%` }}
          onPointerDown={() => handlePress(key)}
          onPointerUp={handleRelease}
          onPointerLeave={handleRelease}
        >
          {showLabels && (
            <span className="piano-key__label piano-key__label--black">
              {key.note.letter}{key.note.accidental === '#' && '#'}<span className="piano-key__octave">{key.note.octave}</span>
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
