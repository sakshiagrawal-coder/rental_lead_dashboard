import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBillingData, fetchLead, updateLead } from '../api'
import type { BillingItem } from '../api'
import { generateInvoice } from '../generateInvoice'
import { useAuth } from '../AuthContext'

function fmtCurrency(n: number) {
  if (n >= 100000) return `Rs ${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `Rs ${(n / 1000).toFixed(0)}K`
  return `Rs ${n.toLocaleString('en-IN')}`
}

function fmtCurrencyFull(n: number | null) {
  if (n == null) return '-'
  return `Rs ${n.toLocaleString('en-IN')}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function grossAmt(net: number | null): number | null {
  if (net == null) return null
  return Math.round(net * 1.05)
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

function InlinePaidInput({ itemId, value }: { itemId: number; value: number | null }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const num = parseFloat(draft.replace(/,/g, '')) || 0
    if (num === (value ?? 0)) return
    setSaving(true)
    try {
      await updateLead(itemId, { customer_paid_amount: num })
      queryClient.invalidateQueries({ queryKey: ['billing'] })
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
      className={`bg-transparent font-semibold text-green-600 text-sm border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 w-20 ${saving ? 'opacity-50' : ''}`}
    />
  )
}

const PAYMENT_COLORS: Record<string, string> = {
  Received: 'text-green-600',
  Partial: 'text-amber-600',
  Pending: 'text-red-500',
}

type Filter = 'all' | 'outstanding' | 'paid' | 'no-invoice'

export default function BillingPage() {
  const { user } = useAuth()
  const isBilling = user.role === 'billing'
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(firstOfMonthStr())
  const [dateTo, setDateTo] = useState(lastOfMonthStr())
  const [generatingId, setGeneratingId] = useState<number | null>(null)

  const billingFilters = { search, start_date_from: dateFrom, start_date_to: dateTo }
  const { data, isLoading } = useQuery({ queryKey: ['billing', billingFilters], queryFn: () => fetchBillingData(billingFilters) })
  const queryClient = useQueryClient()

  const handleGenerateInvoice = async (itemId: number) => {
    setGeneratingId(itemId)
    try {
      const detail = await fetchLead(itemId)
      if (!detail.invoice_number) {
        const invNumber = `INV-2026-${String(itemId).padStart(4, '0')}`
        const today = new Date().toISOString().slice(0, 10)
        await updateLead(itemId, { invoice_number: invNumber, invoice_date: today })
        detail.invoice_number = invNumber
        detail.invoice_date = today
        queryClient.invalidateQueries({ queryKey: ['billing'] })
      }
      generateInvoice(detail)
    } finally {
      setGeneratingId(null)
    }
  }

  const items = (data?.items ?? []).filter((item) => {
    if (filter === 'outstanding') return item.balance > 0
    if (filter === 'paid') return item.payment_status === 'Received'
    if (filter === 'no-invoice') return !item.invoice_number
    return true
  })

  const filterCls = (f: Filter) =>
    `px-4 py-1.5 text-[13px] font-medium rounded border transition-colors ${filter === f ? 'border-teal-500 text-teal-700 bg-teal-50' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`

  return (
    <div className="px-8 py-6 space-y-6">

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name / mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-teal-400"
        />
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <span>Trip</span>
          <input type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
          <span>—</span>
          <input type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
        </div>
      </div>

      {/* Status filter bar */}
      <div className="flex items-center gap-3">
        <button className={filterCls('all')} onClick={() => setFilter('all')}>All ({data?.items.length ?? 0})</button>
        <button className={filterCls('outstanding')} onClick={() => setFilter('outstanding')}>
          Outstanding ({data?.items.filter((i) => i.balance > 0).length ?? 0})
        </button>
        <button className={filterCls('paid')} onClick={() => setFilter('paid')}>
          Paid ({data?.items.filter((i) => i.payment_status === 'Received').length ?? 0})
        </button>
        <button className={filterCls('no-invoice')} onClick={() => setFilter('no-invoice')}>
          No Invoice ({data?.items.filter((i) => !i.invoice_number).length ?? 0})
        </button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-4 gap-5">
          {[
            { label: 'Total Invoiced', value: fmtCurrency(data.total_invoiced), color: 'text-gray-800', accent: 'stat-accent-blue' },
            { label: 'Total Received', value: fmtCurrency(data.total_received), color: 'text-green-600', accent: 'stat-accent-green' },
            { label: 'Outstanding', value: fmtCurrency(data.total_outstanding), color: data.total_outstanding > 0 ? 'text-orange-600' : 'text-gray-500', accent: 'stat-accent-amber' },
            { label: 'Pending Invoice', value: String(data.total_pending_invoice), color: data.total_pending_invoice > 0 ? 'text-red-500' : 'text-gray-500', accent: 'stat-accent-red', sub: data.total_pending_invoice > 0 ? 'leads need invoicing' : 'all invoiced' },
          ].map((card) => (
            <div key={card.label} className={`stat-accent ${card.accent} border border-gray-100 rounded-lg px-6 py-5`}>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-1">{card.label}</div>
              <div className={`text-3xl font-bold tracking-tight ${card.color}`}>{card.value}</div>
              {card.sub && <div className="text-sm text-gray-400 mt-1">{card.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-gray-400 py-12 text-center text-sm">Loading...</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {['Client', 'Trip Date', 'Net Amt', 'Gross Amt', 'Paid', 'Balance', 'Payment', 'Invoice', 'Agent'].map((h) => (
                <th key={h} className="pb-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-3.5">
                  <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.mobile_number}</div>
                </td>
                <td className="py-3.5 text-sm text-gray-600 whitespace-nowrap">{fmtDate(item.start_date_time)}</td>
                <td className="py-3.5 text-sm font-semibold text-gray-700">{fmtCurrencyFull(item.amount_cityflo)}</td>
                <td className="py-3.5 text-sm text-gray-600">{fmtCurrencyFull(grossAmt(item.amount_cityflo))}</td>
                <td className="py-3.5 text-sm font-semibold text-green-600">
                  <InlinePaidInput itemId={item.id} value={item.customer_paid_amount} />
                </td>
                <td className="py-3.5">
                  <span className={`text-sm font-bold ${item.balance > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {item.balance > 0 ? fmtCurrencyFull(item.balance) : 'Nil'}
                  </span>
                </td>
                <td className="py-3.5">
                  <span className={`text-sm font-semibold ${PAYMENT_COLORS[item.payment_status ?? ''] ?? 'text-gray-400'}`}>
                    {item.payment_status ?? 'Pending'}
                  </span>
                </td>
                <td className="py-3.5">
                  {item.invoice_number ? (
                    isBilling ? (
                      <button
                        onClick={() => handleGenerateInvoice(item.id)}
                        disabled={generatingId === item.id}
                        className="text-sm font-semibold text-teal-600 hover:underline disabled:opacity-50"
                      >
                        {item.invoice_number}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-gray-600">{item.invoice_number}</span>
                    )
                  ) : (
                    isBilling ? (
                      <button
                        onClick={() => handleGenerateInvoice(item.id)}
                        disabled={generatingId === item.id}
                        className="text-sm font-medium text-teal-600 border border-teal-300 rounded px-2 py-0.5 hover:bg-teal-50 transition-colors disabled:opacity-50"
                      >
                        {generatingId === item.id ? 'Creating...' : 'Generate'}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )
                  )}
                </td>
                <td className="py-3.5 text-sm font-semibold text-teal-700 whitespace-nowrap">{item.assigned_to_email_id.split('@')[0]}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">No items found</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
