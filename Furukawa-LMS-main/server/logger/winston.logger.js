import winston from "winston";
import ENV from "../configs/env.config.js";
import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

//Levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Check if environment is development or production
const level = () => {
    const env = ENV.NODE_ENV;
    const isDevelopment = env === "development";
    return isDevelopment ? "debug" : "warn";
};

//colors of error, warning and logs
const colors = {
    error: "red",
    warn: "yellow",
    info: "blue",
    http: "magenta",
    debug: "white",
};

// add colors to consoles
winston.addColors(colors);

//format of console
const format = winston.format.combine(
    winston.format.timestamp({ format: "DD MMM, YYYY - HH:mm:ss:ms" }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
    )
);

//files of log files
const transportsArr = [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/info.log", level: "info" }),
    new winston.transports.File({ filename: "logs/http.log", level: "http" }),
];

//create logger
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports: transportsArr,
});

export default logger;