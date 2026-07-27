import User from "../models/auth.model.js";

/**
 * Script to create an admin user in the database
 * Email: admin123@gmail.com
 * Username: admin123
 * Password: admin123
 * Role: ADMIN
 */

const createAdminUser = async () => {
    try {
        console.log("Starting admin user creation/update process...");

        // Admin user details
        const adminData = {
            fullName: "Joy Dastidar",
            userName: "ST080780",
            email: "joy.dastidar@furukawaminda.com",
            phoneNumber: "9887510125",
            role: "ADMIN",
            unit: "UNIT_1",
            password: "ST080780@FME",
            isAdmin: true,
            isEmployee: false,
            isTrainer: false,
            status: "PRESENT",
            isVerified: true
        };

        // Check if user already exists
        const existingUser = await User.findOne({ 
            userName: adminData.userName 
        }) || await User.findOne({ 
            email: adminData.email 
        });

        if (existingUser) {
            console.log(`⚠️ User '${existingUser.userName}' already exists. Updating permissions...`);
            
            existingUser.isAdmin = true;
            existingUser.role = "ADMIN";
            existingUser.status = "PRESENT";
            // We don't necessarily want to reset their password here unless requested, 
            // but we ensure the core flags are correct.
            
            await existingUser.save();
            console.log(`✅ Admin permissions updated for existing user (ID: ${existingUser.id}).`);
        } else {
            console.log("Creating new admin user...");
            const newUser = await User.create(adminData);
            console.log(`✅ Admin user created successfully (ID: ${newUser.id})!`);
        }

        console.log("\nLogin Credentials:");
        console.log("==================");
        console.log("Email:    ", adminData.email);
        console.log("Username: ", adminData.userName);
        console.log("Password: ", adminData.password);
        console.log("Role:     ", adminData.role);

    } catch (error) {
        console.error("❌ Error in admin user script:", error.message);
        throw error;
    }
};

// Run the script
createAdminUser()
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
