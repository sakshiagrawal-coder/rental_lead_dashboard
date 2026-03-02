import { useState } from 'react'
import type { LeadSummary, LeadFilters } from '../types'
import { updateLead } from '../api'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth, canEdit } from '../AuthContext'

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-gray-100 text-gray-700',
  Contacted: 'bg-blue-100 text-blue-700',
  'Quote Shared': 'bg-amber-100 text-amber-700',
  Converted: 'bg-green-100 text-green-700',
  Closed: 'bg-red-100 text-red-700',
  'Not Responded': 'bg-purple-100 text-purple-700',
}

const STATUSES = ['Open', 'Contacted', 'Not Responded', 'Quote Shared', 'Converted', 'Closed']

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'Open'
  const cls = STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s}</span>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  leads: LeadSummary[]
  filters: LeadFilters
  onSort: (col: string) => void
  onSelect: (id: number) => void
  selectedId: number | null
}

function SortHeader({ col, label, filters, onSort, center }: { col: string; label: string; filters: LeadFilters; onSort: (c: string) => void; center?: boolean }) {
  const active = filters.sort_by === col
  const arrow = active ? (filters.sort_order === 'asc' ? ' \u25B2' : ' \u25BC') : ''
  return (
    <th
      className={`px-3 py-2.5 ${center ? 'text-center' : 'text-left'} text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 whitespace-nowrap`}
      onClick={() => onSort(col)}
    >
      {label}{arrow}
    </th>
  )
}

function InlineCommentInput({ leadId, currentRemarks, assignedTo }: { leadId: number; currentRemarks: string | null; assignedTo: string | null }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [value, setValue] = useState(currentRemarks ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const trimmed = value.trim()
    if (trimmed === (currentRemarks ?? '')) return
    setSaving(true)
    try {
      await updateLead(leadId, { internal_remarks: trimmed || null })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit(user, assignedTo)) {
    return <span className="text-sm text-gray-500 truncate" title={currentRemarks ?? ''}>{currentRemarks ?? '-'}</span>
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      placeholder="-"
      className={`w-full text-sm text-gray-500 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:ring-0 px-0 py-0 outline-none ${saving ? 'opacity-50' : ''}`}
    />
  )
}

function InlineStatusDropdown({ leadId, currentStatus, assignedTo }: { leadId: number; currentStatus: string | null; assignedTo: string | null }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [changing, setChanging] = useState(false)
  const s = currentStatus ?? 'Open'

  if (!canEdit(user, assignedTo)) {
    return <StatusBadge status={s} />
  }

  const handleChange = async (newStatus: string) => {
    if (newStatus === s) return
    setChanging(true)
    try {
      await updateLead(leadId, { status: newStatus })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['pipelineCounts'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
    } finally {
      setChanging(false)
    }
  }

  return (
    <select
      value={s}
      onChange={(e) => { e.stopPropagation(); handleChange(e.target.value) }}
      onClick={(e) => e.stopPropagation()}
      disabled={changing}
      className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-teal-300 ${STATUS_COLORS[s] ?? 'bg-gray-100'} ${changing ? 'opacity-50' : ''}`}
    >
      {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
    </select>
  )
}

export default function LeadTable({ leads, filters, onSort, onSelect, selectedId }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed">
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col className="w-[280px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          <tr>
            <SortHeader col="name" label="Lead" filters={filters} onSort={onSort} />
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Route</th>
            <SortHeader col="start_date_time" label="Start Date" filters={filters} onSort={onSort} center />
            <SortHeader col="end_date_time" label="End Date" filters={filters} onSort={onSort} center />
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            <SortHeader col="created" label="Created" filters={filters} onSort={onSort} center />
            <SortHeader col="modified" label="Modified" filters={filters} onSort={onSort} center />
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Agent</th>
            <SortHeader col="amount_quote" label="Quote" filters={filters} onSort={onSort} center />
            <SortHeader col="source" label="Source" filters={filters} onSort={onSort} center />
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Comments</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
              <tr
                key={l.id}
                onClick={() => onSelect(l.id)}
                className={`cursor-pointer border-b border-gray-50 hover:bg-teal-50/30 transition-colors ${selectedId === l.id ? 'bg-teal-50/50' : ''}`}
              >
                <td className="px-3 py-2.5">
                  <div className="text-sm font-semibold text-gray-900 truncate">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.mobile_number}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-sm text-gray-600 truncate" title={`${l.origin} → ${l.destination}`}>
                    {l.origin.split(',')[0]} → {l.destination.split(',')[0]}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap text-center">{fmtDate(l.start_date_time)}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap text-center">{fmtDate(l.end_date_time)}</td>
                <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <InlineStatusDropdown leadId={l.id} currentStatus={l.status} assignedTo={l.assigned_to_email_id} />
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap text-center">{fmtDate(l.created)}</td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap text-center">{fmtDate(l.modified)}</td>
                <td className="px-3 py-2.5 text-sm font-semibold text-teal-700 whitespace-nowrap text-center">{l.assigned_to_email_id?.split('@')[0]}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600 text-center">{l.amount_quote ? `Rs ${l.amount_quote.toLocaleString('en-IN')}` : '-'}</td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap text-center">{l.source ?? '-'}</td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <InlineCommentInput leadId={l.id} currentRemarks={l.internal_remarks} assignedTo={l.assigned_to_email_id} />
                </td>
              </tr>
          ))}
          {leads.length === 0 && (
            <tr><td colSpan={11} className="px-3 py-12 text-center text-sm text-gray-400">No leads found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export { STATUS_COLORS, StatusBadge }
