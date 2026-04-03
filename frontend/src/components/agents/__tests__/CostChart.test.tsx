import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { CostChart } from '../CostChart'

describe('CostChart', () => {
  it('renders LLM Cost title', async () => {
    renderWithProviders(<CostChart />)
    await waitFor(() => {
      expect(screen.getByText('LLM Cost')).toBeInTheDocument()
    })
  })

  it('shows empty message when no cost data', async () => {
    renderWithProviders(<CostChart />)
    await waitFor(() => {
      expect(screen.getByText('No cost data yet')).toBeInTheDocument()
    })
  })

  it('shows total $0.00 header when no data', async () => {
    renderWithProviders(<CostChart />)
    await waitFor(() => {
      expect(screen.getByText('Total: $0.00')).toBeInTheDocument()
    })
  })
})
