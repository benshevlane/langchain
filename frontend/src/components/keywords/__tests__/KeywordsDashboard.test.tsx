import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { KeywordsDashboard } from '../KeywordsDashboard'

describe('KeywordsDashboard', () => {
  it('renders the domain text from site config', async () => {
    renderWithProviders(<KeywordsDashboard />)
    expect(await screen.findByText('kitchensdirectory.co.uk')).toBeInTheDocument()
  })

  it('renders "Showing rankings for" text', async () => {
    renderWithProviders(<KeywordsDashboard />)
    expect(await screen.findByText(/showing rankings for/i)).toBeInTheDocument()
  })

  it('renders stats cards with empty state', async () => {
    renderWithProviders(<KeywordsDashboard />)
    expect(await screen.findByText('Total Keywords')).toBeInTheDocument()
    expect(screen.getByText('Avg Position')).toBeInTheDocument()
  })

  it('renders table with empty state message', async () => {
    renderWithProviders(<KeywordsDashboard />)
    expect(await screen.findByText('No ranking data available')).toBeInTheDocument()
  })

  it('renders rank movers section', async () => {
    renderWithProviders(<KeywordsDashboard />)
    expect(await screen.findByText('Rankings (0)')).toBeInTheDocument()
  })
})
