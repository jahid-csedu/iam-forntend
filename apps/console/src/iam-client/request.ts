import { apiBaseUrl } from "./config";
import { ApiError } from "./ApiError";
import { getAccessToken } from "./tokenStore"

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
    body?: unknown // any value; sent as JSON
    auth?: boolean // false for public endpoints (signup, login, health ...). Default: true
}

interface Problem {
    title: string
    message: string
    fieldErrors: Record<string, string>
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

    if (options.auth !== false) {
        const token = getAccessToken()
        if (token !== null) {
            headers.Authorization = `Bearer ${token}`
        }
    }

    let response: Response

    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            method,
            headers,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        })
    } catch {
        throw new ApiError(0, "Connection Error", "Can't reach the server. Check your connection and try again.")
    }

    if (!response.ok) {
        const problem = await readProblem(response)
        // Simple for now; lesson 4.3 turns this into a proper ApiError
        throw new ApiError(response.status, problem.title, problem.message, problem.fieldErrors)
    }

    if (response.status === 204) {
        return undefined as T // No Content: there is no body to read
    }

    return (await response.json()) as T
}

// Read the backend's error JSON: "detail" → message, "errors" → fieldErrors
async function readProblem(response: Response): Promise<Problem> {
    const problem: Problem = {
        title: 'Error',
        message: `Request failed with status ${response.status}`, // used if the body has no detail
        fieldErrors: {}
    }

    try {
        const body: {
            title?: unknown; detail?: unknown; errors?: { field: string; message: string }[]
        } = await response.json()

        if (typeof body.detail === 'string') {
            problem.message = body.detail
        }

        if(typeof body.title === 'string') {
            problem.title = body.title
        }

        if (Array.isArray(body.errors)) {
            for (const item of body.errors) {
                problem.fieldErrors[item.field] = item.message
            }
        }

    } catch {
        // The body was empty or not JSON: keep the defaults
    }

    return problem
}