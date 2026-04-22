import type { NotePitch } from './types'

const SEMITONE_MAP: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

export function notePitchToMidi(note: NotePitch): number {
  const base = SEMITONE_MAP[note.letter]
  let offset = 0
  if (note.accidental === '#') offset = 1
  else if (note.accidental === 'b') offset = -1

  return (note.octave + 1) * 12 + base + offset
}

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
  }
  return ctx
}

export async function ensureAudioResumed(): Promise<AudioContextState> {
  const ac = getAudioContext()
  if (ac.state === 'suspended') {
    await ac.resume()
  }
  return ac.state
}

const HARMONICS = [
  { ratio: 1, gain: 1.0 },
  { ratio: 2, gain: 0.4 },
  { ratio: 3, gain: 0.15 },
  { ratio: 4, gain: 0.06 },
  { ratio: 5, gain: 0.03 },
  { ratio: 6, gain: 0.015 },
]

const BASS_HARMONICS = [
  { ratio: 1, gain: 0.8 },
  { ratio: 2, gain: 1.0 },
  { ratio: 3, gain: 0.7 },
  { ratio: 4, gain: 0.4 },
  { ratio: 5, gain: 0.25 },
  { ratio: 6, gain: 0.15 },
  { ratio: 7, gain: 0.1 },
  { ratio: 8, gain: 0.06 },
  { ratio: 9, gain: 0.04 },
  { ratio: 10, gain: 0.025 },
]

const DETUNE_CENTS = [-3, 3]
const BASS_DETUNE_CENTS = [-5, 5]

function createHammerNoise(
  ac: AudioContext,
  dest: AudioNode,
  now: number,
  midi: number,
): void {
  const isBass = midi < 48
  const noiseDuration = isBass ? 0.06 : 0.04
  const bufferLen = Math.floor(ac.sampleRate * noiseDuration)
  const buffer = ac.createBuffer(1, bufferLen, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferLen)
  }

  const noise = ac.createBufferSource()
  noise.buffer = buffer

  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = isBass ? 1200 : 3000
  bandpass.Q.value = isBass ? 0.3 : 0.5

  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(isBass ? 0.18 : 0.25, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration)

  noise.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(dest)

  noise.start(now)
  noise.stop(now + noiseDuration)
}

export function playNote(note: NotePitch, duration = 2.5): void {
  const ac = getAudioContext()
  ensureAudioResumed()

  const midi = notePitchToMidi(note)
  const freq = midiToFrequency(midi)
  const now = ac.currentTime
  const isBass = midi < 48

  const decayScale = Math.max(0.4, 1 - (midi - 48) * 0.008)
  const totalDuration = duration * decayScale

  const bassBoost = isBass ? Math.min(1 + (48 - midi) * 0.015, 1.4) : 1
  const masterGain = ac.createGain()
  masterGain.gain.setValueAtTime(0.3 * bassBoost, now)

  const lpfStart = isBass
    ? Math.min(freq * 18, 14000)
    : Math.min(freq * 8, 12000)
  const lpfEnd = isBass
    ? Math.max(freq * 6, 800)
    : Math.max(freq * 2, 400)

  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.setValueAtTime(lpfStart, now)
  lpf.frequency.exponentialRampToValueAtTime(lpfEnd, now + totalDuration * 0.7)

  masterGain.connect(lpf)
  lpf.connect(ac.destination)

  createHammerNoise(ac, masterGain, now, midi)

  const harmonics = isBass ? BASS_HARMONICS : HARMONICS
  const detuneCents = isBass ? BASS_DETUNE_CENTS : DETUNE_CENTS
  const attackTime = isBass ? 0.008 : 0.005

  // Bass strings have inharmonicity: partials are progressively sharper
  const inharmonicity = isBass
    ? 0.0004 * Math.pow(2, (48 - midi) / 12)
    : 0

  for (const detune of detuneCents) {
    for (let hi = 0; hi < harmonics.length; hi++) {
      const h = harmonics[hi]
      const n = h.ratio
      const hFreq = freq * n * Math.sqrt(1 + inharmonicity * n * n)
      if (hFreq > ac.sampleRate / 2) continue

      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(hFreq, now)
      osc.detune.setValueAtTime(detune, now)

      const gain = ac.createGain()
      const peak = h.gain * 0.5

      // Upper partials die off faster in bass strings
      const partialDecay = isBass ? Math.pow(0.88, hi) : 1
      const partialDuration = totalDuration * partialDecay

      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(peak, now + attackTime)
      gain.gain.exponentialRampToValueAtTime(
        peak * 0.3,
        now + partialDuration * 0.15,
      )
      gain.gain.exponentialRampToValueAtTime(0.0001, now + partialDuration)

      osc.connect(gain)
      gain.connect(masterGain)

      osc.start(now)
      osc.stop(now + partialDuration + 0.05)
    }
  }
}
