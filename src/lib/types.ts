export type Clef = 'treble' | 'bass'

export type NoteLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export type NoteAccidental = '#' | 'b' | 'n' | null

export type NoteDuration = 'q'

export interface NotePitch {
  letter: NoteLetter
  octave: number
  accidental?: NoteAccidental
}

export interface Note extends NotePitch {
  duration?: NoteDuration
}

export interface StaffNotation {
  notes: Note[]
  clef: Clef
  keySignature?: string
  timeSignature?: string
}
