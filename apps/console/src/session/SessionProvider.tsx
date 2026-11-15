import { useState, type ReactNode } from 'react'
import { clearSession, getAccessToken, saveSession } from '../iam-client/tokenStore'
import { SessionContext } from './SessionContext'

interface SessionProviderProps {
  children: ReactNode
}

function SessionProvider({ children }: SessionProviderProps) {
  // Logged in = we hold an access token. A reload clears it; module 6 will use the refresh token instead
  const [isLoggedIn, setIsLoggedIn] = useState(getAccessToken() !== null)

  const login = (accessToken: string, refreshToken: string, clientId: string) => {
    saveSession(accessToken, refreshToken, clientId) // keep the tokens
    setIsLoggedIn(true)                              // tell React: redraw everyone listening
  }

  const logout = () => {
    clearSession()
    setIsLoggedIn(false)
  }

  return <SessionContext value={{ isLoggedIn, login, logout }}>{children}</SessionContext>
}

export default SessionProvider