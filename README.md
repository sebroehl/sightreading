# Sightread

A minimal sight-reading practice app scaffold built with Vite, React, Tailwind CSS, and VexFlow.

## Stack

- React + TypeScript
- Vite
- Tailwind CSS v4
- VexFlow
- Vitest + Testing Library

## Features in this scaffold

- Minimal dark practice surface
- Single-note challenge with treble and bass clef support
- VexFlow-backed staff renderer
- Reusable notation helpers and shared note types
- Scaffolded components for future snippet-based drills

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run lint
```

## Project structure

```text
src/
  components/
    Layout.tsx
    NoteDisplay.tsx
    SnippetDisplay.tsx
    Staff.tsx
  hooks/
    useVexFlow.ts
  lib/
    notation.ts
    types.ts
  test/
    setup.ts
```

## Next ideas

- Interval drills and dyads
- Timed rounds and streak tracking
- Short phrase generation
- MIDI or keyboard answer input
