import type { PaginatedLeads, LeadDetail, LeadSummary, LogEntry, FilterOptions, Operator, LeadFilters } from './types'

// ---------- Helpers ----------

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ---------- Leads ----------

export async function fetchLeads(filters: LeadFilters): Promise<PaginatedLeads> {
  return api<PaginatedLeads>(`/api/leads${qs({
    page: filters.page,
    search: filters.search,
    status: filters.status,
    source: filters.source,
    assigned_to: filters.assigned_to,
    lead_type: filters.lead_type,
    ops_assignee: filters.ops_assignee,
    start_date_from: filters.start_date_from,
    start_date_to: filters.start_date_to,
    created_from: filters.created_from,
    created_to: filters.created_to,
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
    attention: filters.attention || undefined,
  })}`)
}

export async function createLead(data: Record<string, unknown>): Promise<LeadDetail> {
  return api<LeadDetail>('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function fetchLead(id: number): Promise<LeadDetail> {
  return api<LeadDetail>(`/api/leads/${id}`)
}

export async function updateLead(id: number, data: Record<string, unknown>): Promise<LeadDetail> {
  return api<LeadDetail>(`/api/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function fetchLogs(id: number): Promise<LogEntry[]> {
  return api<LogEntry[]>(`/api/leads/${id}/logs`)
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  return api<FilterOptions>('/api/leads/filters/options')
}

// ---------- Operator master ----------

export interface OperatorOption {
  name: string
  pan: string
  gstRate: string
  vehicles: string[]
}

export async function fetchOperatorMaster(): Promise<OperatorOption[]> {
  return api<OperatorOption[]>('/api/operators/master')
}

// ---------- Operators ----------

export async function addOperator(leadId: number, data: Record<string, unknown>): Promise<Operator> {
  return api<Operator>(`/api/leads/${leadId}/operators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function updateOperator(leadId: number, opId: number, data: Record<string, unknown>): Promise<Operator> {
  return api<Operator>(`/api/leads/${leadId}/operators/${opId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function deleteOperator(leadId: number, opId: number): Promise<void> {
  await api<unknown>(`/api/leads/${leadId}/operators/${opId}`, { method: 'DELETE' })
}

// ---------- Pipeline ----------

export async function fetchPipelineCounts(filters?: Partial<LeadFilters>): Promise<{
  open: number; contacted: number; notResponded: number; quoteShared: number; converted: number; closed: number;
  staleOpen: number; staleContacted: number; staleQuote: number; urgentTrips: number;
}> {
  const raw = await api<{
    open: number; contacted: number; quoteShared: number; converted: number; closed: number;
    staleOpen: number; staleContacted: number; staleQuote: number; urgentTrips: number;
  }>(`/api/leads/pipeline-counts${qs({
    search: filters?.search,
    assigned_to: filters?.assigned_to,
    source: filters?.source,
    lead_type: filters?.lead_type,
    ops_assignee: filters?.ops_assignee,
    start_date_from: filters?.start_date_from,
    start_date_to: filters?.start_date_to,
  })}`)
  return { ...raw, notResponded: 0 }
}

export async function bulkUpdateStatus(ids: number[], status: string, reason?: string): Promise<void> {
  await api<unknown>('/api/leads/bulk-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status, reason }),
  })
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
  return api<ConvertedStats>(`/api/leads/converted-stats${qs({
    search: filters?.search,
    assigned_to: filters?.assigned_to,
    source: filters?.source,
    start_date_from: filters?.start_date_from,
    start_date_to: filters?.start_date_to,
  })}`)
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

export async function fetchFunnelData(range?: DateRange): Promise<FunnelData> {
  return api<FunnelData>(`/api/summary/funnel${qs({
    from: range?.from,
    to: range?.to,
  })}`)
}

export interface SourcePerformance {
  source: string; totalLeads: number; converted: number; conversionRate: number; totalRevenue: number
}

export async function fetchSourcePerformance(range?: DateRange): Promise<SourcePerformance[]> {
  return api<SourcePerformance[]>(`/api/summary/source-performance${qs({
    from: range?.from,
    to: range?.to,
  })}`)
}

export interface SummaryStats {
  totalLeads: number; totalRevenue: number; totalCost: number; avgDealSize: number; totalMargin: number; marginPct: number
}

export async function fetchSummaryStats(range?: DateRange): Promise<SummaryStats> {
  return api<SummaryStats>(`/api/summary/stats${qs({
    from: range?.from,
    to: range?.to,
  })}`)
}

export interface AssigneePerformance {
  assigned_to_email_id: string; totalLeads: number; open: number; contacted: number;
  quoteShared: number; converted: number; closed: number; conversionRate: number;
  totalRevenue: number; avgResponseHours: number | null
}

export async function fetchPerformanceData(range?: DateRange): Promise<AssigneePerformance[]> {
  return api<AssigneePerformance[]>(`/api/summary/performance${qs({
    from: range?.from,
    to: range?.to,
  })}`)
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
  return api<BillingData>(`/api/leads/billing${qs({
    search: filters?.search,
    start_date_from: filters?.start_date_from,
    start_date_to: filters?.start_date_to,
  })}`)
}
