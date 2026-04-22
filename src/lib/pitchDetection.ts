import type { NotePitch } from './types'

const MIDI_NOTE_NAMES = [
  { letter: 'C', accidental: null },
  { letter: 'C', accidental: '#' },
  { letter: 'D', accidental: null },
  { letter: 'D', accidental: '#' },
  { letter: 'E', accidental: null },
  { letter: 'F', accidental: null },
  { letter: 'F', accidental: '#' },
  { letter: 'G', accidental: null },
  { letter: 'G', accidental: '#' },
  { letter: 'A', accidental: null },
  { letter: 'A', accidental: '#' },
  { letter: 'B', accidental: null },
] as const satisfies ReadonlyArray<Pick<NotePitch, 'letter' | 'accidental'>>

export function frequencyToMidi(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440))
}

export function midiToNotePitch(midi: number): NotePitch {
  const normalizedMidi = Math.round(midi)
  const note = MIDI_NOTE_NAMES[((normalizedMidi % 12) + 12) % 12]

  return {
    letter: note.letter,
    octave: Math.floor(normalizedMidi / 12) - 1,
    accidental: note.accidental,
  }
}

export function frequencyToNotePitch(frequency: number): NotePitch {
  return midiToNotePitch(frequencyToMidi(frequency))
}
