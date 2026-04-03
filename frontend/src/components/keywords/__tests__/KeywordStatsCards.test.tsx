import { render, screen } from '@testing-library/react'
import { KeywordStatsCards } from '../KeywordStatsCards'
import type { RankingEntry } from '../../../types/database'

describe('KeywordStatsCards', () => {
  it('renders all 4 stat card labels', () => {
    render(<KeywordStatsCards data={[]} />)
    expect(screen.getByText('Total Keywords')).toBeInTheDocument()
    expect(screen.getByText('Avg Position')).toBeInTheDocument()
    expect(screen.getByText('Top 10')).toBeInTheDocument()
    expect(screen.getByText('Biggest Mover')).toBeInTheDocument()
  })

  it('shows 0 for total keywords when data is empty', () => {
    render(<KeywordStatsCards data={[]} />)
    // "Total Keywords" card should show 0
    const totalKeywords = screen.getByText('Total Keywords').closest('div')!
    expect(totalKeywords.parentElement).toHaveTextContent('0')
  })

  it('shows dash for avg position when data is empty', () => {
    render(<KeywordStatsCards data={[]} />)
    const avgCard = screen.getByText('Avg Position').closest('div')!
    expect(avgCard.parentElement).toHaveTextContent('—')
  })

  it('shows dash for biggest mover when data is empty', () => {
    render(<KeywordStatsCards data={[]} />)
    const moverCard = screen.getByText('Biggest Mover').closest('div')!
    expect(moverCard.parentElement).toHaveTextContent('—')
  })

  it('computes stats correctly with data', () => {
    const data: RankingEntry[] = [
      {
        id: '1',
        target_site: 'test',
        keyword: 'kitchen planner',
        position: 5,
        url: 'https://example.com/page1',
        previous_position: 8,
        change: 3,
        volume: 1000,
        snapshot_date: '2025-01-01',
        created_at: '2025-01-01',
      },
      {
        id: '2',
        target_site: 'test',
        keyword: 'room design',
        position: 15,
        url: 'https://example.com/page2',
        previous_position: 20,
        change: 5,
        volume: 500,
        snapshot_date: '2025-01-01',
        created_at: '2025-01-01',
      },
    ]
    render(<KeywordStatsCards data={data} />)

    // 2 unique keywords
    const totalCard = screen.getByText('Total Keywords').closest('div')!
    expect(totalCard.parentElement).toHaveTextContent('2')

    // Top 10: only "kitchen planner" at position 5
    const top10Card = screen.getByText('Top 10').closest('div')!
    expect(top10Card.parentElement).toHaveTextContent('1')
  })
})
