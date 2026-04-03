import { render } from '@testing-library/react'
import { Spinner } from '../Spinner'

describe('Spinner', () => {
  it('renders the spinner div', () => {
    const { container } = render(<Spinner />)
    const spinnerEl = container.querySelector('.animate-spin')
    expect(spinnerEl).toBeInTheDocument()
  })

  it('accepts a custom className', () => {
    const { container } = render(<Spinner className="mt-4" />)
    expect(container.firstChild).toHaveClass('mt-4')
  })
})
