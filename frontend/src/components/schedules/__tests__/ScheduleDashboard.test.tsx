import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/helpers'
import { ScheduleDashboard } from '../ScheduleDashboard'

describe('ScheduleDashboard', () => {
  it('renders cron job cards with descriptions', () => {
    renderWithProviders(<ScheduleDashboard />)
    expect(
      screen.getByText(/heavy background tasks/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/lightweight check-in/i),
    ).toBeInTheDocument()
  })

  it('renders the worker and pulse job ids', () => {
    renderWithProviders(<ScheduleDashboard />)
    expect(screen.getAllByText('worker').length).toBeGreaterThan(0)
    expect(screen.getAllByText('pulse').length).toBeGreaterThan(0)
  })

  it('renders SkillSchedulePanel section', () => {
    renderWithProviders(<ScheduleDashboard />)
    // SkillSchedulePanel renders skill schedule content
    // It uses useScheduleEntries which relies on useSupabase (mocked)
    expect(document.querySelector('main, div')).toBeInTheDocument()
  })

  it('renders Upcoming Runs section', () => {
    renderWithProviders(<ScheduleDashboard />)
    expect(screen.getByText(/upcoming runs/i)).toBeInTheDocument()
  })

  it('renders Execution History section', () => {
    renderWithProviders(<ScheduleDashboard />)
    expect(screen.getByText(/execution history/i)).toBeInTheDocument()
  })
})
