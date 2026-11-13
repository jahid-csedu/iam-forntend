import { apiBaseUrl } from "./config";

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
    body?: unknown // any value; sent as JSON
}

export async function request<T>(
    method: Method,
    path: string,
    options: RequestOptions = {}, //"= {}" so callers may leave it out
): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json' // only when we send something
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
        // Simple for now; lesson 4.3 turns this into a proper ApiError
        throw new Error(`${method} ${path} failed with status ${response.status}`)
    }
 
    if(response.status === 204) {
        return undefined as T // No Content: there is no body to read
    }

    return (await response.json()) as T
}