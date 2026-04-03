import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { AgentDashboard } from '../AgentDashboard'

vi.mock('../../layout/Shell', () => ({
  useShellContext: () => ({ registerRefetch: vi.fn(() => vi.fn()) }),
}))

describe('AgentDashboard', () => {
  it('renders agent cards for ralf and scraper', async () => {
    renderWithProviders(<AgentDashboard />)
    await waitFor(() => {
      expect(screen.getByText('ralf')).toBeInTheDocument()
    })
    expect(screen.getByText('scraper')).toBeInTheDocument()
  })

  it('renders all tab labels', async () => {
    renderWithProviders(<AgentDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
    // "Activity" appears both as tab label and as the ActivityTimeline heading;
    // verify at least one is present (the tab).
    expect(screen.getAllByText('Activity').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Cost')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Agent Status')).toBeInTheDocument()
  })

  it('defaults to the Overview tab', async () => {
    renderWithProviders(<AgentDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
    const overviewButton = screen.getByText('Overview').closest('button')
    expect(overviewButton?.className).toContain('bg-[var(--color-surface)]')
  })

  it('switches tab content when a tab is clicked', async () => {
    renderWithProviders(<AgentDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Agent Status')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Agent Status'))
    await waitFor(() => {
      expect(screen.getByText('Agent Status — Kitchens Directory')).toBeInTheDocument()
    })
  })
})
