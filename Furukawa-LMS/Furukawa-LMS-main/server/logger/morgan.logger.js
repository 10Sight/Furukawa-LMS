import morgan from "morgan";
import logger from "./winston.logger.js";
import ENV from "../configs/env.config.js";

const stream = {
    write: (message) => logger.http(message.trim()),
};

const skip = () => {
    const env = ENV.NODE_ENV || "development";
    return env !== "development";
};

const morganMiddleware = morgan(
    ":remote-addr :method :url :status - :response-time ms",
    { stream, skip }
);

export default morganMiddleware;