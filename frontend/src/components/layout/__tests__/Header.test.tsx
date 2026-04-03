import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Header } from '../Header'

function renderHeader(
  pathname: string,
  props: { onRefresh?: () => void; onMenuToggle?: () => void } = {},
) {
  const onMenuToggle = props.onMenuToggle ?? vi.fn()
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header onRefresh={props.onRefresh} onMenuToggle={onMenuToggle} />
    </MemoryRouter>,
  )
}

describe('Header', () => {
  it('renders the title based on pathname', () => {
    renderHeader('/agents')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Agents')
  })

  it('renders "Activity Schedules" for /schedules', () => {
    renderHeader('/schedules')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Activity Schedules')
  })

  it('renders "Dashboard" for unknown paths', () => {
    renderHeader('/unknown-route')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
  })

  it('shows Refresh button when onRefresh is provided', () => {
    renderHeader('/agents', { onRefresh: vi.fn() })
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('does not show Refresh button when onRefresh is not provided', () => {
    renderHeader('/agents')
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
  })

  it('calls onRefresh when Refresh button is clicked', async () => {
    const onRefresh = vi.fn()
    renderHeader('/agents', { onRefresh })
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('calls onMenuToggle when hamburger button is clicked', async () => {
    const onMenuToggle = vi.fn()
    renderHeader('/agents', { onMenuToggle })
    // The hamburger is the first button (before possible Refresh)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    expect(onMenuToggle).toHaveBeenCalledTimes(1)
  })
})
