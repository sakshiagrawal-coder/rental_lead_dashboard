from datetime import datetime
from fastapi import APIRouter, Query
from backend.db import get_pool
from backend.models import (
    FunnelData, SummaryStats, SourcePerformance, AssigneePerformance,
)

router = APIRouter(prefix="/api/summary", tags=["summary"])


def _date_conditions(idx: int, params: list, date_from: str | None, date_to: str | None):
    """Build date-range WHERE conditions on start_date_time (trip date). Returns list of SQL fragments."""
    conds = []
    if date_from:
        conds.append(f"start_date_time >= ${idx}")
        params.append(datetime.fromisoformat(date_from))
        idx += 1
    if date_to:
        conds.append(f"start_date_time <= ${idx}")
        params.append(datetime.fromisoformat(date_to + 'T23:59:59'))
        idx += 1
    return conds, idx


@router.get("/funnel", response_model=FunnelData)
async def funnel(
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
):
    pool = await get_pool()
    params: list = []
    conds, _ = _date_conditions(1, params, date_from, date_to)
    where = "WHERE " + " AND ".join(conds) if conds else ""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(f"""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status IN ('Contacted','Quote Shared','Converted')) AS contacted,
                COUNT(*) FILTER (WHERE status IN ('Quote Shared','Converted')) AS quote_shared,
                COUNT(*) FILTER (WHERE status = 'Converted') AS converted,
                COUNT(*) FILTER (WHERE status = 'Closed') AS closed
            FROM rental_leads {where}
        """, *params)

    total = row["total"]
    contacted = row["contacted"]
    quote_shared = row["quote_shared"]
    converted = row["converted"]
    closed = row["closed"]

    return FunnelData(
        totalLeads=total,
        contacted=contacted,
        contactedRate=round(contacted / total * 100) if total else 0,
        quoteShared=quote_shared,
        quoteSharedRate=round(quote_shared / total * 100) if total else 0,
        converted=converted,
        convertedRate=round(converted / total * 100) if total else 0,
        closed=closed,
        closedRate=round(closed / total * 100) if total else 0,
        contactedToQuoteRate=round(quote_shared / contacted * 100) if contacted else 0,
        quoteToConvertedRate=round(converted / quote_shared * 100) if quote_shared else 0,
    )


@router.get("/stats", response_model=SummaryStats)
async def stats(
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
):
    pool = await get_pool()
    params: list = []
    conds, _ = _date_conditions(1, params, date_from, date_to)
    where = "WHERE " + " AND ".join(conds) if conds else ""

    async with pool.acquire() as conn:
        total_leads = await conn.fetchval(
            f"SELECT COUNT(*) FROM rental_leads {where}", *params
        )

        # For converted stats, add status filter
        conv_conds = conds + ["status = 'Converted'"]
        conv_where = "WHERE " + " AND ".join(conv_conds)

        row = await conn.fetchrow(f"""
            SELECT
                COALESCE(SUM(l.amount_cityflo), 0) AS total_revenue,
                COALESCE(SUM(op.cost), 0) AS total_cost,
                COUNT(*) AS conv_count
            FROM rental_leads l
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(
                    COALESCE(o.operator_amount,0) + COALESCE(o.toll_amount,0)
                    + COALESCE(o.parking_amount,0) + COALESCE(o.driver_allowances,0)
                    + COALESCE(o.extra_km_charges,0) + COALESCE(o.other_charges,0)
                ), 0) AS cost
                FROM rental_leads_operator o WHERE o.lead_id = l.id
            ) op ON TRUE
            {conv_where}
        """, *params)

    total_revenue = row["total_revenue"]
    total_cost = row["total_cost"]
    conv_count = row["conv_count"]
    total_margin = total_revenue - total_cost

    return SummaryStats(
        totalLeads=total_leads,
        totalRevenue=total_revenue,
        totalCost=total_cost,
        avgDealSize=round(total_revenue / conv_count) if conv_count else 0,
        totalMargin=total_margin,
        marginPct=round(total_margin / total_revenue * 100) if total_revenue else 0,
    )


@router.get("/source-performance", response_model=list[SourcePerformance])
async def source_performance(
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
):
    pool = await get_pool()
    params: list = []
    conds, _ = _date_conditions(1, params, date_from, date_to)
    where = "WHERE " + " AND ".join(conds) if conds else ""

    async with pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT
                COALESCE(source, 'Unknown') AS source,
                COUNT(*) AS total_leads,
                COUNT(*) FILTER (WHERE status = 'Converted') AS converted,
                COALESCE(SUM(amount_cityflo) FILTER (WHERE status = 'Converted'), 0) AS total_revenue
            FROM rental_leads
            {where}
            GROUP BY COALESCE(source, 'Unknown')
            ORDER BY total_leads DESC
        """, *params)

    return [
        SourcePerformance(
            source=r["source"],
            totalLeads=r["total_leads"],
            converted=r["converted"],
            conversionRate=round(r["converted"] / r["total_leads"] * 100) if r["total_leads"] else 0,
            totalRevenue=r["total_revenue"],
        )
        for r in rows
    ]


@router.get("/performance", response_model=list[AssigneePerformance])
async def performance(
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
):
    pool = await get_pool()
    params: list = []
    conds, _ = _date_conditions(1, params, date_from, date_to)
    where = "WHERE " + " AND ".join(conds) if conds else ""

    async with pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT
                assigned_to_email_id,
                COUNT(*) AS total_leads,
                COUNT(*) FILTER (WHERE status = 'Open') AS open,
                COUNT(*) FILTER (WHERE status = 'Contacted') AS contacted,
                COUNT(*) FILTER (WHERE status = 'Quote Shared') AS quote_shared,
                COUNT(*) FILTER (WHERE status = 'Converted') AS converted,
                COUNT(*) FILTER (WHERE status = 'Closed') AS closed,
                COALESCE(SUM(amount_cityflo) FILTER (WHERE status = 'Converted'), 0) AS total_revenue,
                AVG(EXTRACT(EPOCH FROM (modified - created)) / 3600)
                    FILTER (WHERE status != 'Open') AS avg_response_hours
            FROM rental_leads
            {where}
            GROUP BY assigned_to_email_id
            ORDER BY total_leads DESC
        """, *params)

    return [
        AssigneePerformance(
            assigned_to_email_id=r["assigned_to_email_id"],
            totalLeads=r["total_leads"],
            open=r["open"],
            contacted=r["contacted"],
            quoteShared=r["quote_shared"],
            converted=r["converted"],
            closed=r["closed"],
            conversionRate=round(r["converted"] / r["total_leads"] * 100) if r["total_leads"] else 0,
            totalRevenue=r["total_revenue"],
            avgResponseHours=round(r["avg_response_hours"], 1) if r["avg_response_hours"] is not None else None,
        )
        for r in rows
    ]
