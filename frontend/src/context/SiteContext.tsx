import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface SiteConfig {
  id: string
  label: string
  domain: string
}

export const SITES: SiteConfig[] = [
  { id: 'kitchens', label: 'Kitchens Directory', domain: 'kitchensdirectory.co.uk' },
  { id: 'rooms', label: 'Free Room Planner', domain: 'freeroomplanner.com' },
  { id: 'costs', label: 'Kitchen Cost Estimator', domain: 'kitchencostestimator.com' },
]

const STORAGE_KEY = 'agent_selected_site'

interface SiteContextValue {
  selectedSite: string
  setSelectedSite: (site: string) => void
  siteConfig: SiteConfig
}

const SiteContext = createContext<SiteContextValue | null>(null)

function getInitialSite(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && SITES.some((s) => s.id === stored)) return stored
  } catch {
    // localStorage unavailable
  }
  return 'kitchens'
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [selectedSite, setSelectedSiteState] = useState(getInitialSite)

  const setSelectedSite = (site: string) => {
    setSelectedSiteState(site)
    try {
      localStorage.setItem(STORAGE_KEY, site)
    } catch {
      // localStorage unavailable
    }
  }

  // Sync to localStorage on mount in case initial value changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, selectedSite)
    } catch {
      // localStorage unavailable
    }
  }, [selectedSite])

  const siteConfig = SITES.find((s) => s.id === selectedSite) ?? SITES[0]

  return (
    <SiteContext.Provider value={{ selectedSite, setSelectedSite, siteConfig }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext)
  if (!ctx) {
    const msg = 'useSite must be used within a SiteProvider'
    throw new Error(msg)
  }
  return ctx
}
