export interface LeadSummary {
  id: number
  name: string
  mobile_number: string
  origin: string
  destination: string
  start_date_time: string
  end_date_time: string
  status: string | null
  source: string | null
  assigned_to_email_id: string
  lead_type: string | null
  amount_quote: number | null
  amount_cityflo: number | null
  created: string
  modified: string
  payment_status: string | null
  invoice_number: string | null
  ops_assignee: string | null
  number_of_passengers: number | null
  internal_remarks: string | null
  vehicle_type_requirement: string | null
  gst_aadhaar_number: string | null
  total_cost: number
  margin: number
  // Operator summary (flattened)
  operator_names: string
  operator_amount: number
  operator_toll: number
  operator_parking: number
  vehicle_numbers: string
  first_operator_id: number | null
  // Billing
  payment_mode: string | null
  invoice_date: string | null
  customer_paid_amount: number | null
}

export interface Operator {
  id: number
  lead_id: number
  operator_name: string | null
  vehicle_number: string | null
  operator_amount: number | null
  toll_amount: number | null
  toll_receipt: string | null
  parking_amount: number | null
  driver_allowances: number | null
  extra_km_charges: number | null
  other_charges: number | null
  remark: string | null
  modified: string | null
}

export interface LeadDetail {
  id: number
  source_table: string | null
  prod_id: number | null
  name: string
  mobile_number: string
  email: string | null
  origin: string
  destination: string
  start_date_time: string
  end_date_time: string
  number_of_passengers: number | null
  additional_comment: string | null
  source: string | null
  travel_distance: string | null
  travel_time: string | null
  vehicle_type_requirement: string | null
  status: string | null
  reason: string | null
  internal_remarks: string | null
  amount_quote: number | null
  amount_cityflo: number | null
  amount_operator: number | null
  operator_name: string | null
  created: string
  modified: string
  created_by_email_id: string | null
  assigned_to_email_id: string
  lead_type: string | null
  ops_assignee: string | null
  payment_remark: string | null
  customer_paid_amount: number | null
  payment_mode: string | null
  payment_status: string | null
  balance_remark: string | null
  invoice_number: string | null
  invoice_date: string | null
  gst_aadhaar_number: string | null
  operators: Operator[]
}

export interface PaginatedLeads {
  items: LeadSummary[]
  total: number
  page: number
  page_size: number
}

export interface FilterOptions {
  statuses: string[]
  sources: string[]
  assigned_to: string[]
  lead_types: string[]
  ops_assignees: string[]
}

export interface LogEntry {
  id: number | null
  status: string | null
  assigned_to_email_id: string | null
  modified: string | null
  amount_quote: number | null
  amount_cityflo: number | null
  amount_operator: number | null
  operator_name: string | null
  reason: string | null
  internal_remarks: string | null
}

export interface LeadFilters {
  search: string
  status: string
  source: string
  assigned_to: string
  lead_type: string
  ops_assignee: string
  start_date_from: string
  start_date_to: string
  created_from: string
  created_to: string
  sort_by: string
  sort_order: string
  page: number
  attention?: boolean
}
