import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/helpers'
import { CrmDashboard } from '../CrmDashboard'

describe('CrmDashboard', () => {
  it('renders all 4 tab buttons', () => {
    renderWithProviders(<CrmDashboard />)
    expect(screen.getByRole('button', { name: 'Contacts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pipeline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prospects' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument()
  })

  it('defaults to Contacts tab', () => {
    renderWithProviders(<CrmDashboard />)
    // The Contacts button should have the active styling (bg-[var(--color-primary)])
    const contactsBtn = screen.getByRole('button', { name: 'Contacts' })
    expect(contactsBtn.className).toContain('bg-[var(--color-primary)]')
  })

  it('switches tab content when Pipeline tab is clicked', async () => {
    renderWithProviders(<CrmDashboard />)
    const pipelineBtn = screen.getByRole('button', { name: 'Pipeline' })
    await userEvent.click(pipelineBtn)
    expect(pipelineBtn.className).toContain('bg-[var(--color-primary)]')
    // Contacts should no longer be active
    const contactsBtn = screen.getByRole('button', { name: 'Contacts' })
    expect(contactsBtn.className).not.toContain('bg-[var(--color-primary)]')
  })

  it('switches to Activity tab when clicked', async () => {
    renderWithProviders(<CrmDashboard />)
    const activityBtn = screen.getByRole('button', { name: 'Activity' })
    await userEvent.click(activityBtn)
    expect(activityBtn.className).toContain('bg-[var(--color-primary)]')
  })
})
