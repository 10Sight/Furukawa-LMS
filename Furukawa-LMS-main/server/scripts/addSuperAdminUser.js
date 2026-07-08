import { pool } from '../db/connectDB.js';
import User from '../models/auth.model.js';

async function addSuperAdminUser() {
  const superAdminData = {
    fullName: 'Super Admin User',
    userName: 'superadmin123',
    email: 'superadmin123@gmail.com',
    password: 'superadmin123',
    phoneNumber: '0000000000',
    role: 'SUPERADMIN',
    unit: 'UNIT 1', // default unit to satisfy NOT NULL db constraint
    isVerified: 1
  };

  console.log(`Checking if user with username '${superAdminData.userName}' or email '${superAdminData.email}' already exists...`);

  // Check username
  const existingByUsername = await User.findOne({ userName: superAdminData.userName });
  if (existingByUsername) {
    console.log(`User with username '${superAdminData.userName}' already exists. (ID: ${existingByUsername.id})`);
    return existingByUsername;
  }

  // Check email
  const existingByEmail = await User.findOne({ email: superAdminData.email });
  if (existingByEmail) {
    console.log(`User with email '${superAdminData.email}' already exists. (ID: ${existingByEmail.id})`);
    return existingByEmail;
  }

  console.log('Creating super admin user...');
  const newUser = await User.create(superAdminData);
  console.log(`Super admin user created successfully! ID: ${newUser.id}`);
  return newUser;
}

(async () => {
  try {
    await addSuperAdminUser();
    process.exit(0);
  } catch (err) {
    console.error('Error adding super admin user:', err);
    process.exit(1);
  }
})();
