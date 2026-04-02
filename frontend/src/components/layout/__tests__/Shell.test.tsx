import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SiteProvider } from '../../../context/SiteContext'
import { Shell } from '../Shell'

function renderShell(initialRoute = '/agents') {
  return render(
    <SiteProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="agents" element={<div data-testid="child-route">Child Content</div>} />
            <Route path="*" element={<div data-testid="fallback">Fallback</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SiteProvider>,
  )
}

describe('Shell', () => {
  it('renders SiteSwitcher', () => {
    renderShell()
    // SiteSwitcher renders site buttons; check for one of the site labels
    expect(screen.getByText('Kitchens Directory')).toBeInTheDocument()
  })

  it('renders Sidebar with Agent Hub branding', () => {
    renderShell()
    expect(screen.getByText('Agent Hub')).toBeInTheDocument()
  })

  it('renders Header with page title', () => {
    renderShell('/agents')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Agents')
  })

  it('renders Outlet child content', () => {
    renderShell('/agents')
    expect(screen.getByTestId('child-route')).toHaveTextContent('Child Content')
  })
})
