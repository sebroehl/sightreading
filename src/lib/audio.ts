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

function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
  }
  return ctx
}

export function ensureAudioResumed(): void {
  const ac = getAudioContext()
  if (ac.state === 'suspended') {
    ac.resume()
  }
}

const HARMONICS = [
  { ratio: 1, gain: 1.0 },
  { ratio: 2, gain: 0.4 },
  { ratio: 3, gain: 0.15 },
  { ratio: 4, gain: 0.06 },
  { ratio: 5, gain: 0.03 },
  { ratio: 6, gain: 0.015 },
]

// Simulate two slightly detuned strings per note (real pianos have 2-3)
const DETUNE_CENTS = [-3, 3]

function createHammerNoise(
  ac: AudioContext,
  dest: AudioNode,
  now: number,
): void {
  const bufferLen = Math.floor(ac.sampleRate * 0.04)
  const buffer = ac.createBuffer(1, bufferLen, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferLen)
  }

  const noise = ac.createBufferSource()
  noise.buffer = buffer

  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 3000
  bandpass.Q.value = 0.5

  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0.25, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

  noise.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(dest)

  noise.start(now)
  noise.stop(now + 0.04)
}

export function playNote(note: NotePitch, duration = 2.5): void {
  const ac = getAudioContext()
  ensureAudioResumed()

  const midi = notePitchToMidi(note)
  const freq = midiToFrequency(midi)
  const now = ac.currentTime

  // Higher notes decay faster, just like a real piano
  const decayScale = Math.max(0.4, 1 - (midi - 48) * 0.008)
  const totalDuration = duration * decayScale

  const masterGain = ac.createGain()
  masterGain.gain.setValueAtTime(0.3, now)

  // Gentle low-pass to tame upper harmonics like felt damping
  const lpf = ac.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.setValueAtTime(Math.min(freq * 8, 12000), now)
  lpf.frequency.exponentialRampToValueAtTime(
    Math.max(freq * 2, 400),
    now + totalDuration * 0.7,
  )

  masterGain.connect(lpf)
  lpf.connect(ac.destination)

  createHammerNoise(ac, masterGain, now)

  for (const detune of DETUNE_CENTS) {
    for (const h of HARMONICS) {
      const hFreq = freq * h.ratio
      if (hFreq > ac.sampleRate / 2) continue

      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(hFreq, now)
      osc.detune.setValueAtTime(detune, now)

      const gain = ac.createGain()
      const peak = h.gain * 0.5
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(peak, now + 0.005)
      // Two-stage decay: fast initial drop, then slow release
      gain.gain.exponentialRampToValueAtTime(
        peak * 0.3,
        now + totalDuration * 0.15,
      )
      gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration)

      osc.connect(gain)
      gain.connect(masterGain)

      osc.start(now)
      osc.stop(now + totalDuration + 0.05)
    }
  }
}
