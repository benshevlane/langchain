import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { AgentStatusPanel } from '../AgentStatusPanel'

describe('AgentStatusPanel', () => {
  it('renders title with default site label', () => {
    renderWithProviders(<AgentStatusPanel />)
    expect(screen.getByText('Agent Status — Kitchens Directory')).toBeInTheDocument()
  })

  it('shows empty message when no configs are returned', async () => {
    renderWithProviders(<AgentStatusPanel />)
    await waitFor(() => {
      expect(
        screen.getByText('No agent configs found for this site. Run the migration to seed defaults.'),
      ).toBeInTheDocument()
    })
  })
})
