import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PitchDetector } from 'pitchy'

import { ensureAudioResumed, getAudioContext } from '../lib/audio'
import { frequencyToNotePitch } from '../lib/pitchDetection'
import { notePitchEquals } from '../lib/notation'
import type { NotePitch } from '../lib/types'

const FFT_SIZE = 2048
const CLARITY_THRESHOLD = 0.93
const VOLUME_THRESHOLD = 0.02
const ONSET_DEBOUNCE_MS = 60
const RELEASE_DEBOUNCE_MS = 150
const DEBUG_SAMPLE_INTERVAL_MS = 120
const MAX_DEBUG_EVENTS = 8

type RejectedBy = 'volume' | 'frequency' | 'clarity' | null
type StreamStage =
  | 'idle'
  | 'resuming'
  | 'requesting-stream'
  | 'listening'
  | 'error'
  | 'stopped'

interface MicrophoneEnvironmentDebug {
  hasGetUserMedia: boolean
  isSecureContext: boolean
  origin: string
  protocol: string
}

interface MicrophoneAudioContextDebug {
  state: AudioContextState | 'unknown'
  sampleRate: number | null
  resumeAttempted: boolean
  resumeResult: AudioContextState | 'rejected' | null
}

interface MicrophoneStreamDebug {
  stage: StreamStage
  errorName: string | null
  errorMessage: string | null
  trackEnabled: boolean | null
  trackMuted: boolean | null
  trackReadyState: MediaStreamTrackState | null
}

interface MicrophoneMetricsDebug {
  frameCount: number
  rms: number
  frequency: number
  clarity: number
  hasPitch: boolean
  rejectedBy: RejectedBy
}

interface MicrophoneDetectionDebug {
  activeNote: string | null
  candidateNote: string | null
  lastDetectedNote: string | null
  lastReleaseReason: string | null
}

export interface MicrophoneDebugState {
  environment: MicrophoneEnvironmentDebug
  audioContext: MicrophoneAudioContextDebug
  stream: MicrophoneStreamDebug
  metrics: MicrophoneMetricsDebug
  detection: MicrophoneDetectionDebug
  events: string[]
}

interface UseMicrophoneInputOptions {
  onNoteDetected?: (note: NotePitch) => void
  onNoteReleased?: () => void
}

function getRms(buffer: Float32Array): number {
  let sum = 0
  for (const sample of buffer) {
    sum += sample * sample
  }
  return Math.sqrt(sum / buffer.length)
}

function getNoteLabel(note: NotePitch | null): string | null {
  if (!note) return null
  return `${note.letter}${note.accidental ?? ''}${note.octave}`
}

function getEnvironmentDebug(isSupported: boolean): MicrophoneEnvironmentDebug {
  if (typeof window === 'undefined') {
    return {
      hasGetUserMedia: isSupported,
      isSecureContext: false,
      origin: 'unknown',
      protocol: 'unknown',
    }
  }

  return {
    hasGetUserMedia: isSupported,
    isSecureContext: window.isSecureContext,
    origin: window.location.origin,
    protocol: window.location.protocol,
  }
}

function getRejectedBy(rms: number, frequency: number, clarity: number): RejectedBy {
  if (rms < VOLUME_THRESHOLD) return 'volume'
  if (frequency <= 0) return 'frequency'
  if (clarity < CLARITY_THRESHOLD) return 'clarity'
  return null
}

export function useMicrophoneInput({
  onNoteDetected,
  onNoteReleased,
}: UseMicrophoneInputOptions) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentNote, setCurrentNote] = useState<NotePitch | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const frameRef = useRef<number | null>(null)
  const activeNoteRef = useRef<NotePitch | null>(null)
  const candidateNoteRef = useRef<NotePitch | null>(null)
  const candidateStartedAtRef = useRef<number | null>(null)
  const releaseStartedAtRef = useRef<number | null>(null)
  const lastDebugSampleAtRef = useRef<number>(0)

  const isSupported = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    [],
  )

  const [debug, setDebug] = useState<MicrophoneDebugState>(() => ({
    environment: getEnvironmentDebug(isSupported),
    audioContext: {
      state: 'unknown',
      sampleRate: null,
      resumeAttempted: false,
      resumeResult: null,
    },
    stream: {
      stage: 'idle',
      errorName: null,
      errorMessage: null,
      trackEnabled: null,
      trackMuted: null,
      trackReadyState: null,
    },
    metrics: {
      frameCount: 0,
      rms: 0,
      frequency: 0,
      clarity: 0,
      hasPitch: false,
      rejectedBy: null,
    },
    detection: {
      activeNote: null,
      candidateNote: null,
      lastDetectedNote: null,
      lastReleaseReason: null,
    },
    events: [],
  }))

  const mergeDebug = useCallback((updater: (current: MicrophoneDebugState) => MicrophoneDebugState) => {
    setDebug((current) => updater(current))
  }, [])

  const pushEvent = useCallback(
    (message: string) => {
      mergeDebug((current) => ({
        ...current,
        events: [...current.events, message].slice(-MAX_DEBUG_EVENTS),
      }))
    },
    [mergeDebug],
  )

  const clearDetectionState = useCallback(() => {
    activeNoteRef.current = null
    candidateNoteRef.current = null
    candidateStartedAtRef.current = null
    releaseStartedAtRef.current = null
    setCurrentNote(null)
    mergeDebug((current) => ({
      ...current,
      detection: {
        ...current.detection,
        activeNote: null,
        candidateNote: null,
      },
    }))
  }, [mergeDebug])

  const emitRelease = useCallback((reason: string) => {
    if (!activeNoteRef.current) return
    onNoteReleased?.()
    mergeDebug((current) => ({
      ...current,
      detection: {
        ...current.detection,
        activeNote: null,
        candidateNote: null,
        lastReleaseReason: reason,
      },
    }))
    pushEvent(`release: ${reason}`)
    clearDetectionState()
  }, [clearDetectionState, mergeDebug, onNoteReleased, pushEvent])

  const cleanupStream = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    sourceRef.current?.disconnect()
    sourceRef.current = null
    analyserRef.current = null
    bufferRef.current = null
    detectorRef.current = null

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopListening = useCallback(() => {
    cleanupStream()
    emitRelease('manual stop')
    clearDetectionState()
    setIsListening(false)
    mergeDebug((current) => ({
      ...current,
      stream: {
        ...current.stream,
        stage: 'stopped',
      },
    }))
    pushEvent('listening stopped')
  }, [cleanupStream, clearDetectionState, emitRelease, mergeDebug, pushEvent])

  const processFrame = useCallback(
    function processFrame(timestamp: number) {
      const analyser = analyserRef.current
      const detector = detectorRef.current
      const buffer = bufferRef.current

      if (!analyser || !detector || !buffer) {
        return
      }

      analyser.getFloatTimeDomainData(buffer)

      const rms = getRms(buffer)
      const [frequency, clarity] = detector.findPitch(
        buffer as ArrayLike<number>,
        getAudioContext().sampleRate,
      )
      const hasPitch = rms >= VOLUME_THRESHOLD && frequency > 0 && clarity >= CLARITY_THRESHOLD
      const rejectedBy = hasPitch ? null : getRejectedBy(rms, frequency, clarity)
      const nextFrameCount = debug.metrics.frameCount + 1

      if (
        timestamp - lastDebugSampleAtRef.current >= DEBUG_SAMPLE_INTERVAL_MS ||
        nextFrameCount <= 2
      ) {
        lastDebugSampleAtRef.current = timestamp
        mergeDebug((current) => ({
          ...current,
          metrics: {
            frameCount: current.metrics.frameCount + 1,
            rms,
            frequency,
            clarity,
            hasPitch,
            rejectedBy,
          },
          detection: {
            ...current.detection,
            activeNote: getNoteLabel(activeNoteRef.current),
            candidateNote: getNoteLabel(candidateNoteRef.current),
          },
        }))
      }

      if (hasPitch) {
        const detectedNote = frequencyToNotePitch(frequency)
        releaseStartedAtRef.current = null

        if (
          candidateNoteRef.current &&
          notePitchEquals(candidateNoteRef.current, detectedNote)
        ) {
          if (
            candidateStartedAtRef.current !== null &&
            timestamp - candidateStartedAtRef.current >= ONSET_DEBOUNCE_MS &&
            (!activeNoteRef.current || !notePitchEquals(activeNoteRef.current, detectedNote))
          ) {
            activeNoteRef.current = detectedNote
            setCurrentNote(detectedNote)
            mergeDebug((current) => ({
              ...current,
              detection: {
                ...current.detection,
                activeNote: getNoteLabel(detectedNote),
                candidateNote: getNoteLabel(detectedNote),
                lastDetectedNote: getNoteLabel(detectedNote),
              },
            }))
            pushEvent(`note emitted: ${getNoteLabel(detectedNote)}`)
            onNoteDetected?.(detectedNote)
          }
        } else {
          candidateNoteRef.current = detectedNote
          candidateStartedAtRef.current = timestamp
          mergeDebug((current) => ({
            ...current,
            detection: {
              ...current.detection,
              candidateNote: getNoteLabel(detectedNote),
            },
          }))
        }
      } else if (activeNoteRef.current) {
        candidateNoteRef.current = null
        candidateStartedAtRef.current = null

        if (releaseStartedAtRef.current === null) {
          releaseStartedAtRef.current = timestamp
        } else if (timestamp - releaseStartedAtRef.current >= RELEASE_DEBOUNCE_MS) {
          emitRelease('silence')
        }
      } else {
        candidateNoteRef.current = null
        candidateStartedAtRef.current = null
      }

      frameRef.current = requestAnimationFrame(processFrame)
    },
    [debug.metrics.frameCount, emitRelease, mergeDebug, onNoteDetected, pushEvent],
  )

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Microphone input is not supported on this device.')
      pushEvent('microphone unsupported')
      return
    }

    if (streamRef.current) {
      return
    }

    setError(null)
    pushEvent('start tapped')
    mergeDebug((current) => ({
      ...current,
      environment: getEnvironmentDebug(isSupported),
      audioContext: {
        ...current.audioContext,
        state: getAudioContext().state,
        sampleRate: getAudioContext().sampleRate,
        resumeAttempted: true,
      },
      stream: {
        ...current.stream,
        stage: 'resuming',
        errorName: null,
        errorMessage: null,
      },
      metrics: {
        frameCount: 0,
        rms: 0,
        frequency: 0,
        clarity: 0,
        hasPitch: false,
        rejectedBy: null,
      },
      detection: {
        activeNote: null,
        candidateNote: null,
        lastDetectedNote: current.detection.lastDetectedNote,
        lastReleaseReason: current.detection.lastReleaseReason,
      },
    }))

    const audioContext = getAudioContext()
    const handleStateChange = () => {
      mergeDebug((current) => ({
        ...current,
        audioContext: {
          ...current.audioContext,
          state: audioContext.state,
          sampleRate: audioContext.sampleRate,
        },
      }))
      pushEvent(`audio context: ${audioContext.state}`)
    }
    audioContext.addEventListener?.('statechange', handleStateChange)

    try {
      const resumeResult = await ensureAudioResumed()
      mergeDebug((current) => ({
        ...current,
        audioContext: {
          ...current.audioContext,
          state: audioContext.state,
          sampleRate: audioContext.sampleRate,
          resumeResult,
        },
        stream: {
          ...current.stream,
          stage: 'requesting-stream',
        },
      }))
      pushEvent(`resume resolved: ${resumeResult}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      mergeDebug((current) => ({
        ...current,
        audioContext: {
          ...current.audioContext,
          state: audioContext.state,
          sampleRate: audioContext.sampleRate,
          resumeResult: 'rejected',
        },
        stream: {
          ...current.stream,
          stage: 'error',
          errorName: 'AudioContextResumeError',
          errorMessage: message,
        },
      }))
      setError(`AudioContextResumeError: ${message}`)
      pushEvent(`resume failed: ${message}`)
      audioContext.removeEventListener?.('statechange', handleStateChange)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = FFT_SIZE

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const detector = PitchDetector.forFloat32Array(analyser.fftSize)
      detector.clarityThreshold = CLARITY_THRESHOLD

      streamRef.current = stream
      sourceRef.current = source
      analyserRef.current = analyser
      bufferRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
      detectorRef.current = detector
      clearDetectionState()
      setIsListening(true)
      const [track] = stream.getTracks()
      mergeDebug((current) => ({
        ...current,
        audioContext: {
          ...current.audioContext,
          state: audioContext.state,
          sampleRate: audioContext.sampleRate,
        },
        stream: {
          stage: 'listening',
          errorName: null,
          errorMessage: null,
          trackEnabled: track?.enabled ?? null,
          trackMuted: track?.muted ?? null,
          trackReadyState: track?.readyState ?? null,
        },
      }))
      pushEvent('stream acquired')
      frameRef.current = requestAnimationFrame(processFrame)
    } catch (error) {
      cleanupStream()
      const errorName =
        error instanceof DOMException ? error.name : error instanceof Error ? error.name : 'MicrophoneError'
      const errorMessage =
        error instanceof DOMException ? error.message : error instanceof Error ? error.message : String(error)
      const formattedError = `${errorName}: ${errorMessage}`
      setError(formattedError)
      setIsListening(false)
      mergeDebug((current) => ({
        ...current,
        stream: {
          ...current.stream,
          stage: 'error',
          errorName,
          errorMessage,
          trackEnabled: null,
          trackMuted: null,
          trackReadyState: null,
        },
      }))
      pushEvent(`getUserMedia failed: ${formattedError}`)
      audioContext.removeEventListener?.('statechange', handleStateChange)
    }
  }, [cleanupStream, clearDetectionState, isSupported, mergeDebug, processFrame, pushEvent])

  useEffect(() => stopListening, [stopListening])

  return {
    currentNote,
    debug,
    error,
    isListening,
    isSupported,
    startListening,
    stopListening,
  }
}
