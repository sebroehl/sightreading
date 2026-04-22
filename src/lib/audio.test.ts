import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAudioContext } from './audio'

class AudioContextMock {}

describe('audio helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reuses a shared audio context instance', () => {
    vi.stubGlobal('AudioContext', AudioContextMock as typeof AudioContext)

    expect(getAudioContext()).toBe(getAudioContext())
  })
})
