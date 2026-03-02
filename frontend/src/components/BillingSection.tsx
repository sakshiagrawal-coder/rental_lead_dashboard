import { useState } from 'react'
import type { LeadDetail } from '../types'

interface Props {
  lead: LeadDetail
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
  readOnly?: boolean
}

export default function BillingSection({ lead, onSave, saving, readOnly }: Props) {
  const [form, setForm] = useState({
    customer_paid_amount: lead.customer_paid_amount ?? '',
    payment_mode: lead.payment_mode ?? '',
    payment_status: lead.payment_status ?? '',
    payment_remark: lead.payment_remark ?? '',
    balance_remark: lead.balance_remark ?? '',
    invoice_number: lead.invoice_number ?? '',
    invoice_date: lead.invoice_date ?? '',
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(form)) {
      if (k === 'customer_paid_amount') {
        if (v !== '') data[k] = Number(v)
      } else if (v !== '') {
        data[k] = v
      }
    }
    onSave(data)
  }

  const ReadOnlyField = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <div className="text-sm text-gray-900">{value || '-'}</div>
    </div>
  )

  if (readOnly) {
    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-gray-700">Billing</h4>
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Customer Paid Amount" value={lead.customer_paid_amount != null ? `₹${Number(lead.customer_paid_amount).toLocaleString()}` : null} />
          <ReadOnlyField label="Payment Mode" value={lead.payment_mode} />
          <ReadOnlyField label="Payment Status" value={lead.payment_status} />
          <ReadOnlyField label="Invoice Number" value={lead.invoice_number} />
          <ReadOnlyField label="Invoice Date" value={lead.invoice_date} />
        </div>
        <ReadOnlyField label="Payment Remark" value={lead.payment_remark} />
        <ReadOnlyField label="Balance Remark" value={lead.balance_remark} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-gray-700">Billing</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Customer Paid Amount</label>
          <input type="number" value={form.customer_paid_amount} onChange={(e) => set('customer_paid_amount', e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Payment Mode</label>
          <select value={form.payment_mode} onChange={(e) => set('payment_mode', e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">-</option>
            <option>Bank Transfer</option>
            <option>UPI</option>
            <option>Cash</option>
            <option>Cheque</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Payment Status</label>
          <select value={form.payment_status} onChange={(e) => set('payment_status', e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">-</option>
            <option>Pending</option>
            <option>Partial</option>
            <option>Received</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Invoice Number</label>
          <input type="text" value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
          <input type="date" value={form.invoice_date} onChange={(e) => set('invoice_date', e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Payment Remark</label>
        <input type="text" value={form.payment_remark} onChange={(e) => set('payment_remark', e.target.value)}
          className="w-full border rounded px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Balance Remark</label>
        <input type="text" value={form.balance_remark} onChange={(e) => set('balance_remark', e.target.value)}
          className="w-full border rounded px-2 py-1.5 text-sm" />
      </div>
      <button onClick={handleSave} disabled={saving}
        className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Billing'}
      </button>
    </div>
  )
}
