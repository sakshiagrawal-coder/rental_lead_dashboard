import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type Role = 'manager' | 'agent' | 'billing'

export interface User {
  role: Role
  email: string
  name: string
}

const PRESET_USERS: Record<Role, User> = {
  manager: { role: 'manager', email: 'priya.mehta@cityflo.com', name: 'Priya Mehta' },
  agent: { role: 'agent', email: 'vaibhavi.salvi@cityflo.com', name: 'Vaibhavi Salvi' },
  billing: { role: 'billing', email: 'rahul.gupta@cityflo.com', name: 'Rahul Gupta' },
}

interface AuthContextValue {
  user: User
  setUser: (role: Role) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User>(PRESET_USERS.agent)
  const setUser = (role: Role) => setUserState(PRESET_USERS[role])
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Returns true if the current user can edit this lead */
export function canEdit(user: User, leadAssignedTo: string | null | undefined): boolean {
  return user.role === 'agent' && user.email === leadAssignedTo
}
