import { render } from '@testing-library/react'
import { SkeletonLine, SkeletonCard, SkeletonChart, SkeletonList } from '../Skeleton'

describe('SkeletonLine', () => {
  it('renders an animated div', () => {
    const { container } = render(<SkeletonLine />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('SkeletonCard', () => {
  it('renders', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('SkeletonChart', () => {
  it('renders', () => {
    const { container } = render(<SkeletonChart />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('SkeletonList', () => {
  it('renders the default 5 rows', () => {
    const { container } = render(<SkeletonList />)
    const rows = container.querySelectorAll('.animate-pulse')
    expect(rows).toHaveLength(5)
  })

  it('renders a custom number of rows', () => {
    const { container } = render(<SkeletonList rows={3} />)
    const rows = container.querySelectorAll('.animate-pulse')
    expect(rows).toHaveLength(3)
  })
})
