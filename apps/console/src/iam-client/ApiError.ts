export class ApiError extends Error {
    title: string
    status: number // HTTP status, e.g. 409
    fieldErrors: Record<string, string> // field name -> message (from a 422); empty for other errors

    constructor(status: number, title: string, message: string, fieldErrors: Record<string, string> = {}) {
        super(message)
        this.name = 'ApiError'
        this.title = title
        this.status = status
        this.fieldErrors = fieldErrors
    }
}