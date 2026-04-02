import { render, screen, act } from '@testing-library/react'
import { SiteProvider, useSite, SITES } from '../SiteContext'

function TestConsumer() {
  const { selectedSite, setSelectedSite, siteConfig } = useSite()
  return (
    <div>
      <span data-testid="site">{selectedSite}</span>
      <span data-testid="config-label">{siteConfig.label}</span>
      <span data-testid="config-domain">{siteConfig.domain}</span>
      <button onClick={() => setSelectedSite('rooms')}>switch to rooms</button>
      <button onClick={() => setSelectedSite('costs')}>switch to costs</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('SiteContext', () => {
  it('defaults selectedSite to kitchens', () => {
    render(
      <SiteProvider>
        <TestConsumer />
      </SiteProvider>,
    )
    expect(screen.getByTestId('site')).toHaveTextContent('kitchens')
  })

  it('returns the matching SITES entry as siteConfig', () => {
    render(
      <SiteProvider>
        <TestConsumer />
      </SiteProvider>,
    )
    const kitchens = SITES.find((s) => s.id === 'kitchens')!
    expect(screen.getByTestId('config-label')).toHaveTextContent(kitchens.label)
    expect(screen.getByTestId('config-domain')).toHaveTextContent(kitchens.domain)
  })

  it('setSelectedSite changes the value', async () => {
    render(
      <SiteProvider>
        <TestConsumer />
      </SiteProvider>,
    )
    await act(async () => {
      screen.getByText('switch to rooms').click()
    })
    expect(screen.getByTestId('site')).toHaveTextContent('rooms')
    const rooms = SITES.find((s) => s.id === 'rooms')!
    expect(screen.getByTestId('config-label')).toHaveTextContent(rooms.label)
  })

  it('persists selected site to localStorage', async () => {
    render(
      <SiteProvider>
        <TestConsumer />
      </SiteProvider>,
    )
    await act(async () => {
      screen.getByText('switch to costs').click()
    })
    expect(localStorage.getItem('agent_selected_site')).toBe('costs')
  })

  it('reads initial value from localStorage', () => {
    localStorage.setItem('agent_selected_site', 'rooms')
    render(
      <SiteProvider>
        <TestConsumer />
      </SiteProvider>,
    )
    expect(screen.getByTestId('site')).toHaveTextContent('rooms')
  })

  it('throws when useSite is used outside SiteProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow(
      'useSite must be used within a SiteProvider',
    )
    spy.mockRestore()
  })
})
