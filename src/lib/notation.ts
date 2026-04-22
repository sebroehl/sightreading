import type { Clef, Note, NoteAccidental, NoteLetter, NotePitch } from './types'

const LETTERS: NoteLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

function buildRange(start: NotePitch, length: number): Note[] {
  const startIndex = LETTERS.indexOf(start.letter) + start.octave * LETTERS.length

  return Array.from({ length }, (_, step) => {
    const absoluteIndex = startIndex + step
    const octave = Math.floor(absoluteIndex / LETTERS.length)
    const letter = LETTERS[absoluteIndex % LETTERS.length]

    return {
      letter,
      octave,
      accidental: null,
      duration: 'q',
    }
  })
}

export const NOTE_RANGES: Record<Clef, Note[]> = {
  treble: buildRange({ letter: 'E', octave: 4 }, 10),
  bass: buildRange({ letter: 'C', octave: 2 }, 14),
}

function accidentalToText(accidental: NoteAccidental | undefined): string {
  if (!accidental) {
    return ''
  }

  return accidental
}

export function noteToVexFlowKey(note: NotePitch): string {
  const accidental = accidentalToText(note.accidental)

  return `${note.letter.toLowerCase()}${accidental}/${note.octave}`
}

export function getNoteLabel(note: NotePitch): string {
  const accidental = accidentalToText(note.accidental)

  return `${note.letter}${accidental}${note.octave}`
}

export function notePitchEquals(a: NotePitch, b: NotePitch): boolean {
  const norm = (acc: NoteAccidental | undefined): string =>
    !acc || acc === 'n' ? '' : acc
  return (
    a.letter === b.letter &&
    a.octave === b.octave &&
    norm(a.accidental) === norm(b.accidental)
  )
}

export function randomNote(
  clef: Clef,
  range: Note[] = NOTE_RANGES[clef],
  rng: () => number = Math.random,
): Note {
  const index = Math.min(Math.floor(rng() * range.length), range.length - 1)

  return range[index]
}

export function generateNoteQueue(clef: Clef, count: number): Note[] {
  return Array.from({ length: count }, () => randomNote(clef))
}
