import { useQuery } from '@tanstack/react-query'
import { fetchFilterOptions } from '../api'
import type { LeadFilters } from '../types'

interface Props {
  filters: LeadFilters
  onChange: (patch: Partial<LeadFilters>) => void
}

const inputCls = 'border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-teal-400'
const selectCls = 'border border-gray-200 rounded px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-teal-400'

export default function Filters({ filters, onChange }: Props) {
  const { data: opts } = useQuery({ queryKey: ['filterOptions'], queryFn: fetchFilterOptions })

  return (
    <div className="flex flex-wrap items-center gap-2.5 px-6 py-3">
      <input
        type="text"
        placeholder="Search name or mobile..."
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value, page: 1 })}
        className={`${inputCls} w-52`}
      />
      <select value={filters.assigned_to} onChange={(e) => onChange({ assigned_to: e.target.value, page: 1 })} className={selectCls}>
        <option value="">All Agents</option>
        {opts?.assigned_to.map((s) => <option key={s} value={s}>{s.split('@')[0]}</option>)}
      </select>
      <div className="flex items-center gap-1.5 text-sm text-gray-400">
        <span>Trip</span>
        <input type="date" value={filters.start_date_from} onChange={(e) => onChange({ start_date_from: e.target.value, page: 1 })} className={inputCls} />
        <span>—</span>
        <input type="date" value={filters.start_date_to} onChange={(e) => onChange({ start_date_to: e.target.value, page: 1 })} className={inputCls} />
      </div>
    </div>
  )
}
