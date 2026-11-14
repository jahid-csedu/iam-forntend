export class ApiError extends Error {
    status: number // HTTP status, e.g. 409

    constructor(status: number, message: string) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}