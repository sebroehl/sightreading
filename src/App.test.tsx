import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it('renders notation on screen', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0)

    render(<App />)

    expect(screen.getByLabelText('Music notation')).toBeInTheDocument()
  })
})
