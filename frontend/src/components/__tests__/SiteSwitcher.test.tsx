import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/helpers'
import { SiteSwitcher } from '../SiteSwitcher'
import { SITES } from '../../context/SiteContext'

describe('SiteSwitcher', () => {
  it('renders three buttons, one per site', () => {
    renderWithProviders(<SiteSwitcher />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
  })

  it('shows label and domain text for each site', () => {
    renderWithProviders(<SiteSwitcher />)
    for (const site of SITES) {
      expect(screen.getByText(site.label)).toBeInTheDocument()
      expect(screen.getByText(site.domain)).toBeInTheDocument()
    }
  })

  it('active site button has the accent styling class', () => {
    renderWithProviders(<SiteSwitcher />)
    const kitchensButton = screen.getByText('Kitchens Directory').closest('button')!
    expect(kitchensButton.className).toContain('bg-[var(--color-primary)]')
  })

  it('clicking a different site updates the active button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SiteSwitcher />)

    const roomsButton = screen.getByText('Free Room Planner').closest('button')!
    expect(roomsButton.className).not.toContain('bg-[var(--color-primary)]')

    await user.click(roomsButton)

    expect(roomsButton.className).toContain('bg-[var(--color-primary)]')
    const kitchensButton = screen.getByText('Kitchens Directory').closest('button')!
    expect(kitchensButton.className).not.toContain('bg-[var(--color-primary)]')
  })
})
