import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Sidebar } from '../Sidebar'

function renderSidebar(props: { open?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn()
  return render(
    <BrowserRouter>
      <Sidebar open={props.open ?? true} onClose={onClose} />
    </BrowserRouter>,
  )
}

describe('Sidebar', () => {
  it('renders "Agent Hub" brand text', () => {
    renderSidebar()
    expect(screen.getByText('Agent Hub')).toBeInTheDocument()
  })

  it.each([
    'Agents',
    'Schedules',
    'Org Chart',
    'CRM',
    'Keywords',
    'Backlinks',
    'Strategy',
  ])('renders nav link: %s', (label) => {
    renderSidebar()
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    renderSidebar({ onClose })
    // The close button has the X icon; it's inside the header area
    const buttons = screen.getAllByRole('button')
    // The close button is the only button in the sidebar
    await userEvent.click(buttons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
