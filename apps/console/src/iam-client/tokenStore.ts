const STORAGE_KEY = 'iam:session'

interface StoredSession {
    refreshToken: string,
    clientId: string
}

let accessToken: string | null = null

export function saveSession(newAccessToken: string, refreshToken: string, clientId: string) {
    accessToken = newAccessToken
    const stored: StoredSession = { refreshToken, clientId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)) // object -> text
}

export function getAccessToken(): string | null {
    return accessToken
}

export function getStoredSession(): StoredSession | null {
    const text = localStorage.getItem(STORAGE_KEY)
    return text === null ? null : (JSON.parse(text) as StoredSession) // text -> object
}

export function clearSession() {
    accessToken = null
    localStorage.removeItem(STORAGE_KEY)
}