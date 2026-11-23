import { request } from "./request";

export interface SignupRequest {
    tenantName: string
    rootUser: {
        username: string
        password: string
        fullName?: string
        email: string
    }
}

export interface SignupResponse {
    tenant: { id: number; name: string }
    rootUser: { id: number; username: string }
    managementConsole: { client_id: string; name: string}
}

export function signup(body: SignupRequest) {
    return request<SignupResponse>('POST', '/api/tenants/signup', { auth: false, body })
}