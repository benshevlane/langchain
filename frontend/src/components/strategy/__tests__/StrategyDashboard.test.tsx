import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { StrategyDashboard } from '../StrategyDashboard'

describe('StrategyDashboard', () => {
  it('renders Campaign Goals section heading', async () => {
    renderWithProviders(<StrategyDashboard />)
    expect(await screen.findByRole('heading', { name: /campaign goals/i })).toBeInTheDocument()
  })

  it('renders Strategy Config section heading', async () => {
    renderWithProviders(<StrategyDashboard />)
    expect(await screen.findByRole('heading', { name: /strategy config/i })).toBeInTheDocument()
  })

  it('renders Blocked Lists section heading', async () => {
    renderWithProviders(<StrategyDashboard />)
    expect(await screen.findByRole('heading', { name: /blocked lists/i })).toBeInTheDocument()
  })

  it('shows empty goals message when no goals are returned', async () => {
    renderWithProviders(<StrategyDashboard />)
    expect(await screen.findByText(/no goals configured yet/i)).toBeInTheDocument()
  })

  it('renders blocked keywords and blocked domains editors', async () => {
    renderWithProviders(<StrategyDashboard />)
    expect(await screen.findByText('Blocked Keywords')).toBeInTheDocument()
    expect(screen.getByText('Blocked Domains')).toBeInTheDocument()
  })
})
