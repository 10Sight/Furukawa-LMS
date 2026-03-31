import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not defined. Check your .env file.");
}
if (!process.env.JWT_REFRESH_SECRET) {
    console.error("FATAL: JWT_REFRESH_SECRET is not defined. Check your .env file.");
}

const ENV = {
    PORT: process.env.PORT || 3000,
    MONGO_URI: process.env.MONGO_URI,

    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_ACCESS_SECRET: process.env.JWT_SECRET,
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

    // Email configuration
    SMTP_USERNAME: process.env.SMTP_USERNAME,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_HOST: process.env.SMTP_HOST || "smtp.office365.com",
    SMTP_PORT: process.env.SMTP_PORT || 587,

    // Frontend URLs
    DB_HOST: process.env.DB_HOST || "sql12.freesqldatabase.com",
    DB_USER: process.env.DB_USER || "sql12814316",
    DB_PASSWORD: process.env.DB_PASSWORD || "kqZTqdmkn2",
    DB_NAME: process.env.DB_NAME || "sql12814316",

    FRONTEND_URL: process.env.FRONTEND_URL || "http://192.168.90.19:5174",
    ADMIN_URL: process.env.ADMIN_URL || "http://localhost:5174",
    INSTRUCTOR_URL: process.env.INSTRUCTOR_URL,
    STUDENT_URL: process.env.STUDENT_URL,
    SUPERADMIN_URL: process.env.SUPERADMIN_URL,
}

export default ENV;