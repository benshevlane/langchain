import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { CostSummary } from '../CostSummary'

describe('CostSummary', () => {
  it('renders three period cards', async () => {
    renderWithProviders(<CostSummary agentName="ralf" />)
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument()
    })
    expect(screen.getByText('This Week')).toBeInTheDocument()
    expect(screen.getByText('This Month')).toBeInTheDocument()
  })

  it('shows $0.0000 for each period when no data', async () => {
    renderWithProviders(<CostSummary agentName="ralf" />)
    await waitFor(() => {
      expect(screen.getAllByText('$0.0000')).toHaveLength(3)
    })
  })
})
