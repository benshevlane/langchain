import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from '../Toggle'

describe('Toggle', () => {
  it('renders in unchecked state', () => {
    render(<Toggle checked={false} onChange={() => {}} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('renders in checked state', () => {
    render(<Toggle checked={true} onChange={() => {}} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with toggled value on click', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Toggle checked={false} onChange={handleChange} />)
    await user.click(screen.getByRole('switch'))
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('does not call onChange when disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Toggle checked={false} onChange={handleChange} disabled />)
    await user.click(screen.getByRole('switch'))
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('renders label text when provided', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Dark mode" />)
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
  })
})
