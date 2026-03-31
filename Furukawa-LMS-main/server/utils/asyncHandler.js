const asyncHandler = (functionHandler) => {
    return (req, res, next) => {
        Promise.resolve(functionHandler(req, res, next)).catch
        ((error) => next(error));
    };
};

export { asyncHandler };