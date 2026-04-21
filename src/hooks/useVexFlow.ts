import { useEffect } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'

import { noteToVexFlowKey } from '../lib/notation'
import type { StaffNotation } from '../lib/types'

export type Theme = 'dark' | 'light'

const COLORS: Record<Theme, string> = {
  dark: 'rgba(255, 255, 255, 0.85)',
  light: 'rgba(0, 0, 0, 0.82)',
}

const STAVE_HEIGHT = 150
const STAVE_Y = 20

function createStaveNotes(notation: StaffNotation, color: string) {
  return notation.notes.map((note) => {
    const staveNote = new StaveNote({
      keys: [noteToVexFlowKey(note)],
      duration: note.duration ?? 'q',
      clef: notation.clef,
    })

    if (note.accidental) {
      staveNote.addModifier(new Accidental(note.accidental), 0)
    }

    staveNote.setStyle({ fillStyle: color, strokeStyle: color })
    staveNote.setStemStyle({ fillStyle: color, strokeStyle: color })
    staveNote.setFlagStyle({ fillStyle: color, strokeStyle: color })
    staveNote.setLedgerLineStyle({ fillStyle: color, strokeStyle: color })

    return staveNote
  })
}

export function useVexFlow(
  container: HTMLDivElement | null,
  notation: StaffNotation,
  theme: Theme = 'dark',
) {
  useEffect(() => {
    if (!container) {
      return
    }

    const color = COLORS[theme]

    const render = () => {
      const width = Math.max(container.clientWidth, 280)

      container.replaceChildren()

      const renderer = new Renderer(container, Renderer.Backends.SVG)
      renderer.resize(width, STAVE_HEIGHT)

      const context = renderer.getContext()
      const staveWidth = width - 40
      const stave = new Stave(20, STAVE_Y, staveWidth)

      stave.setStyle({ fillStyle: color, strokeStyle: color })
      stave.addClef(notation.clef)
      stave.setContext(context).draw()

      const notes = createStaveNotes(notation, color)
      const voice = new Voice({
        numBeats: Math.max(notes.length, 1),
        beatValue: 4,
      }).setMode(Voice.Mode.SOFT)

      voice.addTickables(notes)

      new Formatter().joinVoices([voice]).format([voice], staveWidth * 0.4)
      voice.draw(context, stave)
    }

    render()

    const handleResize = () => render()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.replaceChildren()
    }
  }, [container, notation, theme])
}
