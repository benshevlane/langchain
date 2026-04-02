import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoalCard } from '../GoalCard'
import type { CampaignGoal } from '../../../types/database'

const baseGoal: CampaignGoal = {
  id: 'g1',
  goal_id: 'goal_backlinks',
  description: 'Acquire 50 backlinks',
  metric: 'total_backlinks',
  current_value: 12,
  target_3m: '50',
  target_6m: '100',
  target_12m: '200',
  last_measured_at: '2025-06-01',
  notes: '',
  updated_at: '2025-06-01',
  created_at: '2025-01-01',
}

describe('GoalCard', () => {
  it('renders goal description and metric', () => {
    render(<GoalCard goal={baseGoal} onUpdate={vi.fn()} saving={false} />)
    expect(screen.getByText('Acquire 50 backlinks')).toBeInTheDocument()
    expect(screen.getByText('total_backlinks')).toBeInTheDocument()
  })

  it('shows a status badge', () => {
    render(<GoalCard goal={baseGoal} onUpdate={vi.fn()} saving={false} />)
    // 12/50 = 24% => "Critical"
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('shows "On track" badge when progress >= 75%', () => {
    const goal = { ...baseGoal, current_value: 40 }
    render(<GoalCard goal={goal} onUpdate={vi.fn()} saving={false} />)
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('shows "No target" badge when target is null', () => {
    const goal = { ...baseGoal, target_3m: null }
    render(<GoalCard goal={goal} onUpdate={vi.fn()} saving={false} />)
    expect(screen.getByText('No target')).toBeInTheDocument()
  })

  it('toggles edit form when edit button is clicked', async () => {
    render(<GoalCard goal={baseGoal} onUpdate={vi.fn()} saving={false} />)
    // Edit button is the one with the SVG pencil icon
    const editBtn = screen.getByRole('button')
    await userEvent.click(editBtn)

    // Edit form should show target input labels
    expect(screen.getByText('3 month')).toBeInTheDocument()
    expect(screen.getByText('6 month')).toBeInTheDocument()
    expect(screen.getByText('12 month')).toBeInTheDocument()

    // Click edit again to close
    await userEvent.click(editBtn)
    expect(screen.queryByText('3 month')).not.toBeInTheDocument()
  })

  it('calls onUpdate when Save is clicked in edit form', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<GoalCard goal={baseGoal} onUpdate={onUpdate} saving={false} />)

    // Open edit form
    await userEvent.click(screen.getByRole('button'))

    // Click Save
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onUpdate).toHaveBeenCalledWith('g1', {
      target_3m: '50',
      target_6m: '100',
      target_12m: '200',
    })
  })

  it('shows "Saving..." when saving prop is true', async () => {
    render(<GoalCard goal={baseGoal} onUpdate={vi.fn()} saving={true} />)
    // Open edit form
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })

  it('renders last measured date', () => {
    render(<GoalCard goal={baseGoal} onUpdate={vi.fn()} saving={false} />)
    expect(screen.getByText(/last measured/i)).toBeInTheDocument()
  })
})
