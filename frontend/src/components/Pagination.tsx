interface Props {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, total, onPageChange }: Props) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
      <span>{total} leads total</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1 border border-gray-200 rounded text-sm font-medium disabled:opacity-30 hover:border-gray-300 hover:text-gray-700 transition-colors"
        >
          Prev
        </button>
        <span className="text-gray-400">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1 border border-gray-200 rounded text-sm font-medium disabled:opacity-30 hover:border-gray-300 hover:text-gray-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
