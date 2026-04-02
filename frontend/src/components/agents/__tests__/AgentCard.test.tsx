import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { AgentCard } from '../AgentCard'

const baseProps = {
  name: 'ralf',
  description: 'SEO agent — content, outreach, rankings, reporting',
  status: 'idle' as const,
  lastActive: null,
  turnsToday: 0,
  tokensToday: 0,
}

describe('AgentCard', () => {
  it('renders name and description', () => {
    renderWithProviders(<AgentCard {...baseProps} />)
    expect(screen.getByText('ralf')).toBeInTheDocument()
    expect(screen.getByText('SEO agent — content, outreach, rankings, reporting')).toBeInTheDocument()
  })

  it('shows Idle badge when status is idle', () => {
    renderWithProviders(<AgentCard {...baseProps} status="idle" />)
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })

  it('shows Running badge when status is running', () => {
    renderWithProviders(<AgentCard {...baseProps} status="running" />)
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('shows Error badge when status is error', () => {
    renderWithProviders(<AgentCard {...baseProps} status="error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('displays turns and tokens today', () => {
    renderWithProviders(<AgentCard {...baseProps} turnsToday={5} tokensToday={1234} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    renderWithProviders(<AgentCard {...baseProps} onClick={onClick} />)
    fireEvent.click(screen.getByText('ralf'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies selected styling when selected is true', () => {
    const { container } = renderWithProviders(<AgentCard {...baseProps} selected />)
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('border-[var(--color-primary)]')
  })
})
