import { Staff } from './Staff'
import type { Note } from '../lib/types'

interface SnippetDisplayProps {
  title?: string
  notes: Note[]
}

export function SnippetDisplay({
  title = 'Phrase preview',
  notes,
}: SnippetDisplayProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(3,4,10,0.35)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-white/45">Next up</p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
        <p className="font-mono text-sm text-white/60">{notes.length} notes</p>
      </div>
      <Staff notation={{ notes, clef: 'treble' }} />
    </section>
  )
}
