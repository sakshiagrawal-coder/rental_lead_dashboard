import type { PaginatedLeads, LeadDetail, LeadSummary, LogEntry, FilterOptions, Operator, LeadFilters } from './types'
import { DUMMY_LEADS, DUMMY_LOGS } from './dummyData'

// In-memory store (clone so mutations don't affect the original)
const leads: LeadDetail[] = JSON.parse(JSON.stringify(DUMMY_LEADS))
let nextId = Math.max(...leads.map(l => l.id)) + 1
let nextOpId = 200

const delay = (ms = 150) => new Promise(r => setTimeout(r, ms))

function opTotal(ops: Operator[]): number {
  return ops.reduce((s, o) =>
    s + (o.operator_amount ?? 0) + (o.toll_amount ?? 0) + (o.parking_amount ?? 0)
    + (o.driver_allowances ?? 0) + (o.extra_km_charges ?? 0) + (o.other_charges ?? 0), 0)
}

function toSummary(l: LeadDetail): LeadSummary {
  const cost = opTotal(l.operators)
  const revenue = l.amount_cityflo ?? 0
  return {
    id: l.id, name: l.name, mobile_number: l.mobile_number,
    origin: l.origin, destination: l.destination,
    start_date_time: l.start_date_time, end_date_time: l.end_date_time,
    status: l.status, source: l.source, assigned_to_email_id: l.assigned_to_email_id,
    lead_type: l.lead_type, amount_quote: l.amount_quote, amount_cityflo: l.amount_cityflo,
    created: l.created, modified: l.modified, payment_status: l.payment_status,
    invoice_number: l.invoice_number, ops_assignee: l.ops_assignee,
    number_of_passengers: l.number_of_passengers, internal_remarks: l.internal_remarks,
    vehicle_type_requirement: l.vehicle_type_requirement, gst_aadhaar_number: l.gst_aadhaar_number,
    total_cost: cost, margin: revenue - cost,
    operator_names: [...new Set(l.operators.map(o => o.operator_name).filter(Boolean))].join(', '),
    operator_amount: l.operators.reduce((s, o) => s + (o.operator_amount ?? 0), 0),
    operator_toll: l.operators.reduce((s, o) => s + (o.toll_amount ?? 0), 0),
    operator_parking: l.operators.reduce((s, o) => s + (o.parking_amount ?? 0), 0),
    vehicle_numbers: [...new Set(l.operators.map(o => o.vehicle_number).filter(Boolean))].join(', '),
    first_operator_id: l.operators.length ? l.operators[0].id : null,
    payment_mode: l.payment_mode, invoice_date: l.invoice_date,
    customer_paid_amount: l.customer_paid_amount,
  }
}

function isStale(l: LeadDetail): boolean {
  const now = Date.now()
  const mod = new Date(l.modified).getTime()
  const h = (now - mod) / 3600000
  if (l.status === 'Open' && h > 24) return true
  if (l.status === 'Contacted' && h > 48) return true
  if (l.status === 'Quote Shared' && h > 72) return true
  const tripMs = new Date(l.start_date_time).getTime() - now
  if (tripMs > 0 && tripMs < 72 * 3600000 && l.status !== 'Converted' && l.status !== 'Closed') return true
  return false
}

// ---------- Leads ----------

const PAGE_SIZE = 25

export async function fetchLeads(filters: LeadFilters): Promise<PaginatedLeads> {
  await delay()
  let result = [...leads]

  if (filters.status) result = result.filter(l => l.status === filters.status)
  if (filters.source) result = result.filter(l => l.source === filters.source)
  if (filters.assigned_to) result = result.filter(l => l.assigned_to_email_id === filters.assigned_to)
  if (filters.lead_type) result = result.filter(l => l.lead_type === filters.lead_type)
  if (filters.ops_assignee) result = result.filter(l => l.ops_assignee === filters.ops_assignee)
  if (filters.attention) result = result.filter(isStale)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(l =>
      l.name.toLowerCase().includes(q) || l.mobile_number.includes(q) ||
      l.origin.toLowerCase().includes(q) || l.destination.toLowerCase().includes(q))
  }
  if (filters.start_date_from) {
    const d = new Date(filters.start_date_from).getTime()
    result = result.filter(l => new Date(l.start_date_time).getTime() >= d)
  }
  if (filters.start_date_to) {
    const d = new Date(filters.start_date_to + 'T23:59:59').getTime()
    result = result.filter(l => new Date(l.start_date_time).getTime() <= d)
  }
  if (filters.created_from) {
    const d = new Date(filters.created_from).getTime()
    result = result.filter(l => new Date(l.created).getTime() >= d)
  }
  if (filters.created_to) {
    const d = new Date(filters.created_to + 'T23:59:59').getTime()
    result = result.filter(l => new Date(l.created).getTime() <= d)
  }

  // Sort
  const sortBy = filters.sort_by || 'created'
  const order = filters.sort_order === 'asc' ? 1 : -1
  result.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortBy]
    const bv = (b as unknown as Record<string, unknown>)[sortBy]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string') return av.localeCompare(bv as string) * order
    return ((av as number) - (bv as number)) * order
  })

  const total = result.length
  const page = filters.page || 1
  const start = (page - 1) * PAGE_SIZE
  const items = result.slice(start, start + PAGE_SIZE).map(toSummary)

  return { items, total, page, page_size: PAGE_SIZE }
}

export async function createLead(data: Record<string, unknown>): Promise<LeadDetail> {
  await delay()
  const now = new Date().toISOString()
  const lead: LeadDetail = {
    id: nextId++, source_table: null, prod_id: null,
    name: (data.name as string) || '', mobile_number: (data.mobile_number as string) || '',
    email: (data.email as string) || null, origin: (data.origin as string) || '',
    destination: (data.destination as string) || '',
    start_date_time: (data.start_date_time as string) || now,
    end_date_time: (data.end_date_time as string) || now,
    number_of_passengers: (data.number_of_passengers as number) || null,
    additional_comment: (data.additional_comment as string) || null,
    source: (data.source as string) || null,
    travel_distance: null, travel_time: null,
    vehicle_type_requirement: (data.vehicle_type_requirement as string) || null,
    status: 'Open', reason: null, internal_remarks: null,
    amount_quote: null, amount_cityflo: null, amount_operator: null, operator_name: null,
    created: now, modified: now, created_by_email_id: null,
    assigned_to_email_id: (data.assigned_to_email_id as string) || '',
    lead_type: (data.lead_type as string) || null, ops_assignee: null,
    payment_remark: null, customer_paid_amount: null, payment_mode: null, payment_status: null,
    balance_remark: null, invoice_number: null, invoice_date: null, gst_aadhaar_number: null,
    operators: [],
  }
  leads.unshift(lead)
  return lead
}

export async function fetchLead(id: number): Promise<LeadDetail> {
  await delay()
  const lead = leads.find(l => l.id === id)
  if (!lead) throw new Error('Not found')
  return lead
}

export async function updateLead(id: number, data: Record<string, unknown>): Promise<LeadDetail> {
  await delay()
  const lead = leads.find(l => l.id === id)
  if (!lead) throw new Error('Not found')
  Object.assign(lead, data, { modified: new Date().toISOString() })
  return lead
}

export async function fetchLogs(id: number): Promise<LogEntry[]> {
  await delay()
  return (DUMMY_LOGS[id] ?? []) as LogEntry[]
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  await delay()
  return {
    statuses: [...new Set(leads.map(l => l.status).filter(Boolean) as string[])],
    sources: [...new Set(leads.map(l => l.source).filter(Boolean) as string[])],
    assigned_to: [...new Set(leads.map(l => l.assigned_to_email_id).filter(Boolean))],
    lead_types: [...new Set(leads.map(l => l.lead_type).filter(Boolean) as string[])],
    ops_assignees: [...new Set(leads.map(l => l.ops_assignee).filter(Boolean) as string[])],
  }
}

// ---------- Operator master ----------

export interface OperatorOption {
  name: string
  pan: string
  gstRate: string
  vehicles: string[]
}

const OPERATOR_MASTER: OperatorOption[] = [
  { name: 'Ashwini', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Rebello', pan: 'AABCR1234A', gstRate: 'No GST', vehicles: ['MH04LQ2670', 'MH02FX0793', 'MH02FX0794', 'MH47BR4849', 'DD01AA9972'] },
  { name: 'Nishnai', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Siddhant Travels', pan: 'EEMPS2345F', gstRate: '18%', vehicles: ['DD01Y9477', 'DD01Y9480'] },
  { name: 'Citycircle', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Shabnam Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Cityline', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Grey Heron', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Indian Travels', pan: 'GGOPI1234H', gstRate: '5%', vehicles: ['DD01Y9580', 'DD01R9500', 'DD01J9696'] },
  { name: 'Surya Travels', pan: 'FFNPS6789G', gstRate: '5%', vehicles: ['MH43BX5349', 'MH43BX5350'] },
  { name: 'Dwarikamai', pan: 'HHQPD5678J', gstRate: 'No GST', vehicles: ['MH02GH6877'] },
  { name: 'Sumedha', pan: 'JJSPS3456L', gstRate: '18%', vehicles: ['MH46CU5248'] },
  { name: 'Buthello', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Rizwan Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Tanjai Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Shree Sai Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Swami', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'GHAPL', pan: 'AADCG5678B', gstRate: 'No GST', vehicles: ['MH04LE2927', 'MH04LE2309', 'MH04LE2312', 'MH04LE2931'] },
  { name: 'Ajara Travels', pan: 'IIRPA9012K', gstRate: '18%', vehicles: ['MH01EM9799', 'MH47BY2861'] },
  { name: 'Nilesh Amberkar', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Sankalp', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Raj Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Shabana', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Lata Tours', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Fortpoint', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Datta Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'JP Naidu', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Bharti Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Nityashree', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Amruta Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Anusaya Tours & Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Alif Tours & Travels', pan: '', gstRate: 'No GST', vehicles: [] },
  { name: 'Rafiq', pan: '', gstRate: 'No GST', vehicles: [] },
]

export async function fetchOperatorMaster(): Promise<OperatorOption[]> {
  await delay()
  return OPERATOR_MASTER
}

// ---------- Operators ----------

export async function addOperator(leadId: number, data: Record<string, unknown>): Promise<Operator> {
  await delay()
  const lead = leads.find(l => l.id === leadId)
  if (!lead) throw new Error('Not found')
  const op: Operator = {
    id: nextOpId++, lead_id: leadId,
    operator_name: (data.operator_name as string) || null,
    vehicle_number: (data.vehicle_number as string) || null,
    operator_amount: (data.operator_amount as number) ?? null,
    toll_amount: (data.toll_amount as number) ?? null,
    toll_receipt: null,
    parking_amount: (data.parking_amount as number) ?? null,
    driver_allowances: (data.driver_allowances as number) ?? null,
    extra_km_charges: (data.extra_km_charges as number) ?? null,
    other_charges: (data.other_charges as number) ?? null,
    remark: (data.remark as string) || null,
    modified: new Date().toISOString(),
  }
  lead.operators.push(op)
  lead.modified = new Date().toISOString()
  return op
}

export async function updateOperator(leadId: number, opId: number, data: Record<string, unknown>): Promise<Operator> {
  await delay()
  const lead = leads.find(l => l.id === leadId)
  if (!lead) throw new Error('Lead not found')
  const op = lead.operators.find(o => o.id === opId)
  if (!op) throw new Error('Operator not found')
  Object.assign(op, data, { modified: new Date().toISOString() })
  lead.modified = new Date().toISOString()
  return op
}

export async function deleteOperator(leadId: number, opId: number): Promise<void> {
  await delay()
  const lead = leads.find(l => l.id === leadId)
  if (!lead) return
  lead.operators = lead.operators.filter(o => o.id !== opId)
  lead.modified = new Date().toISOString()
}

// ---------- Pipeline ----------

export async function fetchPipelineCounts(filters?: Partial<LeadFilters>): Promise<{
  open: number; contacted: number; notResponded: number; quoteShared: number; converted: number; closed: number;
  staleOpen: number; staleContacted: number; staleQuote: number; urgentTrips: number;
}> {
  await delay()
  const now = Date.now()
  let filtered = [...leads]
  if (filters) {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(l =>
        l.name.toLowerCase().includes(q) || l.mobile_number.includes(q) ||
        l.origin.toLowerCase().includes(q) || l.destination.toLowerCase().includes(q))
    }
    if (filters.assigned_to) filtered = filtered.filter(l => l.assigned_to_email_id === filters.assigned_to)
    if (filters.source) filtered = filtered.filter(l => l.source === filters.source)
    if (filters.lead_type) filtered = filtered.filter(l => l.lead_type === filters.lead_type)
    if (filters.ops_assignee) filtered = filtered.filter(l => l.ops_assignee === filters.ops_assignee)
    if (filters.start_date_from) {
      const d = new Date(filters.start_date_from).getTime()
      filtered = filtered.filter(l => new Date(l.start_date_time).getTime() >= d)
    }
    if (filters.start_date_to) {
      const d = new Date(filters.start_date_to + 'T23:59:59').getTime()
      filtered = filtered.filter(l => new Date(l.start_date_time).getTime() <= d)
    }
  }
  const counts = { open: 0, contacted: 0, notResponded: 0, quoteShared: 0, converted: 0, closed: 0,
    staleOpen: 0, staleContacted: 0, staleQuote: 0, urgentTrips: 0 }
  for (const l of filtered) {
    if (l.status === 'Open') { counts.open++; if ((now - new Date(l.modified).getTime()) > 24*3600000) counts.staleOpen++ }
    else if (l.status === 'Contacted') { counts.contacted++; if ((now - new Date(l.modified).getTime()) > 48*3600000) counts.staleContacted++ }
    else if (l.status === 'Not Responded') counts.notResponded++
    else if (l.status === 'Quote Shared') { counts.quoteShared++; if ((now - new Date(l.modified).getTime()) > 72*3600000) counts.staleQuote++ }
    else if (l.status === 'Converted') counts.converted++
    else if (l.status === 'Closed') counts.closed++
    const tripMs = new Date(l.start_date_time).getTime() - now
    if (tripMs > 0 && tripMs < 72*3600000 && l.status !== 'Converted' && l.status !== 'Closed') counts.urgentTrips++
  }
  return counts
}

export async function bulkUpdateStatus(ids: number[], status: string, reason?: string): Promise<void> {
  await delay()
  const now = new Date().toISOString()
  for (const id of ids) {
    const l = leads.find(x => x.id === id)
    if (l) { l.status = status; l.reason = reason || null; l.modified = now }
  }
}

// ---------- Converted stats ----------

export interface ConvertedStats {
  totalRevenue: number
  totalCost: number
  totalMargin: number
  pendingPayments: number
  upcomingTrips: number
  completedTrips: number
}

export function operatorTotal(lead: LeadDetail): number {
  return lead.operators.reduce((sum, o) =>
    sum + (o.operator_amount ?? 0) + (o.toll_amount ?? 0) + (o.parking_amount ?? 0)
    + (o.driver_allowances ?? 0) + (o.extra_km_charges ?? 0) + (o.other_charges ?? 0), 0)
}

export async function fetchConvertedStats(filters?: Partial<LeadFilters>): Promise<ConvertedStats> {
  await delay()
  let conv = leads.filter(l => l.status === 'Converted')
  if (filters) {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      conv = conv.filter(l =>
        l.name.toLowerCase().includes(q) || l.mobile_number.includes(q) ||
        l.origin.toLowerCase().includes(q) || l.destination.toLowerCase().includes(q))
    }
    if (filters.assigned_to) conv = conv.filter(l => l.assigned_to_email_id === filters.assigned_to)
    if (filters.source) conv = conv.filter(l => l.source === filters.source)
    if (filters.start_date_from) {
      const d = new Date(filters.start_date_from).getTime()
      conv = conv.filter(l => new Date(l.start_date_time).getTime() >= d)
    }
    if (filters.start_date_to) {
      const d = new Date(filters.start_date_to + 'T23:59:59').getTime()
      conv = conv.filter(l => new Date(l.start_date_time).getTime() <= d)
    }
  }
  const now = Date.now()
  let totalRevenue = 0, totalCost = 0, pendingPayments = 0, upcomingTrips = 0, completedTrips = 0
  for (const l of conv) {
    totalRevenue += l.amount_cityflo ?? 0
    totalCost += l.operators.reduce((s, o) => s + (o.operator_amount ?? 0), 0)
    if (l.payment_status !== 'Received') pendingPayments++
    if (new Date(l.start_date_time).getTime() > now) upcomingTrips++
    else completedTrips++
  }
  return { totalRevenue, totalCost, totalMargin: totalRevenue - totalCost, pendingPayments, upcomingTrips, completedTrips }
}

// ---------- Summary / Funnel ----------

export interface FunnelData {
  totalLeads: number
  contacted: number; contactedRate: number
  quoteShared: number; quoteSharedRate: number
  converted: number; convertedRate: number
  closed: number; closedRate: number
  contactedToQuoteRate: number; quoteToConvertedRate: number
}

export interface DateRange { from: string; to: string }

function filterByRange(list: LeadDetail[], range?: DateRange): LeadDetail[] {
  if (!range) return list
  const from = new Date(range.from).getTime()
  const to = new Date(range.to + 'T23:59:59').getTime()
  return list.filter(l => {
    const t = new Date(l.start_date_time).getTime()
    return t >= from && t <= to
  })
}

export async function fetchFunnelData(range?: DateRange): Promise<FunnelData> {
  await delay()
  const f = filterByRange(leads, range)
  const total = f.length
  const contacted = f.filter(l => ['Contacted','Quote Shared','Converted'].includes(l.status!)).length
  const quoteShared = f.filter(l => ['Quote Shared','Converted'].includes(l.status!)).length
  const converted = f.filter(l => l.status === 'Converted').length
  const closed = f.filter(l => l.status === 'Closed').length
  const rate = (n: number, d: number) => d ? Math.round(n / d * 100) : 0
  return {
    totalLeads: total, contacted, contactedRate: rate(contacted, total),
    quoteShared, quoteSharedRate: rate(quoteShared, total),
    converted, convertedRate: rate(converted, total),
    closed, closedRate: rate(closed, total),
    contactedToQuoteRate: rate(quoteShared, contacted),
    quoteToConvertedRate: rate(converted, quoteShared),
  }
}

export interface SourcePerformance {
  source: string; totalLeads: number; converted: number; conversionRate: number; totalRevenue: number
}

export async function fetchSourcePerformance(range?: DateRange): Promise<SourcePerformance[]> {
  await delay()
  const f = filterByRange(leads, range)
  const map = new Map<string, { total: number; converted: number; revenue: number }>()
  for (const l of f) {
    const src = l.source || 'Unknown'
    const e = map.get(src) || { total: 0, converted: 0, revenue: 0 }
    e.total++
    if (l.status === 'Converted') { e.converted++; e.revenue += l.amount_cityflo ?? 0 }
    map.set(src, e)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([source, e]) => ({
      source, totalLeads: e.total, converted: e.converted,
      conversionRate: e.total ? Math.round(e.converted / e.total * 100) : 0,
      totalRevenue: e.revenue,
    }))
}

export interface SummaryStats {
  totalLeads: number; totalRevenue: number; totalCost: number; avgDealSize: number; totalMargin: number; marginPct: number
}

export async function fetchSummaryStats(range?: DateRange): Promise<SummaryStats> {
  await delay()
  const f = filterByRange(leads, range)
  const conv = f.filter(l => l.status === 'Converted')
  const totalRevenue = conv.reduce((s, l) => s + (l.amount_cityflo ?? 0), 0)
  const totalCost = conv.reduce((s, l) => s + l.operators.reduce((sum, o) => sum + (o.operator_amount ?? 0), 0), 0)
  const totalMargin = totalRevenue - totalCost
  return {
    totalLeads: f.length, totalRevenue, totalCost,
    avgDealSize: conv.length ? Math.round(totalRevenue / conv.length) : 0,
    totalMargin, marginPct: totalRevenue ? Math.round(totalMargin / totalRevenue * 100) : 0,
  }
}

export interface AssigneePerformance {
  assigned_to_email_id: string; totalLeads: number; open: number; contacted: number;
  quoteShared: number; converted: number; closed: number; conversionRate: number;
  totalRevenue: number; avgResponseHours: number | null
}

export async function fetchPerformanceData(range?: DateRange): Promise<AssigneePerformance[]> {
  await delay()
  const f = filterByRange(leads, range)
  const map = new Map<string, LeadDetail[]>()
  for (const l of f) {
    const arr = map.get(l.assigned_to_email_id) || []
    arr.push(l)
    map.set(l.assigned_to_email_id, arr)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([email, arr]) => {
      const conv = arr.filter(l => l.status === 'Converted')
      return {
        assigned_to_email_id: email, totalLeads: arr.length,
        open: arr.filter(l => l.status === 'Open').length,
        contacted: arr.filter(l => l.status === 'Contacted').length,
        quoteShared: arr.filter(l => l.status === 'Quote Shared').length,
        converted: conv.length,
        closed: arr.filter(l => l.status === 'Closed').length,
        conversionRate: arr.length ? Math.round(conv.length / arr.length * 100) : 0,
        totalRevenue: conv.reduce((s, l) => s + (l.amount_cityflo ?? 0), 0),
        avgResponseHours: null,
      }
    })
}

// ---------- Billing ----------

export interface BillingItem {
  id: number; name: string; mobile_number: string;
  amount_quote: number | null; amount_cityflo: number | null;
  customer_paid_amount: number | null; balance: number;
  payment_status: string | null; payment_mode: string | null;
  invoice_number: string | null; invoice_date: string | null;
  start_date_time: string; assigned_to_email_id: string; ops_assignee: string | null
}

export interface BillingData {
  items: BillingItem[]; total_invoiced: number; total_received: number;
  total_outstanding: number; total_pending_invoice: number
}

export async function fetchBillingData(filters?: Partial<LeadFilters>): Promise<BillingData> {
  await delay()
  let conv = leads.filter(l => l.status === 'Converted')
  if (filters) {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      conv = conv.filter(l =>
        l.name.toLowerCase().includes(q) || l.mobile_number.includes(q) ||
        l.origin.toLowerCase().includes(q) || l.destination.toLowerCase().includes(q))
    }
    if (filters.assigned_to) conv = conv.filter(l => l.assigned_to_email_id === filters.assigned_to)
    if (filters.start_date_from) {
      const d = new Date(filters.start_date_from).getTime()
      conv = conv.filter(l => new Date(l.start_date_time).getTime() >= d)
    }
    if (filters.start_date_to) {
      const d = new Date(filters.start_date_to + 'T23:59:59').getTime()
      conv = conv.filter(l => new Date(l.start_date_time).getTime() <= d)
    }
  }
  let total_invoiced = 0, total_received = 0, total_outstanding = 0, total_pending_invoice = 0
  const items: BillingItem[] = conv.map(l => {
    const amt = l.amount_cityflo ?? 0
    const paid = l.customer_paid_amount ?? 0
    const balance = amt - paid
    if (l.invoice_number) total_invoiced += amt; else total_pending_invoice += amt
    total_received += paid
    total_outstanding += balance
    return {
      id: l.id, name: l.name, mobile_number: l.mobile_number,
      amount_quote: l.amount_quote, amount_cityflo: l.amount_cityflo,
      customer_paid_amount: l.customer_paid_amount, balance,
      payment_status: l.payment_status, payment_mode: l.payment_mode,
      invoice_number: l.invoice_number, invoice_date: l.invoice_date,
      start_date_time: l.start_date_time, assigned_to_email_id: l.assigned_to_email_id,
      ops_assignee: l.ops_assignee,
    }
  })
  return { items, total_invoiced, total_received, total_outstanding, total_pending_invoice }
}
