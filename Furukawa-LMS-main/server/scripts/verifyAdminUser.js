import mysql from "mysql2/promise";
import ENV from "../configs/env.config.js";

/**
 * Script to verify admin user exists in the database
 */

const verifyAdminUser = async () => {
    let connection;

    try {
        // Create database connection
        connection = await mysql.createConnection({
            host: ENV.DB_HOST,
            user: ENV.DB_USER,
            port: ENV.DB_PORT || 3306,
            password: ENV.DB_PASSWORD,
            database: ENV.DB_NAME,
        });

        console.log("Connected to database successfully\n");

        // Query for admin user
        const [users] = await connection.query(
            "SELECT id, fullName, userName, email, role, unit, status, createdAt FROM users WHERE userName = ? OR email = ?",
            ["admin123", "admin123@gmail.com"]
        );

        if (users.length > 0) {
            console.log("✅ Admin user found in database!\n");
            console.log("User Details:");
            console.log("=============");
            users.forEach(user => {
                console.log("ID:", user.id);
                console.log("Full Name:", user.fullName);
                console.log("Username:", user.userName);
                console.log("Email:", user.email);
                console.log("Role:", user.role);
                console.log("Unit:", user.unit);
                console.log("Status:", user.status);
                console.log("Created At:", user.createdAt);
                console.log("\nLogin Credentials:");
                console.log("==================");
                console.log("Email/Username:", user.email, "or", user.userName);
                console.log("Password: admin123");
            });
        } else {
            console.log("❌ Admin user not found in database!");
        }

    } catch (error) {
        console.error("❌ Error verifying admin user:", error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log("\nDatabase connection closed");
        }
    }
};

// Run the script
verifyAdminUser()
    .then(() => {
        console.log("\n✅ Verification completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Verification failed:", error);
        process.exit(1);
    });
