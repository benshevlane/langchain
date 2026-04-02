import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

function GoodChild() {
  return <p>All is well</p>
}

function BadChild(): JSX.Element {
  throw new Error('Boom!')
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('All is well')).toBeInTheDocument()
  })

  it('renders error message when a child throws', () => {
    // Suppress React error boundary console.error noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Boom!')).toBeInTheDocument()

    spy.mockRestore()
  })

  it('does not render children when an error is caught', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>,
    )
    expect(screen.queryByText('All is well')).not.toBeInTheDocument()

    spy.mockRestore()
  })
})
