import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies success variant class', () => {
    render(<Badge variant="success">OK</Badge>)
    expect(screen.getByText('OK').className).toContain('text-emerald-400')
  })

  it('applies danger variant class', () => {
    render(<Badge variant="danger">Error</Badge>)
    expect(screen.getByText('Error').className).toContain('text-red-400')
  })

  it('applies neutral variant class by default', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default').className).toContain('text-slate-400')
  })
})
