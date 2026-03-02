import { useState } from 'react'

const STATUSES = ['Open', 'Contacted', 'Not Responded', 'Quote Shared', 'Converted', 'Closed']

interface Props {
  currentStatus: string | null
  onSave: (status: string, reason: string) => void
  onClose: () => void
}

export default function StatusUpdateModal({ currentStatus, onSave, onClose }: Props) {
  const [status, setStatus] = useState(currentStatus ?? 'Open')
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Update Status</h3>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border rounded-md px-3 py-2 mb-4 text-sm"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {status === 'Closed' && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for closing</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-4 text-sm"
              rows={3}
            />
          </>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave(status, reason)}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
