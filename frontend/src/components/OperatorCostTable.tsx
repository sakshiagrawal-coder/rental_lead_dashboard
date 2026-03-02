import { useState } from 'react'
import type { Operator } from '../types'
import { addOperator, updateOperator, deleteOperator } from '../api'

interface Props {
  leadId: number
  operators: Operator[]
  onRefresh: () => void
  amountCityflo: number | null
  readOnly?: boolean
}

const EMPTY_ROW = {
  operator_name: '',
  vehicle_number: '',
  operator_amount: '',
  toll_amount: '',
  parking_amount: '',
  driver_allowances: '',
  extra_km_charges: '',
  other_charges: '',
  remark: '',
}

function numOrNull(v: string): number | null {
  return v === '' ? null : Number(v)
}

export default function OperatorCostTable({ leadId, operators, onRefresh, amountCityflo, readOnly }: Props) {
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState(EMPTY_ROW)
  const [editId, setEditId] = useState<number | null>(null)
  const [editRow, setEditRow] = useState(EMPTY_ROW)
  const [busy, setBusy] = useState(false)

  const totalCost = operators.reduce((sum, o) => {
    return sum + (o.operator_amount ?? 0) + (o.toll_amount ?? 0) + (o.parking_amount ?? 0)
      + (o.driver_allowances ?? 0) + (o.extra_km_charges ?? 0) + (o.other_charges ?? 0)
  }, 0)
  const margin = (amountCityflo ?? 0) - totalCost

  const handleAdd = async () => {
    setBusy(true)
    try {
      await addOperator(leadId, {
        operator_name: newRow.operator_name || null,
        vehicle_number: newRow.vehicle_number || null,
        operator_amount: numOrNull(newRow.operator_amount),
        toll_amount: numOrNull(newRow.toll_amount),
        parking_amount: numOrNull(newRow.parking_amount),
        driver_allowances: numOrNull(newRow.driver_allowances),
        extra_km_charges: numOrNull(newRow.extra_km_charges),
        other_charges: numOrNull(newRow.other_charges),
        remark: newRow.remark || null,
      })
      setNewRow(EMPTY_ROW)
      setAdding(false)
      onRefresh()
    } finally { setBusy(false) }
  }

  const startEdit = (o: Operator) => {
    setEditId(o.id)
    setEditRow({
      operator_name: o.operator_name ?? '',
      vehicle_number: o.vehicle_number ?? '',
      operator_amount: o.operator_amount?.toString() ?? '',
      toll_amount: o.toll_amount?.toString() ?? '',
      parking_amount: o.parking_amount?.toString() ?? '',
      driver_allowances: o.driver_allowances?.toString() ?? '',
      extra_km_charges: o.extra_km_charges?.toString() ?? '',
      other_charges: o.other_charges?.toString() ?? '',
      remark: o.remark ?? '',
    })
  }

  const handleUpdate = async () => {
    if (!editId) return
    setBusy(true)
    try {
      await updateOperator(leadId, editId, {
        operator_name: editRow.operator_name || null,
        vehicle_number: editRow.vehicle_number || null,
        operator_amount: numOrNull(editRow.operator_amount),
        toll_amount: numOrNull(editRow.toll_amount),
        parking_amount: numOrNull(editRow.parking_amount),
        driver_allowances: numOrNull(editRow.driver_allowances),
        extra_km_charges: numOrNull(editRow.extra_km_charges),
        other_charges: numOrNull(editRow.other_charges),
        remark: editRow.remark || null,
      })
      setEditId(null)
      onRefresh()
    } finally { setBusy(false) }
  }

  const handleDelete = async (opId: number) => {
    if (!confirm('Delete this operator row?')) return
    setBusy(true)
    try {
      await deleteOperator(leadId, opId)
      onRefresh()
    } finally { setBusy(false) }
  }

  const InputCell = ({ value, field, row, setRow }: { value: string; field: string; row: typeof EMPTY_ROW; setRow: (r: typeof EMPTY_ROW) => void }) => (
    <input
      type={['operator_name', 'vehicle_number', 'remark'].includes(field) ? 'text' : 'number'}
      value={value}
      onChange={(e) => setRow({ ...row, [field]: e.target.value })}
      className="w-full border rounded px-1.5 py-1 text-xs"
    />
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-gray-700">Operator Costs</h4>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Margin: ₹{margin.toLocaleString()}
          </span>
          {!readOnly && !adding && (
            <button onClick={() => setAdding(true)} className="text-xs text-indigo-600 hover:underline">+ Add</button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Operator', 'Vehicle', 'Amount', 'Toll', 'Parking', 'DA', 'Extra KM', 'Other', 'Remark', ...(readOnly ? [] : [''])].map(
                (h, i) => <th key={i} className="px-2 py-1.5 text-left font-medium text-gray-500 uppercase">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {operators.map((o) => (
              !readOnly && editId === o.id ? (
                <tr key={o.id} className="bg-yellow-50">
                  {Object.keys(EMPTY_ROW).map((f) => (
                    <td key={f} className="px-1 py-1"><InputCell value={editRow[f as keyof typeof EMPTY_ROW]} field={f} row={editRow} setRow={setEditRow} /></td>
                  ))}
                  <td className="px-1 py-1 whitespace-nowrap space-x-1">
                    <button onClick={handleUpdate} disabled={busy} className="text-green-600 hover:underline">Save</button>
                    <button onClick={() => setEditId(null)} className="text-gray-500 hover:underline">Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5">{o.operator_name}</td>
                  <td className="px-2 py-1.5">{o.vehicle_number}</td>
                  <td className="px-2 py-1.5">{o.operator_amount != null ? `₹${o.operator_amount.toLocaleString()}` : '-'}</td>
                  <td className="px-2 py-1.5">{o.toll_amount != null ? `₹${o.toll_amount.toLocaleString()}` : '-'}</td>
                  <td className="px-2 py-1.5">{o.parking_amount != null ? `₹${o.parking_amount.toLocaleString()}` : '-'}</td>
                  <td className="px-2 py-1.5">{o.driver_allowances != null ? `₹${o.driver_allowances.toLocaleString()}` : '-'}</td>
                  <td className="px-2 py-1.5">{o.extra_km_charges != null ? `₹${o.extra_km_charges.toLocaleString()}` : '-'}</td>
                  <td className="px-2 py-1.5">{o.other_charges != null ? `₹${o.other_charges.toLocaleString()}` : '-'}</td>
                  <td className="px-2 py-1.5 max-w-[100px] truncate">{o.remark}</td>
                  {!readOnly && (
                    <td className="px-1 py-1.5 whitespace-nowrap space-x-1">
                      <button onClick={() => startEdit(o)} className="text-indigo-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(o.id)} disabled={busy} className="text-red-500 hover:underline">Del</button>
                    </td>
                  )}
                </tr>
              )
            ))}
            {!readOnly && adding && (
              <tr className="bg-green-50">
                {Object.keys(EMPTY_ROW).map((f) => (
                  <td key={f} className="px-1 py-1"><InputCell value={newRow[f as keyof typeof EMPTY_ROW]} field={f} row={newRow} setRow={setNewRow} /></td>
                ))}
                <td className="px-1 py-1 whitespace-nowrap space-x-1">
                  <button onClick={handleAdd} disabled={busy} className="text-green-600 hover:underline">Add</button>
                  <button onClick={() => setAdding(false)} className="text-gray-500 hover:underline">Cancel</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
