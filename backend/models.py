from __future__ import annotations
from datetime import datetime, date
from pydantic import BaseModel


class LeadSummary(BaseModel):
    id: int
    name: str
    mobile_number: str
    origin: str
    destination: str
    start_date_time: datetime
    end_date_time: datetime
    status: str | None
    source: str | None
    assigned_to_email_id: str
    lead_type: str | None
    amount_quote: int | None
    amount_cityflo: int | None
    created: datetime
    modified: datetime
    payment_status: str | None = None
    invoice_number: str | None = None
    ops_assignee: str | None = None
    number_of_passengers: int | None = None
    internal_remarks: str | None = None
    vehicle_type_requirement: str | None = None
    gst_aadhaar_number: str | None = None
    total_cost: int = 0
    margin: int = 0
    operator_names: str = ''
    operator_amount: int = 0
    operator_toll: int = 0
    operator_parking: int = 0
    vehicle_numbers: str = ''
    first_operator_id: int | None = None
    payment_mode: str | None = None
    invoice_date: date | None = None
    customer_paid_amount: int | None = None


class Operator(BaseModel):
    id: int
    lead_id: int
    operator_name: str | None
    vehicle_number: str | None
    operator_amount: int | None
    toll_amount: int | None
    toll_receipt: str | None
    parking_amount: int | None
    driver_allowances: int | None
    extra_km_charges: int | None
    other_charges: int | None
    remark: str | None
    modified: datetime | None


class LeadDetail(BaseModel):
    id: int
    source_table: str | None
    prod_id: int | None
    name: str
    mobile_number: str
    email: str | None
    origin: str
    destination: str
    start_date_time: datetime
    end_date_time: datetime
    number_of_passengers: int | None
    additional_comment: str | None
    source: str | None
    travel_distance: str | None
    travel_time: str | None
    vehicle_type_requirement: str | None
    status: str | None
    reason: str | None
    internal_remarks: str | None
    amount_quote: int | None
    amount_cityflo: int | None
    amount_operator: int | None
    operator_name: str | None
    created: datetime
    modified: datetime
    created_by_email_id: str | None
    assigned_to_email_id: str
    lead_type: str | None
    ops_assignee: str | None
    payment_remark: str | None
    customer_paid_amount: int | None
    payment_mode: str | None
    payment_status: str | None
    balance_remark: str | None
    invoice_number: str | None
    invoice_date: date | None
    gst_aadhaar_number: str | None = None
    operators: list[Operator] = []


class LeadUpdate(BaseModel):
    status: str | None = None
    reason: str | None = None
    internal_remarks: str | None = None
    assigned_to_email_id: str | None = None
    ops_assignee: str | None = None
    amount_quote: int | None = None
    amount_cityflo: int | None = None
    amount_operator: int | None = None
    operator_name: str | None = None
    payment_remark: str | None = None
    customer_paid_amount: int | None = None
    payment_mode: str | None = None
    payment_status: str | None = None
    balance_remark: str | None = None
    invoice_number: str | None = None
    invoice_date: date | None = None
    gst_aadhaar_number: str | None = None


class OperatorCreate(BaseModel):
    operator_name: str | None = None
    vehicle_number: str | None = None
    operator_amount: int | None = None
    toll_amount: int | None = None
    toll_receipt: str | None = None
    parking_amount: int | None = None
    driver_allowances: int | None = None
    extra_km_charges: int | None = None
    other_charges: int | None = None
    remark: str | None = None


class OperatorUpdate(BaseModel):
    operator_name: str | None = None
    vehicle_number: str | None = None
    operator_amount: int | None = None
    toll_amount: int | None = None
    toll_receipt: str | None = None
    parking_amount: int | None = None
    driver_allowances: int | None = None
    extra_km_charges: int | None = None
    other_charges: int | None = None
    remark: str | None = None


class LogEntry(BaseModel):
    id: int | None
    status: str | None
    assigned_to_email_id: str | None
    modified: datetime | None
    amount_quote: int | None
    amount_cityflo: int | None
    amount_operator: int | None
    operator_name: str | None
    reason: str | None
    internal_remarks: str | None


class PaginatedLeads(BaseModel):
    items: list[LeadSummary]
    total: int
    page: int
    page_size: int


class FilterOptions(BaseModel):
    statuses: list[str]
    sources: list[str]
    assigned_to: list[str]
    lead_types: list[str]
    ops_assignees: list[str]


class LeadCreate(BaseModel):
    name: str
    mobile_number: str
    email: str | None = None
    origin: str
    destination: str
    start_date_time: str
    end_date_time: str
    number_of_passengers: int | None = None
    additional_comment: str | None = None
    source: str | None = None
    vehicle_type_requirement: str | None = None
    internal_remarks: str | None = None
    amount_quote: int | None = None
    amount_cityflo: int | None = None
    assigned_to_email_id: str
    lead_type: str | None = None


class BulkStatusUpdate(BaseModel):
    ids: list[int]
    status: str
    reason: str | None = None


class PipelineCounts(BaseModel):
    open: int
    contacted: int
    quoteShared: int
    converted: int
    closed: int
    staleOpen: int
    staleContacted: int
    staleQuote: int
    urgentTrips: int


class ConvertedStats(BaseModel):
    totalRevenue: int
    totalCost: int
    totalMargin: int
    pendingPayments: int
    upcomingTrips: int
    completedTrips: int


class BillingItem(BaseModel):
    id: int
    name: str
    mobile_number: str
    amount_quote: int | None
    amount_cityflo: int | None
    customer_paid_amount: int | None
    balance: int
    payment_status: str | None
    payment_mode: str | None
    invoice_number: str | None
    invoice_date: date | None
    start_date_time: datetime
    assigned_to_email_id: str
    ops_assignee: str | None


class BillingData(BaseModel):
    items: list[BillingItem]
    total_invoiced: int
    total_received: int
    total_outstanding: int
    total_pending_invoice: int


class FunnelData(BaseModel):
    totalLeads: int
    contacted: int
    contactedRate: int
    quoteShared: int
    quoteSharedRate: int
    converted: int
    convertedRate: int
    closed: int
    closedRate: int
    contactedToQuoteRate: int
    quoteToConvertedRate: int


class SummaryStats(BaseModel):
    totalLeads: int
    totalRevenue: int
    totalCost: int
    avgDealSize: int
    totalMargin: int
    marginPct: int


class SourcePerformance(BaseModel):
    source: str
    totalLeads: int
    converted: int
    conversionRate: int
    totalRevenue: int


class AssigneePerformance(BaseModel):
    assigned_to_email_id: str
    totalLeads: int
    open: int
    contacted: int
    quoteShared: int
    converted: int
    closed: int
    conversionRate: int
    totalRevenue: int
    avgResponseHours: float | None


class OperatorMasterItem(BaseModel):
    name: str
    pan: str
    gstRate: str
    vehicles: list[str]
