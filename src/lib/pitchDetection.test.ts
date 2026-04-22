import { describe, expect, it } from 'vitest'

import { frequencyToMidi, frequencyToNotePitch, midiToNotePitch } from './pitchDetection'

describe('pitchDetection helpers', () => {
  it('converts concert A to midi 69', () => {
    expect(frequencyToMidi(440)).toBe(69)
  })

  it('converts middle C frequency to C4', () => {
    expect(frequencyToNotePitch(261.6255653005986)).toEqual({
      letter: 'C',
      octave: 4,
      accidental: null,
    })
  })

  it('converts sharp midi notes back to note pitches', () => {
    expect(midiToNotePitch(61)).toEqual({
      letter: 'C',
      octave: 4,
      accidental: '#',
    })
  })
})
