import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { ActivityTimeline } from '../ActivityTimeline'

describe('ActivityTimeline', () => {
  it('renders Activity title', () => {
    renderWithProviders(<ActivityTimeline agentName="ralf" />)
    expect(screen.getByText('Activity')).toBeInTheDocument()
  })

  it('shows empty state when no data', async () => {
    renderWithProviders(<ActivityTimeline agentName="ralf" />)
    await waitFor(() => {
      expect(screen.getByText('No activity recorded yet for this agent.')).toBeInTheDocument()
    })
  })

  it('renders a Refresh button', () => {
    renderWithProviders(<ActivityTimeline agentName="ralf" />)
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })
})
