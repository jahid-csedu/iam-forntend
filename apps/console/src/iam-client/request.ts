import { apiBaseUrl } from "./config";
import { ApiError } from "./ApiError";

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
    body?: unknown // any value; sent as JSON
}

interface Problem {
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
        const problem = await readProblem(response)
        // Simple for now; lesson 4.3 turns this into a proper ApiError
        throw new ApiError(response.status, problem.message, problem.fieldErrors)
    }

    if (response.status === 204) {
        return undefined as T // No Content: there is no body to read
    }

    return (await response.json()) as T
}

// Read the backend's error JSON: "detail" → message, "errors" → fieldErrors
async function readProblem(response: Response): Promise<Problem> {
    const problem: Problem = {
        message: `Request failed with status ${response.status}`, // used if the body has no detail
        fieldErrors: {}
    }

    try {
        const body: {
            detail?: unknown; errors?: { field: string; message: string }[]
        } = await response.json()

        if (typeof body.detail === 'string') {
            problem.message = body.detail
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