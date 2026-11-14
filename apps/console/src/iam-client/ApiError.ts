export class ApiError extends Error {
    status: number // HTTP status, e.g. 409
    fieldErrors: Record<string, string> // field name -> message (from a 422); empty for other errors

    constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.fieldErrors = fieldErrors
    }
}