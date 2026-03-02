import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchLead, updateLead, fetchLogs } from '../api'
import { StatusBadge } from './LeadTable'
import StatusUpdateModal from './StatusUpdateModal'
import BillingSection from './BillingSection'
import OperatorCostTable from './OperatorCostTable'
import type { LogEntry } from '../types'
import { useAuth, canEdit } from '../AuthContext'

function fmtDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-sm text-gray-900">{value || '-'}</div>
    </div>
  )
}

function LogTimeline({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return <p className="text-xs text-gray-400">No history yet</p>
  return (
    <div className="space-y-2">
      {logs.map((l, i) => (
        <div key={i} className="border-l-2 border-gray-200 pl-3 py-1">
          <div className="text-xs text-gray-400">{fmtDateTime(l.modified)}</div>
          <div className="text-sm">
            Status: <span className="font-medium">{l.status ?? '-'}</span>
            {l.assigned_to_email_id && <span className="text-gray-500 ml-2">Agent: {l.assigned_to_email_id.split('@')[0]}</span>}
          </div>
          {l.reason && <div className="text-xs text-gray-500">Reason: {l.reason}</div>}
          {l.internal_remarks && <div className="text-xs text-gray-500">Remarks: {l.internal_remarks}</div>}
        </div>
      ))}
    </div>
  )
}

interface Props {
  leadId: number
  onClose: () => void
  filterOptions: { assigned_to: string[]; ops_assignees: string[] } | undefined
}

export default function LeadDetailPanel({ leadId, onClose, filterOptions }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', leadId], queryFn: () => fetchLead(leadId) })
  const { data: logs } = useQuery({ queryKey: ['logs', leadId], queryFn: () => fetchLogs(leadId) })
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [editFields, setEditFields] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateLead(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['logs', leadId] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  if (isLoading || !lead) {
    return (
      <div className="w-[480px] border-l bg-white p-6 flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
      </div>
    )
  }

  const handleStatusSave = (status: string, reason: string) => {
    const data: Record<string, unknown> = { status }
    if (reason) data.reason = reason
    mutation.mutate(data)
    setShowStatusModal(false)
  }

  const handleFieldSave = (field: string, value: string) => {
    const data: Record<string, unknown> = {}
    if (['amount_quote', 'amount_cityflo', 'amount_operator'].includes(field)) {
      data[field] = value ? Number(value) : null
    } else {
      data[field] = value || null
    }
    mutation.mutate(data)
    setEditFields((f) => { const n = { ...f }; delete n[field]; return n })
  }

  const readOnly = !canEdit(user, lead.assigned_to_email_id)

  const EditableField = ({ label, field, type = 'text' }: { label: string; field: string; type?: string }) => {
    const val = (lead as unknown as Record<string, unknown>)[field]
    const display = val != null ? String(val) : ''

    if (readOnly) {
      const formatted = (['amount_quote', 'amount_cityflo', 'amount_operator', 'customer_paid_amount'].includes(field) && val != null)
        ? `₹${Number(val).toLocaleString()}`
        : display || '-'
      return <Field label={label} value={formatted} />
    }

    const editing = field in editFields

    if (editing) {
      return (
        <div>
          <span className="text-xs text-gray-500">{label}</span>
          <div className="flex gap-1">
            <input
              type={type}
              value={editFields[field]}
              onChange={(e) => setEditFields((f) => ({ ...f, [field]: e.target.value }))}
              className="flex-1 border rounded px-2 py-1 text-sm"
              autoFocus
            />
            <button onClick={() => handleFieldSave(field, editFields[field])} className="text-xs text-green-600">Save</button>
            <button onClick={() => setEditFields((f) => { const n = { ...f }; delete n[field]; return n })} className="text-xs text-gray-400">Cancel</button>
          </div>
        </div>
      )
    }

    return (
      <div className="cursor-pointer group" onClick={() => setEditFields((f) => ({ ...f, [field]: display }))}>
        <span className="text-xs text-gray-500">{label}</span>
        <div className="text-sm text-gray-900 group-hover:text-indigo-600">
          {(['amount_quote', 'amount_cityflo', 'amount_operator', 'customer_paid_amount'].includes(field) && val != null)
            ? `₹${Number(val).toLocaleString()}`
            : display || '-'}
          <span className="ml-1 text-xs text-gray-300 group-hover:text-indigo-400">edit</span>
        </div>
      </div>
    )
  }

  const SelectField = ({ label, field, options }: { label: string; field: string; options: string[] }) => {
    const val = (lead as unknown as Record<string, unknown>)[field] as string | null
    if (readOnly) {
      return <Field label={label} value={val ? val.split('@')[0] : '-'} />
    }
    return (
      <div>
        <span className="text-xs text-gray-500">{label}</span>
        <select
          value={val ?? ''}
          onChange={(e) => {
            const data: Record<string, unknown> = { [field]: e.target.value || null }
            mutation.mutate(data)
          }}
          className="w-full border rounded px-2 py-1 text-sm"
        >
          <option value="">-</option>
          {options.map((o) => <option key={o} value={o}>{o.split('@')[0]}</option>)}
        </select>
      </div>
    )
  }

  const isConverted = lead.status === 'Converted'

  return (
    <div className="w-[480px] border-l bg-white overflow-y-auto h-[calc(100vh-57px)] flex-shrink-0">
      <div className="sticky top-0 bg-white z-10 px-5 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Lead #{lead.id}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>

      <div className="p-5 space-y-6">
        {/* Section 1: Lead Info */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Lead Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={lead.name} />
            <Field label="Mobile" value={lead.mobile_number} />
            <Field label="Email" value={lead.email} />
            <Field label="Source" value={lead.source} />
            <Field label="Origin" value={lead.origin} />
            <Field label="Destination" value={lead.destination} />
            <Field label="Trip Start" value={fmtDateTime(lead.start_date_time)} />
            <Field label="Trip End" value={fmtDateTime(lead.end_date_time)} />
            <Field label="Passengers" value={lead.number_of_passengers} />
            <Field label="Vehicle Type" value={lead.vehicle_type_requirement} />
            <Field label="Lead Type" value={lead.lead_type} />
            <Field label="Created" value={fmtDateTime(lead.created)} />
          </div>
          {lead.additional_comment && (
            <div className="mt-2">
              <span className="text-xs text-gray-500">Additional Comment</span>
              <div className="text-sm text-gray-700">{lead.additional_comment}</div>
            </div>
          )}
        </section>

        {/* Section 2: Status & Assignment */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Status & Assignment</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-gray-500">Status</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={lead.status} />
                {!readOnly && <button onClick={() => setShowStatusModal(true)} className="text-xs text-indigo-600 hover:underline">Change</button>}
              </div>
            </div>
            <SelectField label="Agent" field="assigned_to_email_id" options={filterOptions?.assigned_to ?? []} />
            <SelectField label="Ops Assignee" field="ops_assignee" options={filterOptions?.ops_assignees ?? []} />
            <EditableField label="Reason" field="reason" />
          </div>
          <div className="mt-2">
            <EditableField label="Internal Remarks" field="internal_remarks" />
          </div>
        </section>

        {/* Section 3: Quote & Revenue */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Quote & Revenue</h3>
          <div className="grid grid-cols-2 gap-3">
            <EditableField label="Quote Amount" field="amount_quote" type="number" />
            <EditableField label="Net Amount" field="amount_cityflo" type="number" />
            <EditableField label="Operator Amount (legacy)" field="amount_operator" type="number" />
            <EditableField label="Operator Name (legacy)" field="operator_name" />
            <EditableField label="GST / Aadhaar" field="gst_aadhaar_number" />
          </div>
        </section>

        {/* Section 4: Billing (only for Converted) */}
        {isConverted && (
          <section>
            <BillingSection lead={lead} onSave={(data) => mutation.mutate(data)} saving={mutation.isPending} readOnly={readOnly} />
          </section>
        )}

        {/* Section 5: Operator Costs */}
        {isConverted && (
          <section>
            <OperatorCostTable
              leadId={lead.id}
              operators={lead.operators}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['lead', leadId] })}
              amountCityflo={lead.amount_cityflo}
              readOnly={readOnly}
            />
          </section>
        )}

        {/* Section 6: Activity Log */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Activity Log</h3>
          <LogTimeline logs={logs ?? []} />
        </section>
      </div>

      {showStatusModal && (
        <StatusUpdateModal
          currentStatus={lead.status}
          onSave={handleStatusSave}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    </div>
  )
}
