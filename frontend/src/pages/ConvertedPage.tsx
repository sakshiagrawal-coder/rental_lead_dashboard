import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLeads, updateLead, fetchFilterOptions, fetchConvertedStats, fetchOperatorMaster, addOperator, updateOperator } from '../api'
import type { OperatorOption } from '../api'
import type { LeadFilters, LeadSummary } from '../types'
import Pagination from '../components/Pagination'
import LeadDetailPanel from '../components/LeadDetailPanel'
import { useAuth, canEdit } from '../AuthContext'

function fmtDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateShort(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function fmtAmt(n: number | null) {
  if (n == null || n === 0) return '-'
  return n.toLocaleString('en-IN')
}

function fmtAmtFull(n: number) {
  return `Rs ${n.toLocaleString('en-IN')}`
}

function grossAmt(net: number | null): number | null {
  if (net == null) return null
  return Math.round(net * 1.05)
}

function exportCSV(items: LeadSummary[]) {
  const headers = [
    'Agent', 'Client', 'GST/Aadhaar', 'Origin', 'Destination', 'Start Date', 'End Date', 'Net Amount', 'Gross Amount',
    'Operator', 'Operator PAN', 'Vehicle No', 'GST Rate', 'Net Cost', 'Gross Cost', 'Profit',
  ]
  const rows = items.map((l) => [
    l.assigned_to_email_id?.split('@')[0] ?? '',
    l.name, l.gst_aadhaar_number ?? '',
    l.origin, l.destination,
    fmtDate(l.start_date_time), fmtDate(l.end_date_time),
    l.amount_cityflo ?? '', grossAmt(l.amount_cityflo) ?? '',
    l.operator_names, '', l.vehicle_numbers, '',
    l.operator_amount || '', l.operator_amount ? Math.round(l.operator_amount * 1.05) : '',
    (l.amount_cityflo ?? 0) - l.operator_amount,
  ])
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `billing-sheet-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function pad(n: number) { return String(n).padStart(2, '0') }
function firstOfMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}
function lastOfMonthStr() {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`
}

const DEFAULT_FILTERS: LeadFilters = {
  search: '',
  status: 'Converted',
  source: '',
  assigned_to: '',
  lead_type: '',
  ops_assignee: '',
  start_date_from: firstOfMonthStr(),
  start_date_to: lastOfMonthStr(),
  created_from: '',
  created_to: '',
  sort_by: 'start_date_time',
  sort_order: 'asc',
  page: 1,
}

/* ── Inline editable components ── */

function InlineAmountInput({ leadId, value, readOnly }: { leadId: number; value: number | null; readOnly?: boolean }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)

  if (readOnly) {
    return <span className="text-[13px] font-semibold text-gray-800">{value != null ? fmtAmt(value) : '-'}</span>
  }

  const save = async () => {
    const num = parseFloat(draft.replace(/,/g, '')) || 0
    if (num === (value ?? 0)) return
    setSaving(true)
    try {
      await updateLead(leadId, { amount_cityflo: num, amount_quote: Math.round(num * 1.05) })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['convertedStats'] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onClick={(e) => e.stopPropagation()}
      className={`w-full bg-transparent text-center font-semibold text-gray-800 text-[13px] border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 ${saving ? 'opacity-50' : ''}`}
    />
  )
}

function InlineCostInput({ leadId, operatorId, value, readOnly }: { leadId: number; operatorId: number | null; value: number; readOnly?: boolean }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(value ? String(value) : '')
  const [saving, setSaving] = useState(false)

  if (readOnly) {
    return <span className="text-[13px] font-semibold text-gray-800">{value > 0 ? fmtAmt(value) : '-'}</span>
  }

  const save = async () => {
    const num = parseFloat(draft.replace(/,/g, '')) || 0
    if (num === value || !operatorId) return
    setSaving(true)
    try {
      await updateOperator(leadId, operatorId, { operator_amount: num })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['convertedStats'] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onClick={(e) => e.stopPropagation()}
      disabled={!operatorId}
      className={`w-full bg-transparent text-center font-semibold text-gray-800 text-[13px] border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 ${saving ? 'opacity-50' : ''} ${!operatorId ? 'opacity-30' : ''}`}
    />
  )
}

function getGstMultiplier(gstRate: string): number {
  if (gstRate === '5%') return 1.05
  if (gstRate === '18%') return 1.18
  return 1
}

function InlineOperatorSelect({ leadId, operatorId, currentName, master, readOnly }: {
  leadId: number; operatorId: number | null; currentName: string; master: OperatorOption[]; readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSelectElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  if (readOnly) {
    return <span className="text-[13px] text-gray-700">{currentName || '-'}</span>
  }

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 2, left: rect.left })
    }
    setOpen(!open)
  }

  const handleSelect = async (name: string) => {
    if (name === currentName) { setOpen(false); setSearch(''); return }
    setSaving(true)
    setOpen(false)
    setSearch('')
    try {
      if (operatorId) {
        await updateOperator(leadId, operatorId, { operator_name: name, vehicle_number: null })
      } else {
        await addOperator(leadId, { operator_name: name })
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['convertedStats'] })
    } finally {
      setSaving(false)
    }
  }

  const filtered = master.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <select
        ref={triggerRef}
        value={currentName}
        onChange={() => {}}
        onMouseDown={(e) => { e.preventDefault(); handleOpen() }}
        disabled={saving}
        className={`w-full bg-transparent text-[13px] text-gray-700 border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none cursor-pointer px-0 py-0 ${saving ? 'opacity-50' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">Select...</option>
        {master.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
      </select>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-52 bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          <div className="p-1.5 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search operator..."
              className="w-full px-2 py-1.5 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button type="button" onClick={() => handleSelect('')}
              className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-50">Clear</button>
            {filtered.map((o) => (
              <button key={o.name} type="button" onClick={() => handleSelect(o.name)}
                className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-teal-50 ${o.name === currentName ? 'text-teal-700 font-semibold bg-teal-50' : 'text-gray-700'}`}
              >{o.name}</button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-[12px] text-gray-400">No match</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function MultiVehicleSelect({ leadId, operatorId, currentVehicles, currentOperator, master, readOnly }: {
  leadId: number; operatorId: number | null; currentVehicles: string; currentOperator: string; master: OperatorOption[]; readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSelectElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = currentVehicles ? currentVehicles.split(',').map((v) => v.trim()).filter(Boolean) : []
  const vehicles = master.find((o) => o.name === currentOperator)?.vehicles ?? []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  if (readOnly) {
    return <span className="text-[13px] text-gray-600">{selected.length > 0 ? selected.join(', ') : '-'}</span>
  }

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 2, left: rect.left })
    }
    setOpen(!open)
    setSearch('')
  }

  const toggle = async (vehicle: string) => {
    if (!operatorId) return
    const next = selected.includes(vehicle)
      ? selected.filter((v) => v !== vehicle)
      : [...selected, vehicle]
    setSaving(true)
    try {
      await updateOperator(leadId, operatorId, { vehicle_number: next.join(', ') })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    } finally {
      setSaving(false)
    }
  }

  const clearAll = async () => {
    if (!operatorId) return
    setSaving(true)
    setOpen(false); setSearch('')
    try {
      await updateOperator(leadId, operatorId, { vehicle_number: '' })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    } finally {
      setSaving(false)
    }
  }

  const display = selected.length > 0 ? selected.join(', ') : 'Select...'
  const filtered = vehicles.filter((v) => v.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <select
        ref={triggerRef}
        value=""
        onChange={() => {}}
        onMouseDown={(e) => { e.preventDefault(); currentOperator && handleOpen() }}
        disabled={!currentOperator}
        className={`w-full bg-transparent text-[13px] border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none cursor-pointer px-0 py-0 ${!currentOperator ? 'opacity-30 text-gray-400' : selected.length > 0 ? 'text-gray-600' : 'text-gray-400'} ${saving ? 'opacity-50' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">{display}</option>
      </select>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-52 bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          <div className="p-1.5 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle..."
              className="w-full px-2 py-1.5 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button type="button" onClick={clearAll}
              className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-50">Clear</button>
            {filtered.map((v) => (
              <label key={v} className={`flex items-center gap-2 px-3 py-1.5 hover:bg-teal-50 cursor-pointer text-[13px] ${selected.includes(v) ? 'text-teal-700 font-semibold bg-teal-50' : 'text-gray-700'}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(v)}
                  onChange={() => toggle(v)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                {v}
              </label>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-[12px] text-gray-400">No match</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export default function ConvertedPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filters],
    queryFn: () => fetchLeads(filters),
    placeholderData: (prev) => prev,
  })

  const statsFilters = { search: filters.search, assigned_to: filters.assigned_to, source: filters.source, start_date_from: filters.start_date_from, start_date_to: filters.start_date_to }
  const { data: stats } = useQuery({ queryKey: ['convertedStats', statsFilters], queryFn: () => fetchConvertedStats(statsFilters), refetchInterval: 5000 })
  const { data: filterOpts } = useQuery({ queryKey: ['filterOptions'], queryFn: fetchFilterOptions })
  const { data: operatorMaster } = useQuery({ queryKey: ['operatorMaster'], queryFn: fetchOperatorMaster })

  const updateFilters = useCallback((patch: Partial<LeadFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
  }, [])

  const filteredItems = data?.items ?? []

  const getOperatorPan = (opName: string) => {
    if (!operatorMaster || !opName) return '-'
    return operatorMaster.find((o) => o.name === opName)?.pan ?? '-'
  }

  const getOperatorGst = (opName: string) => {
    if (!operatorMaster || !opName) return '-'
    return operatorMaster.find((o) => o.name === opName)?.gstRate ?? '-'
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0

  const thL = 'px-2 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate overflow-hidden'
  const thC = 'px-2 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate overflow-hidden'

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search name / mobile..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value, page: 1 })}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-teal-400"
          />
          <select
            value={filters.assigned_to}
            onChange={(e) => updateFilters({ assigned_to: e.target.value, page: 1 })}
            className="border border-gray-200 rounded px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-teal-400"
          >
            <option value="">All Agents</option>
            {filterOpts?.assigned_to.map((s) => <option key={s} value={s}>{s.split('@')[0]}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <span>Trip</span>
            <input type="date" value={filters.start_date_from}
              onChange={(e) => updateFilters({ start_date_from: e.target.value, page: 1 })}
              className="border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
            <span>—</span>
            <input type="date" value={filters.start_date_to}
              onChange={(e) => updateFilters({ start_date_to: e.target.value, page: 1 })}
              className="border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <button
            onClick={() => exportCSV(data?.items ?? [])}
            className="ml-auto px-3 py-1.5 text-sm font-medium text-teal-600 border border-teal-300 rounded hover:bg-teal-50 transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* Summary cards */}
        {stats && (
          <div className="flex gap-4 px-6 py-4 border-b border-gray-100" style={{ width: '66%' }}>
            {[
              { label: 'Total Revenue', value: fmtAmtFull(stats.totalRevenue), color: 'text-green-600', accent: 'stat-accent-green' },
              { label: 'Total Cost', value: fmtAmtFull(stats.totalCost), color: 'text-red-600', accent: 'stat-accent-gray' },
              { label: 'Margin', value: fmtAmtFull(stats.totalMargin), color: stats.totalMargin >= 0 ? 'text-teal-600' : 'text-red-600', accent: 'stat-accent-teal', sub: stats.totalRevenue > 0 ? `${Math.round(stats.totalMargin / stats.totalRevenue * 100)}%` : '' },
            ].map((card) => (
              <div key={card.label} className={`stat-accent ${card.accent} flex-1 rounded-lg border border-gray-100 px-5 py-4`}>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-1">{card.label}</div>
                <div className={`text-2xl font-bold tracking-tight ${card.color}`}>{card.value}</div>
                {card.sub && <div className="text-sm text-gray-400 mt-0.5">{card.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Billing sheet table */}
        <div className="flex-1 overflow-auto">
          {isLoading && !data ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
          ) : (
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                {Array.from({ length: 17 }).map((_, i) => <col key={i} style={{ width: `${100 / 17}%` }} />)}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-white">
                {/* Group headers */}
                <tr className="border-b border-gray-200">
                  <th colSpan={10} className="px-3 py-1.5 text-left text-[10px] font-bold text-teal-700 uppercase tracking-[0.15em] bg-teal-50/50 border-r border-gray-200">Client</th>
                  <th colSpan={7} className="px-3 py-1.5 text-left text-[10px] font-bold text-orange-700 uppercase tracking-[0.15em] bg-orange-50/50">Operator</th>
                </tr>
                {/* Column headers */}
                <tr className="border-b border-gray-200">
                  {/* Client */}
                  <th className={thC}>Conv. Date</th>
                  <th className={thL}>Agent</th>
                  <th className={thL}>Client</th>
                  <th className={thC}>GST / Aadhaar</th>
                  <th className={thC}>Origin</th>
                  <th className={thC}>Destination</th>
                  <th className={thC}>Start Date</th>
                  <th className={thC}>End Date</th>
                  <th className={thC}>Net Amt</th>
                  <th className={`${thC} border-r border-gray-200`}>Gross Amt</th>
                  {/* Operator */}
                  <th className={thL}>Operator</th>
                  <th className={thC}>Op PAN</th>
                  <th className={thL}>Vehicle No</th>
                  <th className={thC}>GST Rate</th>
                  <th className={thC}>Net Cost</th>
                  <th className={thC}>Gross Cost</th>
                  <th className={thC}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((l: LeadSummary) => {
                  const primaryOp = l.operator_names.split(',')[0]?.trim() ?? ''
                  const ro = !canEdit(user, l.assigned_to_email_id)
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={`cursor-pointer border-b border-gray-50 hover:bg-teal-50/30 transition-colors text-[13px] ${selectedId === l.id ? 'bg-teal-50/50' : ''}`}
                    >
                      {/* Converted Date */}
                      <td className="px-2 py-2.5 text-center text-gray-600 truncate overflow-hidden">{fmtDateShort(l.modified)}</td>
                      {/* Agent */}
                      <td className="px-2 py-2.5 text-sm font-semibold text-teal-700 truncate overflow-hidden">{l.assigned_to_email_id?.split('@')[0]}</td>
                      {/* Client */}
                      <td className="px-2 py-2.5 overflow-hidden">
                        <div className="text-sm font-semibold text-gray-900 truncate">{l.name}</div>
                        <div className="text-[11px] text-gray-400 truncate">{l.mobile_number}</div>
                      </td>
                      {/* GST / Aadhaar */}
                      <td className="px-2 py-2.5 text-center text-gray-500 text-[12px] truncate overflow-hidden" title={l.gst_aadhaar_number ?? ''}>{l.gst_aadhaar_number ?? '-'}</td>
                      {/* Origin */}
                      <td className="px-2 py-2.5 text-center text-gray-600 truncate overflow-hidden" title={l.origin}>{l.origin.split(',')[0]}</td>
                      {/* Destination */}
                      <td className="px-2 py-2.5 text-center text-gray-600 truncate overflow-hidden" title={l.destination}>{l.destination.split(',')[0]}</td>
                      {/* Start Date */}
                      <td className="px-2 py-2.5 text-center text-gray-600 truncate overflow-hidden">{fmtDateShort(l.start_date_time)}</td>
                      {/* End Date */}
                      <td className="px-2 py-2.5 text-center text-gray-600 truncate overflow-hidden">{fmtDateShort(l.end_date_time)}</td>
                      {/* Net Amount (editable) */}
                      <td className="px-2 py-2.5 text-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <InlineAmountInput leadId={l.id} value={l.amount_cityflo} readOnly={ro} />
                      </td>
                      {/* Gross Amount */}
                      <td className="px-2 py-2.5 text-center text-gray-600 border-r border-gray-100 truncate overflow-hidden">{fmtAmt(grossAmt(l.amount_cityflo))}</td>
                      {/* Operator (dropdown) */}
                      <td className="px-2 py-2.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {operatorMaster ? (
                          <InlineOperatorSelect
                            leadId={l.id}
                            operatorId={l.first_operator_id}
                            currentName={primaryOp}
                            master={operatorMaster}
                            readOnly={ro}
                          />
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      {/* Operator PAN */}
                      <td className="px-2 py-2.5 text-center text-[12px] text-gray-500 truncate overflow-hidden">{getOperatorPan(primaryOp)}</td>
                      {/* Vehicle No (multi-select dropdown) */}
                      <td className="px-2 py-2.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {operatorMaster ? (
                          <MultiVehicleSelect
                            leadId={l.id}
                            operatorId={l.first_operator_id}
                            currentVehicles={l.vehicle_numbers}
                            currentOperator={primaryOp}
                            master={operatorMaster}
                            readOnly={ro}
                          />
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      {/* GST Rate */}
                      <td className="px-2 py-2.5 text-center text-[12px] text-gray-500 truncate overflow-hidden">{getOperatorGst(primaryOp)}</td>
                      {/* Net Cost (editable) */}
                      <td className="px-2 py-2.5 text-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <InlineCostInput leadId={l.id} operatorId={l.first_operator_id} value={l.operator_amount} readOnly={ro} />
                      </td>
                      {/* Gross Cost (auto from GST) */}
                      <td className="px-2 py-2.5 text-center text-gray-600 truncate overflow-hidden">
                        {l.operator_amount > 0 ? fmtAmt(Math.round(l.operator_amount * getGstMultiplier(getOperatorGst(primaryOp)))) : '-'}
                      </td>
                      {/* Profit = Net Amt - Net Cost */}
                      {(() => {
                        const profit = (l.amount_cityflo ?? 0) - l.operator_amount
                        const hasData = (l.amount_cityflo ?? 0) > 0 || l.operator_amount > 0
                        return (
                          <td className={`px-2 py-2.5 text-center font-bold truncate overflow-hidden ${profit > 0 ? 'text-teal-600' : profit < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {hasData ? fmtAmt(profit) : '-'}
                          </td>
                        )
                      })()}
                    </tr>
                  )
                })}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={17} className="px-4 py-12 text-center text-sm text-gray-400">No converted leads found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {data && totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={totalPages}
            total={data.total}
            onPageChange={(p) => updateFilters({ page: p })}
          />
        )}
      </div>
      {selectedId != null && (
        <LeadDetailPanel
          leadId={selectedId}
          onClose={() => setSelectedId(null)}
          filterOptions={filterOpts ? { assigned_to: filterOpts.assigned_to, ops_assignees: filterOpts.ops_assignees } : undefined}
        />
      )}
    </div>
  )
}
