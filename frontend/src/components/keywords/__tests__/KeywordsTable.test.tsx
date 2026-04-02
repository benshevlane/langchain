import { render, screen } from '@testing-library/react'
import { KeywordsTable } from '../KeywordsTable'

describe('KeywordsTable', () => {
  it('renders column headers', () => {
    render(<KeywordsTable data={[]} />)
    expect(screen.getByText('Keyword')).toBeInTheDocument()
    expect(screen.getByText('Position')).toBeInTheDocument()
    expect(screen.getByText('Change')).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.getByText('URL')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
  })

  it('shows empty state message when no data', () => {
    render(<KeywordsTable data={[]} />)
    expect(screen.getByText('No ranking data available')).toBeInTheDocument()
  })

  it('renders ranking count in title', () => {
    render(<KeywordsTable data={[]} />)
    expect(screen.getByText('Rankings (0)')).toBeInTheDocument()
  })

  it('renders rows when data is provided', () => {
    const data = [
      {
        id: '1',
        target_site: 'test',
        keyword: 'test keyword',
        position: 3,
        url: 'https://example.com/page',
        previous_position: 5,
        change: 2,
        volume: 800,
        snapshot_date: '2025-01-15',
        created_at: '2025-01-15',
      },
    ]
    render(<KeywordsTable data={data} />)
    expect(screen.getByText('test keyword')).toBeInTheDocument()
    expect(screen.queryByText('No ranking data available')).not.toBeInTheDocument()
  })
})
