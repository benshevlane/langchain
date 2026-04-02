import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })
})

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header content</CardHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })
})

describe('CardTitle', () => {
  it('renders children as an h3', () => {
    render(<CardTitle>Title text</CardTitle>)
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('Title text')
  })
})
