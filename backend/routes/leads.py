from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from backend.db import get_pool
from backend.models import (
    PaginatedLeads, LeadSummary, LeadDetail, LeadUpdate, LeadCreate,
    LogEntry, FilterOptions, Operator, BulkStatusUpdate,
    PipelineCounts, ConvertedStats, BillingItem, BillingData,
)

router = APIRouter(prefix="/api/leads", tags=["leads"])


def _parse_dt(s: str, end_of_day: bool = False) -> datetime:
    """Parse date string to datetime, optionally at end of day."""
    if end_of_day and 'T' not in s:
        return datetime.fromisoformat(s + 'T23:59:59')
    return datetime.fromisoformat(s)

SUMMARY_COLS = (
    "l.id, l.name, l.mobile_number, l.origin, l.destination, "
    "l.start_date_time, l.end_date_time, l.status, l.source, "
    "l.assigned_to_email_id, l.lead_type, l.amount_quote, l.amount_cityflo, "
    "l.created, l.modified, l.payment_status, l.invoice_number, l.ops_assignee, "
    "l.number_of_passengers, l.internal_remarks, l.vehicle_type_requirement, "
    "l.payment_mode, l.invoice_date, l.customer_paid_amount"
)

OPERATOR_AGG = """
    COALESCE(op.total_cost, 0) AS total_cost,
    COALESCE(l.amount_cityflo, 0) - COALESCE(op.total_cost, 0) AS margin,
    COALESCE(op.operator_names, '') AS operator_names,
    COALESCE(op.operator_amount, 0) AS operator_amount,
    COALESCE(op.operator_toll, 0) AS operator_toll,
    COALESCE(op.operator_parking, 0) AS operator_parking,
    COALESCE(op.vehicle_numbers, '') AS vehicle_numbers,
    op.first_operator_id
"""

OPERATOR_SUBQUERY = """
    LEFT JOIN LATERAL (
        SELECT
            COALESCE(SUM(COALESCE(o.operator_amount,0) + COALESCE(o.toll_amount,0)
                + COALESCE(o.parking_amount,0) + COALESCE(o.driver_allowances,0)
                + COALESCE(o.extra_km_charges,0) + COALESCE(o.other_charges,0)), 0) AS total_cost,
            STRING_AGG(DISTINCT o.operator_name, ', ') FILTER (WHERE o.operator_name IS NOT NULL) AS operator_names,
            COALESCE(SUM(o.operator_amount), 0) AS operator_amount,
            COALESCE(SUM(o.toll_amount), 0) AS operator_toll,
            COALESCE(SUM(o.parking_amount), 0) AS operator_parking,
            STRING_AGG(DISTINCT o.vehicle_number, ', ') FILTER (WHERE o.vehicle_number IS NOT NULL) AS vehicle_numbers,
            MIN(o.id) AS first_operator_id
        FROM rental_leads_operator o
        WHERE o.lead_id = l.id
    ) op ON TRUE
"""


@router.get("", response_model=PaginatedLeads)
async def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    status: str | None = None,
    source: str | None = None,
    assigned_to: str | None = None,
    lead_type: str | None = None,
    ops_assignee: str | None = None,
    start_date_from: str | None = None,
    start_date_to: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    sort_by: str = "created",
    sort_order: str = "desc",
    attention: bool = False,
):
    pool = await get_pool()

    allowed_sort = {
        "created", "modified", "start_date_time", "end_date_time",
        "name", "status", "amount_quote", "amount_cityflo",
    }
    if sort_by not in allowed_sort:
        sort_by = "created"
    if sort_order.lower() not in ("asc", "desc"):
        sort_order = "desc"

    conditions: list[str] = []
    params: list = []
    idx = 1

    if search:
        conditions.append(f"(l.name ILIKE ${idx} OR l.mobile_number ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    if status:
        conditions.append(f"l.status = ${idx}")
        params.append(status)
        idx += 1
    if source:
        conditions.append(f"l.source = ${idx}")
        params.append(source)
        idx += 1
    if assigned_to:
        conditions.append(f"l.assigned_to_email_id = ${idx}")
        params.append(assigned_to)
        idx += 1
    if lead_type:
        conditions.append(f"l.lead_type = ${idx}")
        params.append(lead_type)
        idx += 1
    if ops_assignee:
        conditions.append(f"l.ops_assignee = ${idx}")
        params.append(ops_assignee)
        idx += 1
    if start_date_from:
        conditions.append(f"l.start_date_time >= ${idx}")
        params.append(_parse_dt(start_date_from))
        idx += 1
    if start_date_to:
        conditions.append(f"l.start_date_time <= ${idx}")
        params.append(_parse_dt(start_date_to, end_of_day=True))
        idx += 1
    if created_from:
        conditions.append(f"l.created >= ${idx}")
        params.append(_parse_dt(created_from))
        idx += 1
    if created_to:
        conditions.append(f"l.created <= ${idx}")
        params.append(_parse_dt(created_to, end_of_day=True))
        idx += 1
    if attention:
        conditions.append(
            """(
                l.status NOT IN ('Closed', 'Converted') AND (
                    (l.status = 'Open' AND l.modified < NOW() - INTERVAL '24 hours')
                    OR (l.status = 'Contacted' AND l.modified < NOW() - INTERVAL '48 hours')
                    OR (l.status = 'Quote Shared' AND l.modified < NOW() - INTERVAL '72 hours')
                    OR (l.start_date_time < NOW() + INTERVAL '72 hours' AND l.start_date_time > NOW())
                )
            )"""
        )

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * page_size

    # Sort column: prefix with l. for lead table columns
    sort_col = f"l.{sort_by}"

    count_sql = f"SELECT COUNT(*) FROM rental_leads l {where}"
    data_sql = (
        f"SELECT {SUMMARY_COLS}, {OPERATOR_AGG} "
        f"FROM rental_leads l {OPERATOR_SUBQUERY} "
        f"{where} "
        f"ORDER BY {sort_col} {sort_order} "
        f"LIMIT ${idx} OFFSET ${idx + 1}"
    )
    params.extend([page_size, offset])

    async with pool.acquire() as conn:
        total = await conn.fetchval(count_sql, *params[:-2])
        rows = await conn.fetch(data_sql, *params)

    return PaginatedLeads(
        items=[LeadSummary(**dict(r)) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/filters/options", response_model=FilterOptions)
async def filter_options():
    pool = await get_pool()
    async with pool.acquire() as conn:
        statuses = await conn.fetch(
            "SELECT DISTINCT status FROM rental_leads WHERE status IS NOT NULL ORDER BY status"
        )
        sources = await conn.fetch(
            "SELECT DISTINCT source FROM rental_leads WHERE source IS NOT NULL ORDER BY source"
        )
        assigned = await conn.fetch(
            "SELECT DISTINCT assigned_to_email_id FROM rental_leads "
            "WHERE assigned_to_email_id IS NOT NULL ORDER BY assigned_to_email_id"
        )
        lead_types = await conn.fetch(
            "SELECT DISTINCT lead_type FROM rental_leads WHERE lead_type IS NOT NULL ORDER BY lead_type"
        )
        ops = await conn.fetch(
            "SELECT DISTINCT ops_assignee FROM rental_leads WHERE ops_assignee IS NOT NULL ORDER BY ops_assignee"
        )
    return FilterOptions(
        statuses=[r[0] for r in statuses],
        sources=[r[0] for r in sources],
        assigned_to=[r[0] for r in assigned],
        lead_types=[r[0] for r in lead_types],
        ops_assignees=[r[0] for r in ops],
    )


@router.get("/pipeline-counts", response_model=PipelineCounts)
async def pipeline_counts(
    search: str | None = None,
    assigned_to: str | None = None,
    source: str | None = None,
    lead_type: str | None = None,
    ops_assignee: str | None = None,
    start_date_from: str | None = None,
    start_date_to: str | None = None,
):
    pool = await get_pool()
    conditions: list[str] = ["status IS NOT NULL"]
    params: list = []
    idx = 1

    if search:
        conditions.append(f"(name ILIKE ${idx} OR mobile_number ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    if assigned_to:
        conditions.append(f"assigned_to_email_id = ${idx}")
        params.append(assigned_to)
        idx += 1
    if source:
        conditions.append(f"source = ${idx}")
        params.append(source)
        idx += 1
    if lead_type:
        conditions.append(f"lead_type = ${idx}")
        params.append(lead_type)
        idx += 1
    if ops_assignee:
        conditions.append(f"ops_assignee = ${idx}")
        params.append(ops_assignee)
        idx += 1
    if start_date_from:
        conditions.append(f"start_date_time >= ${idx}")
        params.append(_parse_dt(start_date_from))
        idx += 1
    if start_date_to:
        conditions.append(f"start_date_time <= ${idx}")
        params.append(_parse_dt(start_date_to, end_of_day=True))
        idx += 1

    where = "WHERE " + " AND ".join(conditions)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT status, COUNT(*) AS cnt FROM rental_leads {where} GROUP BY status", *params
        )
        status_map = {r["status"]: r["cnt"] for r in rows}

        stale = await conn.fetchrow(f"""
            SELECT
                COUNT(*) FILTER (WHERE status = 'Open' AND modified < NOW() - INTERVAL '24 hours') AS stale_open,
                COUNT(*) FILTER (WHERE status = 'Contacted' AND modified < NOW() - INTERVAL '48 hours') AS stale_contacted,
                COUNT(*) FILTER (WHERE status = 'Quote Shared' AND modified < NOW() - INTERVAL '72 hours') AS stale_quote,
                COUNT(*) FILTER (WHERE start_date_time < NOW() + INTERVAL '72 hours'
                    AND start_date_time > NOW()
                    AND status NOT IN ('Converted', 'Closed')) AS urgent_trips
            FROM rental_leads {where}
        """, *params)

    return PipelineCounts(
        open=status_map.get("Open", 0),
        contacted=status_map.get("Contacted", 0),
        quoteShared=status_map.get("Quote Shared", 0),
        converted=status_map.get("Converted", 0),
        closed=status_map.get("Closed", 0),
        staleOpen=stale["stale_open"],
        staleContacted=stale["stale_contacted"],
        staleQuote=stale["stale_quote"],
        urgentTrips=stale["urgent_trips"],
    )


@router.get("/converted-stats", response_model=ConvertedStats)
async def converted_stats(
    search: str | None = None,
    assigned_to: str | None = None,
    source: str | None = None,
    start_date_from: str | None = None,
    start_date_to: str | None = None,
):
    pool = await get_pool()
    conditions: list[str] = ["l.status = 'Converted'"]
    params: list = []
    idx = 1

    if search:
        conditions.append(f"(l.name ILIKE ${idx} OR l.mobile_number ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    if assigned_to:
        conditions.append(f"l.assigned_to_email_id = ${idx}")
        params.append(assigned_to)
        idx += 1
    if source:
        conditions.append(f"l.source = ${idx}")
        params.append(source)
        idx += 1
    if start_date_from:
        conditions.append(f"l.start_date_time >= ${idx}")
        params.append(_parse_dt(start_date_from))
        idx += 1
    if start_date_to:
        conditions.append(f"l.start_date_time <= ${idx}")
        params.append(_parse_dt(start_date_to, end_of_day=True))
        idx += 1

    where = "WHERE " + " AND ".join(conditions)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(f"""
            SELECT
                COALESCE(SUM(l.amount_cityflo), 0) AS total_revenue,
                COALESCE(SUM(op.cost), 0) AS total_cost,
                COALESCE(SUM(
                    CASE WHEN l.payment_status != 'Received' OR l.payment_status IS NULL
                    THEN COALESCE(l.amount_cityflo, 0) - COALESCE(l.customer_paid_amount, 0)
                    ELSE 0 END
                ), 0) AS pending_payments,
                COUNT(*) FILTER (WHERE l.start_date_time > NOW()) AS upcoming_trips,
                COUNT(*) FILTER (WHERE l.start_date_time <= NOW()) AS completed_trips
            FROM rental_leads l
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(
                    COALESCE(o.operator_amount,0) + COALESCE(o.toll_amount,0)
                    + COALESCE(o.parking_amount,0) + COALESCE(o.driver_allowances,0)
                    + COALESCE(o.extra_km_charges,0) + COALESCE(o.other_charges,0)
                ), 0) AS cost
                FROM rental_leads_operator o WHERE o.lead_id = l.id
            ) op ON TRUE
            {where}
        """, *params)

    total_revenue = row["total_revenue"]
    total_cost = row["total_cost"]
    return ConvertedStats(
        totalRevenue=total_revenue,
        totalCost=total_cost,
        totalMargin=total_revenue - total_cost,
        pendingPayments=row["pending_payments"],
        upcomingTrips=row["upcoming_trips"],
        completedTrips=row["completed_trips"],
    )


@router.get("/billing", response_model=BillingData)
async def billing_data(
    search: str | None = None,
    start_date_from: str | None = None,
    start_date_to: str | None = None,
):
    pool = await get_pool()
    conditions: list[str] = ["status = 'Converted'"]
    params: list = []
    idx = 1

    if search:
        conditions.append(f"(name ILIKE ${idx} OR mobile_number ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    if start_date_from:
        conditions.append(f"start_date_time >= ${idx}")
        params.append(_parse_dt(start_date_from))
        idx += 1
    if start_date_to:
        conditions.append(f"start_date_time <= ${idx}")
        params.append(_parse_dt(start_date_to, end_of_day=True))
        idx += 1

    where = "WHERE " + " AND ".join(conditions)

    async with pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT id, name, mobile_number, amount_quote, amount_cityflo,
                   customer_paid_amount, payment_status, payment_mode,
                   invoice_number, invoice_date, start_date_time,
                   assigned_to_email_id, ops_assignee
            FROM rental_leads
            {where}
            ORDER BY start_date_time DESC
        """, *params)

    total_invoiced = 0
    total_received = 0
    total_outstanding = 0
    total_pending_invoice = 0
    items = []

    for r in rows:
        row = dict(r)
        quote = row["amount_quote"] or 0
        paid = row["customer_paid_amount"] or 0
        balance = quote - paid

        if row["invoice_number"]:
            total_invoiced += row["amount_cityflo"] or 0
        else:
            total_pending_invoice += 1
        total_received += paid
        total_outstanding += balance

        row["balance"] = balance
        items.append(BillingItem(**row))

    return BillingData(
        items=items,
        total_invoiced=total_invoiced,
        total_received=total_received,
        total_outstanding=total_outstanding,
        total_pending_invoice=total_pending_invoice,
    )


DETAIL_COLS = (
    "id, source_table, prod_id, name, mobile_number, email, origin, destination, "
    "start_date_time, end_date_time, number_of_passengers, additional_comment, source, "
    "travel_distance, travel_time, vehicle_type_requirement, status, reason, internal_remarks, "
    "amount_quote, amount_cityflo, amount_operator, operator_name, created, modified, "
    "created_by_email_id, assigned_to_email_id, lead_type, ops_assignee, payment_remark, "
    "customer_paid_amount, payment_mode, payment_status, balance_remark, invoice_number, "
    "invoice_date"
)


@router.post("", response_model=LeadDetail)
async def create_lead(body: LeadCreate):
    pool = await get_pool()
    data = body.model_dump()
    now = datetime.utcnow()

    cols = list(data.keys()) + ["status", "created", "modified"]
    vals = list(data.values()) + ["Open", now, now]
    placeholders = ", ".join(f"${i}" for i in range(1, len(vals) + 1))
    col_str = ", ".join(cols)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO rental_leads ({col_str}) VALUES ({placeholders}) RETURNING {DETAIL_COLS}",
            *vals,
        )

    lead = dict(row)
    lead["operators"] = []
    return LeadDetail(**lead)


@router.post("/bulk-status")
async def bulk_status_update(body: BulkStatusUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if body.reason:
            await conn.execute(
                "UPDATE rental_leads SET status = $1, reason = $2, modified = $3 WHERE id = ANY($4)",
                body.status, body.reason, datetime.utcnow(), body.ids,
            )
        else:
            await conn.execute(
                "UPDATE rental_leads SET status = $1, modified = $2 WHERE id = ANY($3)",
                body.status, datetime.utcnow(), body.ids,
            )
    return {"ok": True}


@router.get("/{lead_id}", response_model=LeadDetail)
async def get_lead(lead_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(f"SELECT {DETAIL_COLS} FROM rental_leads WHERE id = $1", lead_id)
        if not row:
            raise HTTPException(404, "Lead not found")

        ops = await conn.fetch(
            "SELECT * FROM rental_leads_operator WHERE lead_id = $1 ORDER BY id", lead_id
        )

    lead = dict(row)
    lead["operators"] = [Operator(**dict(o)) for o in ops]
    return LeadDetail(**lead)


@router.patch("/{lead_id}", response_model=LeadDetail)
async def update_lead(lead_id: int, body: LeadUpdate):
    pool = await get_pool()
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    async with pool.acquire() as conn:
        # Snapshot current row into logs
        await conn.execute(
            """
            INSERT INTO rental_leads_logs
                (id, source_table, prod_id, name, mobile_number, email,
                 origin, destination, start_date_time, end_date_time,
                 number_of_passengers, additional_comment, source,
                 travel_distance, travel_time, vehicle_type_requirement,
                 status, reason, internal_remarks,
                 amount_quote, amount_cityflo, amount_operator, operator_name,
                 created, modified, created_by_email_id, assigned_to_email_id)
            SELECT id, source_table, prod_id, name, mobile_number, email,
                   origin, destination, start_date_time, end_date_time,
                   number_of_passengers, additional_comment, source,
                   travel_distance, travel_time, vehicle_type_requirement,
                   status, reason, internal_remarks,
                   amount_quote, amount_cityflo, amount_operator, operator_name,
                   created, modified, created_by_email_id, assigned_to_email_id
            FROM rental_leads WHERE id = $1
            """,
            lead_id,
        )

        # Build dynamic UPDATE
        set_parts = []
        params = []
        idx = 1
        for col, val in updates.items():
            set_parts.append(f"{col} = ${idx}")
            params.append(val)
            idx += 1
        set_parts.append(f"modified = ${idx}")
        params.append(datetime.utcnow())
        idx += 1
        params.append(lead_id)

        sql = f"UPDATE rental_leads SET {', '.join(set_parts)} WHERE id = ${idx}"
        await conn.execute(sql, *params)

        # Return updated lead
        row = await conn.fetchrow(f"SELECT {DETAIL_COLS} FROM rental_leads WHERE id = $1", lead_id)
        ops = await conn.fetch(
            "SELECT * FROM rental_leads_operator WHERE lead_id = $1 ORDER BY id", lead_id
        )

    lead = dict(row)
    lead["operators"] = [Operator(**dict(o)) for o in ops]
    return LeadDetail(**lead)


@router.get("/{lead_id}/logs", response_model=list[LogEntry])
async def get_logs(lead_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, status, assigned_to_email_id, modified,
                   amount_quote, amount_cityflo, amount_operator, operator_name,
                   reason, internal_remarks
            FROM rental_leads_logs
            WHERE id = $1
            ORDER BY modified DESC
            """,
            lead_id,
        )
    return [LogEntry(**dict(r)) for r in rows]
