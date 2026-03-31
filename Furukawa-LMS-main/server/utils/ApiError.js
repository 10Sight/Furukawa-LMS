class ApiError extends Error {
    constructor(
        message = "Something went wrong",
        statuscode,
        errors = [],
        stack = ""
    ) {
        // Handle cases where arguments are passed as (statuscode, message) instead of (message, statuscode)
        if (typeof message === 'number') {
            const temp = message;
            message = statuscode;
            statuscode = temp;
        }

        super(message);

        this.statuscode = statuscode || 500;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };