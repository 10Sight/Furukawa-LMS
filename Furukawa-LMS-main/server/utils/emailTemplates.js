/**
 * Email template utilities for generating HTML emails
 */

/**
 * Generate welcome email template for new users
 * @param {Object} userData - User information
 * @param {string} userData.fullName - Full name of the user
 * @param {string} userData.email - Email address
 * @param {string} userData.userName - Username for login
 * @param {string} userData.phoneNumber - Phone number
 * @param {string} userData.password - Plain text password (temporary)
 * @param {string} userData.role - User role (STUDENT, INSTRUCTOR, etc.)
 * @param {string} loginUrl - URL for login page
 * @returns {string} HTML email template
 */
export const generateWelcomeEmail = (userData, loginUrl) => {
    const { fullName, email, userName, phoneNumber, password, role } = userData;

    const roleDisplayName = {
        'STUDENT': 'Student',
        'INSTRUCTOR': 'Instructor',
        'ADMIN': 'Administrator',
        'SUPERADMIN': 'Super Administrator'
    }[role] || role;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Furukawa Learning Management System</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            color: #2563eb;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .welcome-text {
            color: #666;
            font-size: 16px;
        }
        .credentials-box {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .credential-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .credential-row:last-child {
            border-bottom: none;
        }
        .credential-label {
            font-weight: bold;
            color: #374151;
            min-width: 120px;
        }
        .credential-value {
            color: #1f2937;
            font-family: monospace;
            background: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid #d1d5db;
        }
        .password-warning {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .password-warning h4 {
            color: #92400e;
            margin: 0 0 10px 0;
            font-size: 16px;
        }
        .password-warning p {
            color: #92400e;
            margin: 0;
            font-size: 14px;
        }
        .login-button {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
        }
        .login-button:hover {
            background: #1d4ed8;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #6b7280;
            font-size: 14px;
        }
        .role-badge {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Furukawa LMS</div>
            <div class="welcome-text">Learning Management System</div>
        </div>

        <h2>Welcome ${fullName}!</h2>
        
        <p>Your account has been created successfully. You have been registered as a <span class="role-badge">${roleDisplayName}</span> in our Learning Management System.</p>

        <div class="credentials-box">
            <h3 style="margin-top: 0; color: #374151;">Your Account Details</h3>
            
            <div class="credential-row">
                <span class="credential-label">Full Name:</span>
                <span class="credential-value">${fullName}</span>
            </div>
            
            <div class="credential-row">
                <span class="credential-label">Email:</span>
                <span class="credential-value">${email}</span>
            </div>
            
            <div class="credential-row">
                <span class="credential-label">Username:</span>
                <span class="credential-value">${userName}</span>
            </div>
            
            <div class="credential-row">
                <span class="credential-label">Phone Number:</span>
                <span class="credential-value">${phoneNumber}</span>
            </div>
            
            <div class="credential-row">
                <span class="credential-label">Role:</span>
                <span class="credential-value">${roleDisplayName}</span>
            </div>
            
            <div class="credential-row">
                <span class="credential-label">Password:</span>
                <span class="credential-value">${password}</span>
            </div>
        </div>

        <div class="password-warning">
            <h4>🔒 Important Security Notice</h4>
            <p>Please log in and change your password immediately after your first login for security purposes. Keep your login credentials safe and do not share them with others.</p>
        </div>

        <div style="text-align: center;">
            <a href="${loginUrl}" class="login-button">Login to Your Account</a>
        </div>

        <div style="margin: 20px 0; padding: 15px; background: #f0f9ff; border-radius: 6px;">
            <h4 style="color: #0369a1; margin: 0 0 10px 0;">What's Next?</h4>
            <ul style="color: #0369a1; margin: 0; padding-left: 20px;">
                <li>Click the login button above to access your account</li>
                <li>Change your password after first login</li>
                <li>Complete your profile setup</li>
                ${role === 'STUDENT' ? '<li>Explore available courses and enroll</li>' : ''}
                ${role === 'INSTRUCTOR' ? '<li>Review your assigned departments and courses</li>' : ''}
                <li>Contact support if you need any assistance</li>
            </ul>
        </div>

        <div class="footer">
            <p>If you have any questions or need assistance, please contact our support team.</p>
            <p><strong>Furukawa </strong><br>
            Learning Management System</p>
            <p style="font-size: 12px; margin-top: 15px;">
                This email contains sensitive information. Please keep it secure and do not forward to others.
            </p>
        </div>
    </div>
</body>
</html>
  `;
};

/**
 * Generate instructor credentials email template
 * @param {Object} userData - Instructor information
 * @param {string} loginUrl - URL for instructor login
 * @returns {string} HTML email template
 */
export const generateInstructorWelcomeEmail = (userData, loginUrl) => {
    return generateWelcomeEmail(userData, loginUrl);
};

/**
 * Generate student credentials email template
 * @param {Object} userData - Student information
 * @param {string} loginUrl - URL for student login
 * @returns {string} HTML email template
 */
export const generateStudentWelcomeEmail = (userData, loginUrl) => {
    return generateWelcomeEmail(userData, loginUrl);
};

/**
 * Generate handover notification email template for department trainer
 * @param {Object} data - Data for the email
 * @param {string} data.instructorName - Name of the trainer
 * @param {string} data.departmentName - Name of the department
 * @param {Array} data.students - List of students handed over
 * @returns {string} HTML email template
 */
export const generateHandoverNotificationEmail = ({ instructorName, departmentName, students }) => {
    const studentRows = students.map((student, index) => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${index + 1}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${student.employeeName}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${student.empCode}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${student.marks || 'N/A'}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Employees Handed Over - Furukawa LMS</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 15px; }
        .logo { color: #2563eb; font-size: 24px; font-weight: bold; }
        .content { margin-bottom: 30px; }
        .table-container { margin: 20px 0; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px; background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Furukawa LMS</div>
            <p>Department Handover Notification</p>
        </div>

        <div class="content">
            <p>Dear <strong>${instructorName}</strong>,</p>
            
            <p>The following employees have successfully completed their induction training and are now eligible to work in the <strong>${departmentName}</strong> department.</p>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Employee Name</th>
                            <th>Employee Code</th>
                            <th>Marks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentRows}
                    </tbody>
                </table>
            </div>

            <p>These employees have been formally handed over to your department on the shop floor.</p>
        </div>

        <div class="footer">
            <p>This is an automated notification from the Furukawa Learning Management System.</p>
        </div>
    </div>
</body>
</html>
    `;
};

export default {
    generateWelcomeEmail,
    generateInstructorWelcomeEmail,
    generateStudentWelcomeEmail,
    generateHandoverNotificationEmail
};
// ... existing code ...

/**
 * Generate max level notification email
 * @param {Object} data - Data for email
 * @param {string} data.instructorName - Name of the instructor
 * @param {string} data.studentName - Name of the student
 * @param {string} data.studentId - ID of the student
 * @param {string} data.level - The max level reached
 * @param {string} data.departmentName - Name of the department
 * @returns {string} HTML email template
 */
export const generateMaxLevelNotificationEmail = ({ instructorName, studentName, studentId, level, departmentName }) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Max Skill Level Reached Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        .title { color: #2563eb; font-size: 24px; font-weight: bold; }
        .content { margin-bottom: 20px; }
        .highlight { background-color: #f0f9ff; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">Max Skill Level Reached</div>
        </div>
        <div class="content">
            <p>Dear <strong>${instructorName}</strong>,</p>
            
            <p>This is to inform you that the following operator has successfully reached the maximum skill level <strong>(${level})</strong> based on the current active course configuration.</p>
            
            <div class="highlight">
                <p><strong>Operator Name:</strong> ${studentName}</p>
                <p><strong>Employee ID:</strong> ${studentId}</p>
                <p><strong>Department:</strong> ${departmentName}</p>
                <p><strong>Current Level:</strong> ${level}</p>
            </div>

            <p style="color: #d97706; font-weight: bold;">Action Required:</p>
            <p>Please note that this operator should be added to the <strong>Multi-Skilling Training Plan</strong> after 90 days from today.</p>
        </div>
        <div class="footer">
            <p>This is an automated notification from the Learning Management System.</p>
            <p>&copy; ${new Date().getFullYear()} Furukawa . All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
};
