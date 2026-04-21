import { describe, expect, it } from 'vitest'

import {
  NOTE_RANGES,
  getNoteLabel,
  noteToVexFlowKey,
  randomNote,
} from './notation'

describe('notation helpers', () => {
  it('formats a note for VexFlow', () => {
    expect(
      noteToVexFlowKey({
        letter: 'C',
        octave: 4,
        accidental: '#',
      }),
    ).toBe('c#/4')
  })

  it('creates a readable label for a note', () => {
    expect(
      getNoteLabel({
        letter: 'B',
        octave: 3,
        accidental: 'b',
      }),
    ).toBe('Bb3')
  })

  it('picks the first note in a range when rng returns 0', () => {
    expect(randomNote('treble', undefined, () => 0)).toEqual(NOTE_RANGES.treble[0])
  })

  it('picks the last note in a range when rng is near 1', () => {
    expect(randomNote('bass', undefined, () => 0.999999)).toEqual(
      NOTE_RANGES.bass[NOTE_RANGES.bass.length - 1],
    )
  })
})
