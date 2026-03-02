import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchFunnelData, fetchPerformanceData, fetchSummaryStats } from '../api'
import type { FunnelData, AssigneePerformance, DateRange } from '../api'

/* ── Helpers ───────────────────────────────────────── */

function fmtCurrency(n: number) {
  if (n >= 100000) return `Rs ${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `Rs ${(n / 1000).toFixed(0)}K`
  return `Rs ${n.toLocaleString('en-IN')}`
}

function fmtResponseTime(hours: number | null) {
  if (hours == null) return '-'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.round(hours)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function getLast30Days(): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function getMonthRange(): DateRange {
  const now = new Date()
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to: now.toISOString().slice(0, 10),
  }
}

const PRESETS = [
  { label: 'This Month', get: getMonthRange },
  { label: '7 Days', get: () => {
    const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 7)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }},
  { label: '30 Days', get: () => {
    const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 30)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }},
  { label: 'All Time', get: () => ({ from: '2020-01-01', to: '2030-12-31' }) },
]

/* ── Section Header (left teal border) ─────────────── */

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-6 bg-teal-500 rounded-full" />
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-[0.15em]">{title}</h2>
      {sub && <span className="text-sm text-gray-400">{sub}</span>}
    </div>
  )
}

/* ── Stat Card (diagonal accent) ──────────────────── */

function StatCard({ label, value, sub, color, accent }: {
  label: string; value: string; sub?: string; color: string; accent: string
}) {
  return (
    <div className={`stat-accent ${accent} border border-gray-100 rounded-lg px-6 py-5`}>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-1">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${color}`}>{value}</div>
      {sub && <div className="text-sm text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

/* ── Funnel (horizontal pipeline flow) ─────────────── */

function DropArrow() {
  return (
    <div className="flex flex-col items-center px-1 shrink-0">
      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

function Funnel({ data }: { data: FunnelData }) {
  const max = data.totalLeads || 1
  const stages = [
    { label: 'Total Leads', count: data.totalLeads, color: 'border-gray-300', text: 'text-gray-800', bar: 'bg-gray-300' },
    { label: 'Contacted', count: data.contacted, color: 'border-blue-400', text: 'text-blue-600', bar: 'bg-blue-400' },
    { label: 'Quoted', count: data.quoteShared, color: 'border-amber-400', text: 'text-amber-600', bar: 'bg-amber-400' },
    { label: 'Converted', count: data.converted, color: 'border-green-500', text: 'text-green-600', bar: 'bg-green-500' },
  ]

  return (
    <div>
      {/* Pipeline stages */}
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center">
        {stages.map((s, i) => {
          const pct = max > 0 ? Math.round((s.count / max) * 100) : 0

          return (
            <>
              {i > 0 && <DropArrow key={`arrow-${i}`} />}
              <div key={s.label} className={`border-t-[3px] ${s.color} rounded-lg bg-white border border-gray-100 px-4 py-4`}>
                <div className={`text-3xl font-bold tracking-tight ${s.text}`}>{s.count}</div>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">{s.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{pct}% of total</div>
              </div>
            </>
          )
        })}
      </div>

      {/* Lost + KPIs row */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-dashed border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-sm text-gray-500">Closed / Lost:</span>
          <span className="text-sm font-bold text-red-500">{data.closed}</span>
          <span className="text-[11px] text-gray-400">({data.closedRate}%)</span>
        </div>
        <div className="flex gap-8">
          {[
            { label: 'Overall Conv.', value: `${data.convertedRate}%`, color: 'text-green-600' },
            { label: 'Quote → Won', value: `${data.quoteToConvertedRate}%`, color: 'text-amber-600' },
            { label: 'Contact → Quote', value: `${data.contactedToQuoteRate}%`, color: 'text-blue-600' },
          ].map((k) => (
            <div key={k.label} className="text-right">
              <span className={`text-lg font-bold ${k.color}`}>{k.value}</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide ml-1.5">{k.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Team Performance ─────────────────────────────── */

function PerformanceTable({ data }: { data: AssigneePerformance[] }) {
  const sorted = [...data].sort((a, b) => b.converted - a.converted)

  return (
    <table className="w-full table-fixed">
      <colgroup>
        <col className="w-1/6" />
        <col className="w-1/6" />
        <col className="w-1/6" />
        <col className="w-1/6" />
        <col className="w-1/6" />
        <col className="w-1/6" />
      </colgroup>
      <thead>
        <tr className="border-b border-gray-200">
          <th className="pb-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Member</th>
          <th className="pb-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Leads</th>
          <th className="pb-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Won</th>
          <th className="pb-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Conv. Rate</th>
          <th className="pb-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Avg Response</th>
          <th className="pb-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.assigned_to_email_id} className="border-b border-gray-50">
            <td className="py-3.5">
              <span className="text-sm font-semibold text-teal-700 truncate block">{p.assigned_to_email_id.split('@')[0]}</span>
            </td>
            <td className="py-3.5 text-center text-sm font-semibold text-gray-700">{p.totalLeads}</td>
            <td className="py-3.5 text-center text-sm font-bold text-green-600">{p.converted}</td>
            <td className="py-3.5 text-center text-sm font-semibold text-gray-600">{p.conversionRate}%</td>
            <td className="py-3.5 text-center text-sm font-semibold text-gray-800">
              {fmtResponseTime(p.avgResponseHours)}
            </td>
            <td className="py-3.5 text-right text-sm font-bold text-gray-800">
              {p.totalRevenue > 0 ? fmtCurrency(p.totalRevenue) : <span className="text-gray-300">-</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ── Main Page ─────────────────────────────────────── */

export default function SummaryPage() {
  const [range, setRange] = useState<DateRange>(getLast30Days)
  const [activePreset, setActivePreset] = useState('30 Days')

  const queryRange = useMemo(() => range, [range.from, range.to])

  const { data: stats } = useQuery({ queryKey: ['summaryStats', queryRange], queryFn: () => fetchSummaryStats(queryRange) })
  const { data: funnel, isLoading: fl } = useQuery({ queryKey: ['funnel', queryRange], queryFn: () => fetchFunnelData(queryRange) })
  const { data: perf, isLoading: pl } = useQuery({ queryKey: ['performance', queryRange], queryFn: () => fetchPerformanceData(queryRange) })

  const applyPreset = (label: string, get: () => DateRange) => {
    setActivePreset(label)
    setRange(get())
  }

  const loading = <div className="text-gray-400 py-12 text-center text-sm">Loading...</div>

  return (
    <div className="px-8 py-6 space-y-8">

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.label, p.get)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded border transition-colors ${
              activePreset === p.label
                ? 'border-teal-500 text-teal-700 bg-teal-50'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="h-5 w-px bg-gray-200" />
        <input
          type="date"
          value={range.from}
          onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setActivePreset('') }}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-600"
        />
        <span className="text-gray-300">—</span>
        <input
          type="date"
          value={range.to}
          onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setActivePreset('') }}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-600"
        />
      </div>

      {/* Headline stats */}
      <div>
        <SectionHeader title="Overview" sub={stats ? `${stats.totalLeads} leads` : ''} />
        {stats && (
          <div className="grid grid-cols-5 gap-5">
            <StatCard label="Revenue" value={fmtCurrency(stats.totalRevenue)} color="text-green-600" accent="stat-accent-green" />
            <StatCard label="Cost" value={fmtCurrency(stats.totalCost)} color="text-red-600" accent="stat-accent-blue" />
            <StatCard label="Margin" value={fmtCurrency(stats.totalMargin)} sub={`${stats.marginPct}% margin`} color="text-teal-600" accent="stat-accent-teal" />
            <StatCard label="Total Leads" value={String(stats.totalLeads)} color="text-gray-800" accent="stat-accent-gray" />
            <StatCard label="Conversion" value={funnel ? `${funnel.convertedRate}%` : '-'} color="text-green-600" accent="stat-accent-green" />
          </div>
        )}
      </div>

      {/* Funnel + Team side by side */}
      <div className="grid grid-cols-2 gap-10">
        <div>
          <SectionHeader title="Conversion Funnel" />
          {fl || !funnel ? loading : <Funnel data={funnel} />}
        </div>
        <div>
          <SectionHeader title="Team Performance" />
          {pl || !perf ? loading : <PerformanceTable data={perf} />}
        </div>
      </div>
    </div>
  )
}
