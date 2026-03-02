from datetime import datetime
from fastapi import APIRouter, HTTPException
from backend.db import get_pool
from backend.models import Operator, OperatorCreate, OperatorUpdate

router = APIRouter(prefix="/api/leads/{lead_id}/operators", tags=["operators"])


@router.post("", response_model=Operator)
async def add_operator(lead_id: int, body: OperatorCreate):
    pool = await get_pool()
    data = body.model_dump(exclude_unset=True)

    cols = ["lead_id", "modified"] + list(data.keys())
    vals = [lead_id, datetime.utcnow()] + list(data.values())
    placeholders = ", ".join(f"${i}" for i in range(1, len(vals) + 1))
    col_str = ", ".join(cols)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO rental_leads_operator ({col_str}) VALUES ({placeholders}) RETURNING *",
            *vals,
        )
    return Operator(**dict(row))


@router.put("/{op_id}", response_model=Operator)
async def update_operator(lead_id: int, op_id: int, body: OperatorUpdate):
    pool = await get_pool()
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

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
    params.append(op_id)
    params.append(lead_id)

    sql = (
        f"UPDATE rental_leads_operator SET {', '.join(set_parts)} "
        f"WHERE id = ${idx} AND lead_id = ${idx + 1} RETURNING *"
    )
    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql, *params)
    if not row:
        raise HTTPException(404, "Operator row not found")
    return Operator(**dict(row))


@router.delete("/{op_id}")
async def delete_operator(lead_id: int, op_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM rental_leads_operator WHERE id = $1 AND lead_id = $2",
            op_id, lead_id,
        )
    if result == "DELETE 0":
        raise HTTPException(404, "Operator row not found")
    return {"ok": True}
