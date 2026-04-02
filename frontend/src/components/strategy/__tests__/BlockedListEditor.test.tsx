import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockedListEditor } from '../BlockedListEditor'

const defaultProps = {
  label: 'Blocked Keywords',
  description: 'Keywords the agent will never target',
  value: '',
  onUpdate: vi.fn().mockResolvedValue(undefined),
  saving: false,
}

describe('BlockedListEditor', () => {
  it('renders label and description', () => {
    render(<BlockedListEditor {...defaultProps} />)
    expect(screen.getByText('Blocked Keywords')).toBeInTheDocument()
    expect(screen.getByText('Keywords the agent will never target')).toBeInTheDocument()
  })

  it('shows "No items blocked yet." when value is empty', () => {
    render(<BlockedListEditor {...defaultProps} />)
    expect(screen.getByText('No items blocked yet.')).toBeInTheDocument()
  })

  it('renders existing items as pills when value is provided', () => {
    render(<BlockedListEditor {...defaultProps} value="foo, bar, baz" />)
    expect(screen.getByText('foo')).toBeInTheDocument()
    expect(screen.getByText('bar')).toBeInTheDocument()
    expect(screen.getByText('baz')).toBeInTheDocument()
    expect(screen.queryByText('No items blocked yet.')).not.toBeInTheDocument()
  })

  it('can add items via input + Enter', async () => {
    render(<BlockedListEditor {...defaultProps} />)
    const input = screen.getByPlaceholderText('Add item and press Enter')
    await userEvent.type(input, 'new-keyword{Enter}')
    expect(screen.getByText('new-keyword')).toBeInTheDocument()
    expect(screen.queryByText('No items blocked yet.')).not.toBeInTheDocument()
  })

  it('can add items via the Add button', async () => {
    render(<BlockedListEditor {...defaultProps} />)
    const input = screen.getByPlaceholderText('Add item and press Enter')
    await userEvent.type(input, 'added-item')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('added-item')).toBeInTheDocument()
  })

  it('does not add duplicate items', async () => {
    render(<BlockedListEditor {...defaultProps} value="existing" />)
    const input = screen.getByPlaceholderText('Add item and press Enter')
    await userEvent.type(input, 'existing{Enter}')
    // Should still be exactly one "existing" pill
    const pills = screen.getAllByText('existing')
    expect(pills).toHaveLength(1)
  })

  it('can remove items by clicking the X button', async () => {
    render(<BlockedListEditor {...defaultProps} value="alpha, beta" />)
    expect(screen.getByText('alpha')).toBeInTheDocument()

    // Each pill has a remove button (the X svg button)
    const alphaPill = screen.getByText('alpha').closest('span')!
    const removeBtn = alphaPill.querySelector('button')!
    await userEvent.click(removeBtn)

    expect(screen.queryByText('alpha')).not.toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()
  })

  it('shows Save and Reset buttons after modification', async () => {
    render(<BlockedListEditor {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    const input = screen.getByPlaceholderText('Add item and press Enter')
    await userEvent.type(input, 'dirty-item{Enter}')

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
  })

  it('clears input after adding an item', async () => {
    render(<BlockedListEditor {...defaultProps} />)
    const input = screen.getByPlaceholderText('Add item and press Enter')
    await userEvent.type(input, 'test{Enter}')
    expect(input).toHaveValue('')
  })
})
