import { request } from "./request";

export interface TokenResponse {
    access_token: string
    token_type: string
    expires_in: number
    refresh_token: string
    username: string
}

export function authenticate(clientId: string, username: string, password: string) {
    return request<TokenResponse>('POST', '/api/auth/authenticate', {
        auth: false,
        body: { client_id: clientId, username, password },
    })
}