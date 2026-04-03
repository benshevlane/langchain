import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from '../Table'

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'age', header: 'Age' },
]

const data = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
]

describe('Table', () => {
  it('renders headers and rows', () => {
    render(<Table columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Age')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('shows emptyMessage when data is empty', () => {
    render(<Table columns={columns} data={[]} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('shows default empty message when none provided', () => {
    render(<Table columns={columns} data={[]} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('calls onRowClick when a row is clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Table columns={columns} data={data} onRowClick={handleClick} />)
    await user.click(screen.getByText('Alice'))
    expect(handleClick).toHaveBeenCalledWith(data[0])
  })
})
