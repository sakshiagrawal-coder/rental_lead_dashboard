import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLeads, fetchFilterOptions, createLead } from '../api'
import type { LeadFilters } from '../types'
import PipelineCards from '../components/PipelineCards'
import Filters from '../components/Filters'
import LeadTable from '../components/LeadTable'
import Pagination from '../components/Pagination'
import LeadDetailPanel from '../components/LeadDetailPanel'
import { useAuth } from '../AuthContext'

const SOURCES = ['Website', 'Google', 'Referral', 'WhatsApp', 'Call', 'Meta', 'Operator']
const LEAD_TYPES = ['Corporate', 'Wedding', 'School', 'Personal', 'Event']
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Tempo Traveller', 'Mini Bus', 'Bus']

interface AddLeadFormData {
  name: string
  mobile_number: string
  email: string
  origin: string
  destination: string
  start_date_time: string
  end_date_time: string
  number_of_passengers: string
  source: string
  lead_type: string
  vehicle_type_requirement: string
  assigned_to_email_id: string
  amount_quote: string
  additional_comment: string
  internal_remarks: string
}

const EMPTY_FORM: AddLeadFormData = {
  name: '', mobile_number: '', email: '', origin: '', destination: '',
  start_date_time: '', end_date_time: '', number_of_passengers: '',
  source: '', lead_type: '', vehicle_type_requirement: '',
  assigned_to_email_id: '', amount_quote: '', additional_comment: '', internal_remarks: '',
}

const REQUIRED: (keyof AddLeadFormData)[] = ['name', 'mobile_number', 'email', 'origin', 'destination', 'start_date_time', 'end_date_time', 'assigned_to_email_id']

function AddLeadModal({ assignees, onClose, onCreated }: { assignees: string[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<AddLeadFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Set<string>>(new Set())

  const set = (field: keyof AddLeadFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => { const n = new Set(e); n.delete(field); return n })
  }

  const handleSubmit = async () => {
    const missing = REQUIRED.filter((k) => !form[k].trim())
    if (missing.length > 0) {
      setErrors(new Set(missing))
      return
    }
    setSaving(true)
    try {
      await createLead({
        ...form,
        number_of_passengers: form.number_of_passengers ? parseInt(form.number_of_passengers) : null,
        amount_quote: form.amount_quote ? parseFloat(form.amount_quote) : null,
      })
      onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = (field: keyof AddLeadFormData) =>
    `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-teal-400 ${errors.has(field) ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`
  const labelCls = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1'
  const required = (field: keyof AddLeadFormData) => REQUIRED.includes(field) ? <span className="text-red-400 ml-0.5">*</span> : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[640px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name{required('name')}</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls('name')} placeholder="Client name" />
            </div>
            <div>
              <label className={labelCls}>Mobile{required('mobile_number')}</label>
              <input value={form.mobile_number} onChange={(e) => set('mobile_number', e.target.value)} className={inputCls('mobile_number')} placeholder="10-digit mobile" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email{required('email')}</label>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls('email')} placeholder="client@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Origin{required('origin')}</label>
              <input value={form.origin} onChange={(e) => set('origin', e.target.value)} className={inputCls('origin')} placeholder="Pickup location" />
            </div>
            <div>
              <label className={labelCls}>Destination{required('destination')}</label>
              <input value={form.destination} onChange={(e) => set('destination', e.target.value)} className={inputCls('destination')} placeholder="Drop location" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date & Time{required('start_date_time')}</label>
              <input type="datetime-local" value={form.start_date_time} onChange={(e) => set('start_date_time', e.target.value)} className={inputCls('start_date_time')} />
            </div>
            <div>
              <label className={labelCls}>End Date & Time{required('end_date_time')}</label>
              <input type="datetime-local" value={form.end_date_time} onChange={(e) => set('end_date_time', e.target.value)} className={inputCls('end_date_time')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Source</label>
              <select value={form.source} onChange={(e) => set('source', e.target.value)} className={inputCls('source')}>
                <option value="">Select...</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Lead Type</label>
              <select value={form.lead_type} onChange={(e) => set('lead_type', e.target.value)} className={inputCls('lead_type')}>
                <option value="">Select...</option>
                {LEAD_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vehicle Type</label>
              <select value={form.vehicle_type_requirement} onChange={(e) => set('vehicle_type_requirement', e.target.value)} className={inputCls('vehicle_type_requirement')}>
                <option value="">Select...</option>
                {VEHICLE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Agent{required('assigned_to_email_id')}</label>
              <select value={form.assigned_to_email_id} onChange={(e) => set('assigned_to_email_id', e.target.value)} className={inputCls('assigned_to_email_id')}>
                <option value="">Select...</option>
                {assignees.map((s) => <option key={s} value={s}>{s.split('@')[0]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Passengers</label>
              <input type="number" value={form.number_of_passengers} onChange={(e) => set('number_of_passengers', e.target.value)} className={inputCls('number_of_passengers')} placeholder="e.g. 20" />
            </div>
            <div>
              <label className={labelCls}>Quote Amount</label>
              <input type="number" value={form.amount_quote} onChange={(e) => set('amount_quote', e.target.value)} className={inputCls('amount_quote')} placeholder="Rs" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Additional Comment</label>
            <textarea value={form.additional_comment} onChange={(e) => set('additional_comment', e.target.value)} className={`${inputCls('additional_comment')} resize-none`} rows={2} placeholder="Any special requirements..." />
          </div>
          <div>
            <label className={labelCls}>Internal Remarks</label>
            <textarea value={form.internal_remarks} onChange={(e) => set('internal_remarks', e.target.value)} className={`${inputCls('internal_remarks')} resize-none`} rows={2} placeholder="Internal notes..." />
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-[11px] text-gray-400"><span className="text-red-400">*</span> Required fields</span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 rounded hover:bg-teal-700 transition-colors disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function oneMonthLaterStr() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

const DEFAULT_FILTERS: LeadFilters = {
  search: '',
  status: '',
  source: '',
  assigned_to: '',
  lead_type: '',
  ops_assignee: '',
  start_date_from: todayStr(),
  start_date_to: oneMonthLaterStr(),
  created_from: '',
  created_to: '',
  sort_by: 'modified',
  sort_order: 'desc',
  page: 1,
  attention: false,
}

export default function LeadsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<LeadFilters>(() => ({
    ...DEFAULT_FILTERS,
    assigned_to: user.role === 'agent' ? user.email : '',
  }))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAddLead, setShowAddLead] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filters],
    queryFn: () => fetchLeads(filters),
    placeholderData: (prev) => prev,
  })

  const { data: filterOpts } = useQuery({ queryKey: ['filterOptions'], queryFn: fetchFilterOptions })

  const updateFilters = useCallback((patch: Partial<LeadFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
  }, [])

  const handleSort = useCallback((col: string) => {
    setFilters((f) => ({
      ...f,
      sort_by: col,
      sort_order: f.sort_by === col && f.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }, [])

  const handleStatusClick = (status: string) => {
    setFilters((f) => ({
      ...f,
      status: f.status === status ? '' : status,
      page: 1,
    }))
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0

  const viewLabel = filters.status ? filters.status : 'All Leads'

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center border-b border-gray-100">
          <div className="flex-1">
            <Filters filters={filters} onChange={updateFilters} />
          </div>
          {user.role !== 'billing' && (
            <button
              onClick={() => setShowAddLead(true)}
              className="mr-6 px-4 py-1.5 text-sm font-semibold text-white bg-teal-600 rounded hover:bg-teal-700 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span className="text-base leading-none">+</span> Add Lead
            </button>
          )}
        </div>
        <PipelineCards
          activeStatus={filters.status}
          onStatusClick={handleStatusClick}
          filters={filters}
        />

        {/* View context bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-teal-500 rounded-full" />
            <span className="text-sm font-semibold text-gray-700">{viewLabel}</span>
            <span className="text-[11px] text-gray-400">{data?.total ?? 0} leads</span>
          </div>
          {(filters.status || filters.search || filters.source || filters.assigned_to) && (
            <button
              onClick={() => setFilters({ ...DEFAULT_FILTERS, attention: false, status: '' })}
              className="text-xs text-teal-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading && !data ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
          ) : (
            <LeadTable
              leads={data?.items ?? []}
              filters={filters}
              onSort={handleSort}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
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
      {showAddLead && (
        <AddLeadModal
          assignees={filterOpts?.assigned_to ?? []}
          onClose={() => setShowAddLead(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['leads'] })
            queryClient.invalidateQueries({ queryKey: ['pipelineCounts'] })
            queryClient.invalidateQueries({ queryKey: ['filterOptions'] })
          }}
        />
      )}
    </div>
  )
}
