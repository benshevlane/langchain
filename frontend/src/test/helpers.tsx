import { render, type RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { SiteProvider } from '../context/SiteContext'
import type { ReactElement } from 'react'

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </SiteProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options })
}
