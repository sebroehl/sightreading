import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMicrophoneInput } from './useMicrophoneInput'

type PitchResult = [number, number]

const { detectorState, detector, ensureAudioResumed, getAudioContext } = vi.hoisted(() => {
  const state = {
    nextResults: [] as PitchResult[],
  }

  return {
    detectorState: state,
    detector: {
      findPitch: vi.fn(() => state.nextResults.shift() ?? [0, 0]),
    },
    ensureAudioResumed: vi.fn(),
    getAudioContext: vi.fn(),
  }
})

vi.mock('../lib/audio', () => ({
  getAudioContext,
  ensureAudioResumed,
}))

vi.mock('pitchy', () => ({
  PitchDetector: {
    forFloat32Array: vi.fn(() => detector),
  },
}))

class MediaStreamTrackMock {
  stop = vi.fn()
}

class MediaStreamMock {
  track = new MediaStreamTrackMock()

  getTracks() {
    return [this.track]
  }
}

class AnalyserNodeMock {
  fftSize = 0

  samples: number[]

  constructor(samples: number[]) {
    this.samples = samples
  }

  getFloatTimeDomainData(buffer: Float32Array) {
    buffer.fill(0)
    buffer.set(this.samples)
  }
}

class MediaStreamSourceNodeMock {
  connect = vi.fn()
  disconnect = vi.fn()
}

describe('useMicrophoneInput', () => {
  let stream: MediaStreamMock
  let analyser: AnalyserNodeMock
  let source: MediaStreamSourceNodeMock
  let animationQueue: FrameRequestCallback[]

  beforeEach(() => {
    detector.findPitch.mockClear()
    detectorState.nextResults = []
    ensureAudioResumed.mockReset()
    animationQueue = []

    stream = new MediaStreamMock()
    analyser = new AnalyserNodeMock(Array(2048).fill(0.2))
    source = new MediaStreamSourceNodeMock()

    getAudioContext.mockReturnValue({
      sampleRate: 48_000,
      createAnalyser: () => analyser,
      createMediaStreamSource: () => source,
    })

    vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) => {
      animationQueue.push(cb)
      return animationQueue.length
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts listening and emits a stable detected note', async () => {
    detectorState.nextResults = [
      [440, 0.98],
      [440, 0.98],
    ]

    const onNoteDetected = vi.fn()
    const onNoteReleased = vi.fn()
    const { result } = renderHook(() =>
      useMicrophoneInput({ onNoteDetected, onNoteReleased }),
    )

    await act(async () => {
      await result.current.startListening()
    })

    expect(result.current.isListening).toBe(true)
    expect(ensureAudioResumed).toHaveBeenCalled()

    await act(async () => {
      animationQueue.shift()?.(0)
      animationQueue.shift()?.(80)
    })

    await waitFor(() =>
      expect(onNoteDetected).toHaveBeenCalledWith({
        letter: 'A',
        octave: 4,
        accidental: null,
      }),
    )
    expect(onNoteReleased).not.toHaveBeenCalled()
    expect(result.current.currentNote).toEqual({
      letter: 'A',
      octave: 4,
      accidental: null,
    })
  })

  it('releases the active note on silence and stops the stream', async () => {
    detectorState.nextResults = [
      [440, 0.98],
      [440, 0.98],
      [0, 0],
      [0, 0],
    ]

    const onNoteDetected = vi.fn()
    const onNoteReleased = vi.fn()
    const { result } = renderHook(() =>
      useMicrophoneInput({ onNoteDetected, onNoteReleased }),
    )

    await act(async () => {
      await result.current.startListening()
    })

    await act(async () => {
      animationQueue.shift()?.(0)
      animationQueue.shift()?.(80)
    })

    analyser.samples = Array(2048).fill(0)

    await act(async () => {
      animationQueue.shift()?.(120)
      animationQueue.shift()?.(320)
    })

    await waitFor(() => expect(onNoteReleased).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.stopListening()
    })

    expect(stream.track.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
    expect(result.current.currentNote).toBeNull()
  })
})
