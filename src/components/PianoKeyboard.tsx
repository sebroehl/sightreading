import { useCallback, useState } from 'react'

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
  onNoteClick?: (note: NotePitch) => void
}

export function PianoKeyboard({
  startOctave = 4,
  octaveCount = 2,
  onNoteClick,
}: PianoKeyboardProps) {
  const { playNote } = useAudio()
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const keys = buildKeys(startOctave, octaveCount)
  const whiteKeys = keys.filter((k) => !k.isBlack)
  const blackKeys = keys.filter((k) => k.isBlack)

  const whiteKeyCount = whiteKeys.length

  const handlePress = useCallback(
    (key: PianoKey) => {
      setActiveKey(key.label)
      playNote(key.note)
      onNoteClick?.(key.note)
    },
    [playNote, onNoteClick],
  )

  const handleRelease = useCallback(() => {
    setActiveKey(null)
  }, [])

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
        />
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
        />
      ))}
    </div>
  )
}
