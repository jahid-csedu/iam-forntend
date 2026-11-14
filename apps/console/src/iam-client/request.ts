import { apiBaseUrl } from "./config";
import { ApiError } from "./ApiError";

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

    let response: Response

    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            method,
            headers,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        })
    } catch {
        throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
    }

    if (!response.ok) {
        // Simple for now; lesson 4.3 turns this into a proper ApiError
        throw new ApiError(response.status, await readDetail(response))
    }

    if (response.status === 204) {
        return undefined as T // No Content: there is no body to read
    }

    return (await response.json()) as T
}

async function readDetail(response: Response): Promise<string> {
    try {
        const body: { detail?: unknown } = await response.json()

        if (typeof body.detail === 'string') {
            return body.detail
        }
    } catch {
        // The body was empty or not JSON
    }

    return `Reqeust failed with status ${response.status}`
}