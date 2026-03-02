import { useQuery } from '@tanstack/react-query'
import { fetchPipelineCounts } from '../api'
import type { LeadFilters } from '../types'

interface Props {
  activeStatus: string
  onStatusClick: (status: string) => void
  filters?: Partial<LeadFilters>
}

const pills = [
  { key: 'open', label: 'Open', status: 'Open', color: 'gray' },
  { key: 'contacted', label: 'Contacted', status: 'Contacted', color: 'blue' },
  { key: 'quoteShared', label: 'Quote Shared', status: 'Quote Shared', color: 'amber' },
  { key: 'notResponded', label: 'Not Responded', status: 'Not Responded', color: 'purple' },
  { key: 'converted', label: 'Converted', status: 'Converted', color: 'green' },
  { key: 'closed', label: 'Closed', status: 'Closed', color: 'red' },
] as const

const ACTIVE_STYLES: Record<string, string> = {
  gray: 'border-gray-400 bg-gray-50 text-gray-700',
  blue: 'border-blue-400 bg-blue-50 text-blue-700',
  amber: 'border-amber-400 bg-amber-50 text-amber-700',
  green: 'border-green-400 bg-green-50 text-green-700',
  red: 'border-red-400 bg-red-50 text-red-600',
  purple: 'border-purple-400 bg-purple-50 text-purple-700',
}

const COUNT_STYLES: Record<string, string> = {
  gray: 'bg-gray-200 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-700',
}

export default function PipelineCards({ activeStatus, onStatusClick, filters }: Props) {
  const { search, assigned_to, source, lead_type, ops_assignee, start_date_from, start_date_to } = filters ?? {}
  const countFilters = { search, assigned_to, source, lead_type, ops_assignee, start_date_from, start_date_to }
  const { data } = useQuery({ queryKey: ['pipelineCounts', countFilters], queryFn: () => fetchPipelineCounts(countFilters), refetchInterval: 5000 })

  if (!data) return null

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100">
      {pills.map((p) => {
        const count = data[p.key as keyof typeof data] as number
        const isActive = activeStatus === p.status
        return (
          <button
            key={p.key}
            onClick={() => onStatusClick(p.status)}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-medium rounded-full border transition-colors ${
              isActive ? ACTIVE_STYLES[p.color] : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {p.label}
            <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center ${isActive ? COUNT_STYLES[p.color] : 'bg-gray-100 text-gray-600'}`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
