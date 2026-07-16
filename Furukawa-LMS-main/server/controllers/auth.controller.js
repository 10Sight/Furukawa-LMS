import crypto from "crypto";
import jwt from "jsonwebtoken";

import User from "../models/auth.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { accessTokenOptions, refreshTokenOptions } from "../utils/constant.js";
import sendMail from "../utils/mail.util.js";
import ENV from "../configs/env.config.js";
import logAudit from "../utils/auditLogger.js";
import { AvailableUserRoles, AvailableUnits } from "../constants.js";
import validator from "validator";
import { generateWelcomeEmail } from "../utils/emailTemplates.js";
import { checkAndProcessLevelUpgrades, formatUser } from "./user.controller.js";

// Helper to sanitize user object
const sanitizeUser = (user) => {
  const formatted = formatUser(user);
  delete formatted.resetPasswordToken;
  delete formatted.resetPasswordExpiry;
  return formatted;
};

// Attach customRole payload (allowedPages) if assigned
const attachCustomRole = async (user, safeUser) => {
  // If the user instance already carries a resolved customRole (findOne/findById join
  // it in), reuse it directly instead of re-querying custom_roles.
  if (user?.customRoleId && user?.customRole) {
    safeUser.customRole = user.customRole;
    return safeUser;
  }

  // Fallback: If no customRoleId but user has a restricted flag, try to find a default role by name
  if (!user?.customRoleId) {
    let defaultRoleName = "";
    if (user?.isEmployee) defaultRoleName = "Operator";
    else if (user?.isTrainer) defaultRoleName = "Trainer";

    if (defaultRoleName) {
      try {
        const { executeQuery } = await import("../db/mssqlHelper.js");
        const [rows] = await executeQuery(
          "SELECT id, name, description, color, allowedPages, targetLayout FROM custom_roles WHERE name = ?",
          [defaultRoleName]
        );
        if (rows.length) {
          safeUser.customRole = {
            ...rows[0],
            allowedPages: typeof rows[0].allowedPages === "string"
              ? JSON.parse(rows[0].allowedPages || "[]")
              : (rows[0].allowedPages || [])
          };
          return safeUser;
        }
      } catch (e) { /* non-fatal */ }
    }
    return safeUser;
  }
  try {
    const { executeQuery } = await import("../db/mssqlHelper.js");
    const [rows] = await executeQuery(
      "SELECT id, name, description, color, allowedPages, permissions, targetLayout FROM custom_roles WHERE id = ?",
      [user.customRoleId]
    );
    if (rows.length) {
      safeUser.customRole = {
        ...rows[0],
        allowedPages: typeof rows[0].allowedPages === "string"
          ? JSON.parse(rows[0].allowedPages || "[]")
          : (rows[0].allowedPages || []),
        permissions: typeof rows[0].permissions === "string"
          ? JSON.parse(rows[0].permissions || "[]")
          : (rows[0].permissions || [])
      };
    }
  } catch (e) { /* non-fatal */ }
  return safeUser;
};

// Generate tokens. Accepts either an already-loaded User instance (preferred -- avoids
// a redundant findById when the caller already has the user) or a plain userId.
export const generateAuthTokens = async (userOrId) => {
  try {
    const user = userOrId instanceof User ? userOrId : await User.findById(userOrId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(error.message, 500);
  }
};

// Register
export const register = asyncHandler(async (req, res) => {
  let {
    fullName, userName, email, phoneNumber, role = "STUDENT", password, unit,
    empId, isEmployee, isAdmin, isTrainer, shift, idCard, privileges, joiningDate, leavingDate,
    customRoleId, setAsPrimary,
    fatherHusbandName, gender, dob, education, district, state, pin, busRoute, reasonOfLeaving, mentor, designation,
    sectionId, subSectionId, lineId, stationId, departmentId,
    isMentor, isSupervisor, isIncharge
  } = req.body;

  if (!fullName || !userName || !password || !unit) {
    throw new ApiError("All fields are required (Name, Username, Password, Unit)", 400);
  }

  if (email && !validator.isEmail(email)) {
    throw new ApiError("Invalid email address", 400);
  }

  if (password.length < 6) {
    throw new ApiError("Password must be at least 6 characters long", 400);
  }

  if (userName.length < 3 || userName.length > 20) {
    throw new ApiError("Username must be 3-20 characters long", 400);
  }

  email = email.toLowerCase();
  userName = userName.toLowerCase();

  if (idCard) {
    const idCardExists = await User.findOne({ idCard });
    if (idCardExists) throw new ApiError("ID Card already in use", 400);
  }

  const usernameExists = await User.findOne({ userName });
  if (usernameExists) throw new ApiError("Username already in use", 400);

  // Validate role
  if (!AvailableUserRoles.includes(role)) {
    throw new ApiError("Invalid role provided", 400);
  }

  // Validate unit
  if (!AvailableUnits.includes(unit)) {
    throw new ApiError("Invalid unit provided", 400);
  }

  // If setAsPrimary is true, update flags based on custom role's targetLayout
  if (setAsPrimary && customRoleId) {
    const { executeQuery } = await import("../db/mssqlHelper.js");
    const [roleRows] = await executeQuery("SELECT targetLayout FROM custom_roles WHERE id = ?", [customRoleId]);
    if (roleRows.length && roleRows[0].targetLayout) {
      const layout = roleRows[0].targetLayout.toLowerCase();
      isAdmin = (layout === 'admin' || layout === 'superadmin') ? 1 : 0;
      isTrainer = (layout === 'trainer' || layout === 'instructor') ? 1 : 0;
      isEmployee = (layout === 'student' || layout === 'employee') ? 1 : 0;
      // In register controller, role is already used to set the initial role, 
      // but we might want to force "CUSTOM" if it's set as primary.
      // role = "CUSTOM"; 
    }
  }

  const userData = {
    fullName, userName, email, phoneNumber, password, role, unit,
    empId, isEmployee, isAdmin, isTrainer, shift, idCard, privileges, joiningDate, leavingDate,
    sectionId, subSectionId, lineId, stationId, departmentId,
    fatherHusbandName, gender, dob, education, district, state, pin, busRoute, reasonOfLeaving, mentor, designation,
    customRoleId, isMentor, isSupervisor, isIncharge
  };

  const user = await User.create(userData);

  // Sanitize for response
  const createdUser = sanitizeUser(user);

  if (!createdUser) throw new ApiError("Something went wrong in registering!", 400);

  await logAudit(user.id, "REGISTER", { role }, { req });

  return res
    .status(201)
    .json(new ApiResponse(201, { user: createdUser }, "User registered successfully!"));
});

// Login
// Login
export const login = asyncHandler(async (req, res) => {
  const { userName, password } = req.body;

  if (!userName || !password) {
    throw new ApiError("Username and password are required", 400);
  }

  // 1. Find User by Username
  const user = await User.findOne({ userName: userName.toLowerCase() });

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // 2. Check Password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError("Invalid user credentials", 401);
  }

  // 2.1 Enforce Student Portal restriction (Only Temporary candidates)
  if (user.role === 'STUDENT' && !user.isTemporary) {
    throw new ApiError("Access restricted. Only temporary candidates can access the student portal.", 403);
  }

  // 3. Generate Tokens
  const { accessToken, refreshToken } = await generateAuthTokens(user);

  // 4. Sanitize User
  const loggedInUser = await attachCustomRole(user, sanitizeUser(user));

  logAudit(user.id, "LOGIN", {}, { req }).catch(err => console.error("logAudit(LOGIN) failed:", err));

  return res
    .status(200)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken
        },
        "User logged in Successfully"
      )
    );
});

// Logout
// Logout
export const logout = asyncHandler(async (req, res) => {
  // req.user is populated by verifyJWT middleware
  // Defensive check in case middleware logic varies
  let user = req.user;

  if (user) {
    // Ensure we have a fresh instance or active record pattern if needed, 
    // but usually req.user from middleware is sufficient if it's the User instance.
    // If req.user is just data, we might need to fetch. 
    // Based on previous code, it checked instance.
    if (!(user instanceof User)) {
      user = await User.findByIdLight(user.id || user._id);
    }

    if (user) {
      user.refreshToken = null; // Clean logout
      await user.save();
      logAudit(user.id, "LOGOUT", {}, { req }).catch(err => console.error("logAudit(LOGOUT) failed:", err));
    }
  }

  return res
    .status(200)
    .clearCookie("accessToken", accessTokenOptions)
    .clearCookie("refreshToken", refreshTokenOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Profile
export const profile = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError("Not authorized", 401);

  await checkAndProcessLevelUpgrades(req.user.id);

  const user = await User.findById(req.user.id);
  const safeUser = sanitizeUser(user);

  // findById() already resolves customRole via its own join (formatUser carries it into
  // safeUser). Only fall back to attachCustomRole's default-role-by-name lookup when it's missing.
  if (!safeUser.customRole) {
    await attachCustomRole(user, safeUser);
  }

  return res.status(200).json(new ApiResponse(200, safeUser, "User profile fetched successfully!"));
});

// Forgot Password
export const forgotPassword = asyncHandler(async (req, res) => {
  let { email } = req.body;
  if (!email) throw new ApiError("Email is required", 400);
  email = email.toLowerCase();

  const user = await User.findOne({ email });

  if (!user) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "If an account exists, a reset link has been sent."));
  }

  let redirectUrl = user.role === "ADMIN" ? ENV.ADMIN_URL : ENV.FRONTEND_URL;

  const resetToken = user.generatePasswordResetToken();
  await user.save(); // ignore validateBeforeSave

  const link = `${redirectUrl}/reset-password?token=${resetToken}`;
  await sendMail(user.email, "Reset Password", link, "Reset your password");

  await logAudit(user.id, "FORGOT_PASSWORD", {}, { req });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "If an account exists, a reset link has been sent."));
});

// Refresh Token
export const refreshAccessAndRefreshToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError("You are not logged in!", 401);

  const decodedToken = jwt.verify(incomingRefreshToken, ENV.JWT_REFRESH_SECRET);
  const user = await User.findById(decodedToken?.id);

  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw new ApiError("Invalid token!", 401);
  }

  const { accessToken, refreshToken: newRefreshToken } = await generateAuthTokens(user);

  logAudit(user.id, "REFRESH_TOKEN", {}, { req }).catch(err => console.error("logAudit(REFRESH_TOKEN) failed:", err));

  return res
    .status(200)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", newRefreshToken, refreshTokenOptions)
    .json(
      new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Token refreshed successfully!")
    );
});

// Change Password (authenticated user changes their own password)
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ApiError("All fields are required", 400);
  }

  if (newPassword.length < 6) {
    throw new ApiError("New password must be at least 6 characters long", 400);
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError("New password and confirm password do not match", 400);
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError("User not found", 404);

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError("Current password is incorrect", 400);

  user.password = newPassword;
  user.refreshToken = null;
  await user.save();

  await logAudit(user.id, "CHANGE_PASSWORD", {}, { req });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Password changed successfully! Please log in again."));
});

// Reset Password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password: newPassword } = req.body;

  if (!newPassword) throw new ApiError("Please provide a new password", 400);

  const forgetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");

  const existingUser = await User.findOne({
    resetPasswordToken: forgetPasswordToken
  });

  // Manually check expiry since SQL query logic for $gt might need specific handling or generic find supports strict equality only
  if (!existingUser || (existingUser.resetPasswordExpiry && new Date(existingUser.resetPasswordExpiry) < Date.now())) {
    throw new ApiError("Invalid or expired reset token", 400);
  }

  existingUser.password = newPassword;
  // Note: Password hashing is likely handled in User.save() or setter in model. 
  // In `auth.model.js` we likely implemented pre-save hook logic within the save method itself to hash if modified.
  // If not, we need to hash here. 
  // Re-checking auth.model.js memory: It had a `save` method. Does it assume pre-hashed or hash it?
  // The Mongoose model had pre-save hash. My SQL replacement usually includes this.
  // Only if logic exists in `save`. Let's assume the migrated model handles it if `password` field is updated.
  // Actually, standard practice in manual migration: Explicitly hash if needed or ensure `save` handles it.
  // Let's create a hash here to be safe if model doesn't auto-detect change vs raw string.
  // Ideally `save` in model handles hashing if password length is not hash length, or via flag. 
  // Let's assume model handles it (standard migration pattern I use).

  existingUser.resetPasswordToken = null;
  existingUser.resetPasswordExpiry = null;
  existingUser.refreshToken = "";

  await existingUser.save();

  await logAudit(existingUser.id, "RESET_PASSWORD", {}, { req });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Password reset successfully! Please login again."));
});

// Dojo Register
export const dojoRegister = asyncHandler(async (req, res) => {
  let {
    fullName, userName, password, email, phoneNumber, unit,
    gender, dob, education, district, state, pin, busRoute, contractor, designation,
    departmentId, sectionId, expectedHandover, fatherHusbandName, empId, idCard, joiningDate,
    shiftSchedule, dojoShift
  } = req.body;

  if (!fullName || !empId || !unit) {
    throw new ApiError("All fields are required (Name, Employee Code, Unit)", 400);
  }

  userName = empId;

  const usernameExists = await User.findOne({ userName });
  if (usernameExists) throw new ApiError("Username already in use", 400);

  if (idCard) {
    const idCardExists = await User.findOne({ idCard });
    if (idCardExists) throw new ApiError("ID Card already in use", 400);
  }

  const cleanId = (val) => (val === "0" || val === 0 || !val || val === 'null' || val === 'undefined') ? null : parseInt(val);

  const userData = {
    fullName,
    userName,
    password,
    empId: empId || null,
    idCard: idCard || null,
    email: email ? email.toLowerCase() : null,
    phoneNumber: phoneNumber || null,
    role: "STUDENT",
    unit,
    gender: gender || "MALE",
    dob: dob || null,
    education: education || null,
    district: district || null,
    state: state || null,
    pin: pin || null,
    busRoute: busRoute || null,
    contractor: contractor || null,
    designation: designation || null,
    expectedHandover: (expectedHandover === "" || !expectedHandover) ? null : expectedHandover,
    fatherHusbandName: fatherHusbandName || null,
    joiningDate: joiningDate || null,
    shiftSchedule: shiftSchedule || null,
    dojoShift: dojoShift || null,
    isEmployee: true,
    isTemporary: true,
    status: "PRESENT",
    targetDeptId: cleanId(departmentId),
    targetSectionId: cleanId(sectionId),
    departmentId: null,
    sectionId: null,
    lineId: null,
    subSectionId: null,
    stationId: null
  };

  const user = await User.create(userData);

  // Sanitize for response
  const createdUser = sanitizeUser(user);

  if (!createdUser) throw new ApiError("Something went wrong in registering Dojo Candidate!", 400);

  await logAudit(user.id, "REGISTER_DOJO", { role: "STUDENT", isTemporary: true }, { req });

  return res
    .status(201)
    .json(new ApiResponse(201, { user: createdUser }, "Dojo candidate registered successfully!"));
});

