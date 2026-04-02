import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { AgentTurnLog } from '../AgentTurnLog'

describe('AgentTurnLog', () => {
  it('renders Turn Log title', () => {
    renderWithProviders(<AgentTurnLog />)
    expect(screen.getByText('Turn Log')).toBeInTheDocument()
  })

  it('shows empty message when data is empty', async () => {
    renderWithProviders(<AgentTurnLog />)
    await waitFor(() => {
      expect(screen.getByText('No turns recorded yet')).toBeInTheDocument()
    })
  })

  it('renders with agent name filter', async () => {
    renderWithProviders(<AgentTurnLog agentName="ralf" />)
    expect(screen.getByText('Turn Log')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('No turns recorded yet')).toBeInTheDocument()
    })
  })
})
