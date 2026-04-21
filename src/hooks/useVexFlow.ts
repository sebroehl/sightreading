import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'

import { noteToVexFlowKey } from '../lib/notation'
import type { NotePitch, StaffNotation } from '../lib/types'

export type Theme = 'dark' | 'light'

const COLORS: Record<Theme, string> = {
  dark: 'rgba(255, 255, 255, 0.85)',
  light: 'rgba(0, 0, 0, 0.82)',
}

const MUTED_COLORS: Record<Theme, string> = {
  dark: 'rgba(255, 255, 255, 0.3)',
  light: 'rgba(0, 0, 0, 0.25)',
}

const CORRECT_COLOR = '#4ade80'
const GHOST_COLOR = 'rgba(239, 68, 68, 0.35)'

const STAVE_HEIGHT = 150
const STAVE_Y = 20
const SLIDE_DURATION_MS = 300

function styleStaveNote(staveNote: StaveNote, color: string) {
  staveNote.setStyle({ fillStyle: color, strokeStyle: color })
  staveNote.setLedgerLineStyle({ fillStyle: color, strokeStyle: color })
  staveNote.renderOptions.drawStem = false
}

interface NoteRef {
  svgEl: SVGElement
  x: number
}

export function useVexFlow(
  container: HTMLDivElement | null,
  notation: StaffNotation,
  theme: Theme = 'dark',
  noteColor?: string,
  ghostNote?: NotePitch | null,
  sliding?: boolean,
  onSlideComplete?: () => void,
) {
  const ghostNoteKey = ghostNote ? noteToVexFlowKey(ghostNote) : null
  const noteRefsStore = useRef<NoteRef[]>([])
  const slidingPropRef = useRef(sliding)
  slidingPropRef.current = !!sliding

  useEffect(() => {
    if (!container || sliding) return

    const themeColor = COLORS[theme]
    const mutedColor = MUTED_COLORS[theme]
    const activeColor = noteColor ?? themeColor
    const hasMultipleNotes = notation.notes.length > 1

    const render = () => {
      const width = Math.max(container.clientWidth, 280)

      container.replaceChildren()

      const renderer = new Renderer(container, Renderer.Backends.SVG)
      renderer.resize(width, STAVE_HEIGHT)

      const context = renderer.getContext()
      const staveWidth = width - 40
      const stave = new Stave(20, STAVE_Y, staveWidth)

      stave.setStyle({ fillStyle: themeColor, strokeStyle: themeColor })
      stave.addClef(notation.clef)
      stave.setContext(context).draw()

      const staveNotes = notation.notes.map((note, i) => {
        const staveNote = new StaveNote({
          keys: [noteToVexFlowKey(note)],
          duration: note.duration ?? 'q',
          clef: notation.clef,
        })

        if (note.accidental) {
          staveNote.addModifier(new Accidental(note.accidental), 0)
        }

        const color = i === 0 ? activeColor : (hasMultipleNotes ? mutedColor : activeColor)
        styleStaveNote(staveNote, color)
        return staveNote
      })

      const voice = new Voice({
        numBeats: Math.max(staveNotes.length, 1),
        beatValue: 4,
      }).setMode(Voice.Mode.SOFT)

      voice.addTickables(staveNotes)

      new Formatter()
        .joinVoices([voice])
        .format([voice], staveWidth * 0.85)

      voice.draw(context, stave)

      if (ghostNote) {
        const ghostStaveNote = new StaveNote({
          keys: [noteToVexFlowKey(ghostNote)],
          duration: 'q',
          clef: notation.clef,
        })

        if (ghostNote.accidental) {
          ghostStaveNote.addModifier(new Accidental(ghostNote.accidental), 0)
        }

        styleStaveNote(ghostStaveNote, GHOST_COLOR)

        const ghostVoice = new Voice({
          numBeats: 1,
          beatValue: 4,
        }).setMode(Voice.Mode.SOFT)

        ghostVoice.addTickables([ghostStaveNote])

        new Formatter().format([ghostVoice], 0)
        ghostVoice.draw(context, stave)
      }

      noteRefsStore.current = staveNotes.map((sn) => ({
        svgEl: sn.getSVGElement()!,
        x: sn.getAbsoluteX(),
      }))
    }

    render()

    const handleResize = () => {
      if (!slidingPropRef.current) render()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (!slidingPropRef.current) {
        container.replaceChildren()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, notation, theme, noteColor, ghostNoteKey, sliding])

  useEffect(() => {
    if (!sliding || !container) return

    const refs = noteRefsStore.current
    if (refs.length < 2) {
      onSlideComplete?.()
      return
    }

    slidingPropRef.current = true

    const dx = refs[1].x - refs[0].x

    for (let i = 0; i < refs.length; i++) {
      const el = refs[i].svgEl
      if (!el) continue

      el.style.transition = `transform ${SLIDE_DURATION_MS}ms ease-out, opacity ${SLIDE_DURATION_MS}ms ease-out`
      el.style.transform = `translateX(${-dx}px)`

      if (i === 0) {
        el.style.opacity = '0'
      }
    }

    let settled = false
    const onEnd = () => {
      if (settled) return
      settled = true
      clearTimeout(fallback)
      slidingPropRef.current = false
      onSlideComplete?.()
    }

    const target = refs[1].svgEl
    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'transform') onEnd()
    }

    if (target) {
      target.addEventListener('transitionend', handleTransitionEnd)
    }

    const fallback = setTimeout(onEnd, SLIDE_DURATION_MS + 50)

    return () => {
      clearTimeout(fallback)
      if (target) {
        target.removeEventListener('transitionend', handleTransitionEnd)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliding])
}

export { CORRECT_COLOR }
