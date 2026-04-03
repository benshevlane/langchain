import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs } from '../Tabs'

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Details' },
  { key: 'settings', label: 'Settings' },
]

describe('Tabs', () => {
  it('renders tab labels', () => {
    render(<Tabs tabs={tabs} active="overview" onChange={() => {}} />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('active tab has highlighted style', () => {
    render(<Tabs tabs={tabs} active="details" onChange={() => {}} />)
    const activeButton = screen.getByText('Details').closest('button')!
    expect(activeButton.className).toContain('shadow-sm')

    const inactiveButton = screen.getByText('Overview').closest('button')!
    expect(inactiveButton.className).not.toContain('shadow-sm')
  })

  it('calls onChange with tab key on click', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Tabs tabs={tabs} active="overview" onChange={handleChange} />)
    await user.click(screen.getByText('Settings'))
    expect(handleChange).toHaveBeenCalledWith('settings')
  })
})
