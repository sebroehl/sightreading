import type { PropsWithChildren, ReactNode } from 'react'

interface LayoutProps extends PropsWithChildren {
  aside?: ReactNode
}

export function Layout({ children, aside }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(124,92,252,0.16),transparent_28%),var(--color-bg)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-10">
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.36em] text-white/45">
              Music reading practice
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-6xl">
              Sightread
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
              A stripped-back practice surface for note recognition, interval drills,
              and short notation snippets. Start with one note and keep the design calm
              enough to stay in the music.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">Foundation</p>
            <p className="mt-2 font-mono text-sm text-white/70">
              Vite + React + VexFlow + Tailwind
            </p>
          </div>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
          <div>{children}</div>
          {aside ? <aside className="space-y-6">{aside}</aside> : null}
        </main>
      </div>
    </div>
  )
}
