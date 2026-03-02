import { Routes, Route, NavLink } from 'react-router-dom'
import LeadsPage from './pages/LeadsPage'
import ConvertedPage from './pages/ConvertedPage'
import SummaryPage from './pages/SummaryPage'
import BillingPage from './pages/BillingPage'
import { AuthProvider, useAuth } from './AuthContext'
import type { Role } from './AuthContext'

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-[13px] font-medium rounded transition-colors ${isActive ? 'text-teal-700 bg-teal-50 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`

const ROLE_LABELS: Record<Role, string> = {
  manager: 'Manager',
  agent: 'Agent',
  billing: 'Billing',
}

function RoleSwitcher() {
  const { user, setUser } = useAuth()
  return (
    <select
      value={user.role}
      onChange={(e) => setUser(e.target.value as Role)}
      className="text-[13px] border border-gray-200 rounded px-2.5 py-1.5 text-gray-600 focus:outline-none focus:border-teal-400 bg-white"
    >
      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
      ))}
    </select>
  )
}

function AppContent() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-2.5 flex items-center gap-8 sticky top-0 z-50 bg-white">
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 tracking-tight leading-none">CITYFLO</div>
            <div className="text-[10px] text-gray-400 leading-none mt-0.5">Rentals</div>
          </div>
        </div>
        <nav className="flex gap-1">
          <NavLink to="/" end className={navCls}>Summary</NavLink>
          <NavLink to="/leads" className={navCls}>Leads</NavLink>
          <NavLink to="/converted" className={navCls}>Converted</NavLink>
          <NavLink to="/billing" className={navCls}>Billing</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[12px] text-gray-400">{user.name}</span>
          <RoleSwitcher />
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<SummaryPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/converted" element={<ConvertedPage />} />
          <Route path="/billing" element={<BillingPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
