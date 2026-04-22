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

  const isSupported = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    [],
  )

  const clearDetectionState = useCallback(() => {
    activeNoteRef.current = null
    candidateNoteRef.current = null
    candidateStartedAtRef.current = null
    releaseStartedAtRef.current = null
    setCurrentNote(null)
  }, [])

  const emitRelease = useCallback(() => {
    if (!activeNoteRef.current) return
    onNoteReleased?.()
    clearDetectionState()
  }, [clearDetectionState, onNoteReleased])

  const stopListening = useCallback(() => {
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

    emitRelease()
    clearDetectionState()
    setIsListening(false)
  }, [clearDetectionState, emitRelease])

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
            onNoteDetected?.(detectedNote)
          }
        } else {
          candidateNoteRef.current = detectedNote
          candidateStartedAtRef.current = timestamp
        }
      } else if (activeNoteRef.current) {
        candidateNoteRef.current = null
        candidateStartedAtRef.current = null

        if (releaseStartedAtRef.current === null) {
          releaseStartedAtRef.current = timestamp
        } else if (timestamp - releaseStartedAtRef.current >= RELEASE_DEBOUNCE_MS) {
          emitRelease()
        }
      } else {
        candidateNoteRef.current = null
        candidateStartedAtRef.current = null
      }

      frameRef.current = requestAnimationFrame(processFrame)
    },
    [emitRelease, onNoteDetected],
  )

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Microphone input is not supported on this device.')
      return
    }

    if (streamRef.current) {
      return
    }

    setError(null)
    ensureAudioResumed()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const audioContext = getAudioContext()
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
      frameRef.current = requestAnimationFrame(processFrame)
    } catch {
      setError('Microphone access needed')
      stopListening()
    }
  }, [clearDetectionState, isSupported, processFrame, stopListening])

  useEffect(() => stopListening, [stopListening])

  return {
    currentNote,
    error,
    isListening,
    isSupported,
    startListening,
    stopListening,
  }
}
