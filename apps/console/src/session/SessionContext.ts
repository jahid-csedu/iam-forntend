import { createContext, useContext } from 'react'

export interface Session {
  isLoggedIn: boolean
  login: (accessToken: string, refreshToken: string, clientId: string) => void
  logout: () => void
}

// null means "no provider above me", which is a setup mistake
export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (session === null) {
    throw new Error('useSession must be used inside <SessionProvider>')
  }
  return session
}