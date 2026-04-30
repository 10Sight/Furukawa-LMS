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
export const generateSixteenDayMonitoringEmail = ({ 
    operatorName, 
    employeeCode, 
    departmentName, 
    processName, 
    headerInfo, 
    gridData, 
    config, 
    portalUrl 
}) => {
    // Generate headers for Day 1 to Day 16
    const dayHeaders = Array.from({ length: 16 }, (_, i) => `<th style="padding: 5px; border: 1px solid #000; background: #f0f9ff; font-size: 8px;">Day ${i + 1}</th>`).join('');

    // Generate rows
    let tableBody = '';
    config.forEach(cat => {
        tableBody += `<tr><td colspan="19" style="padding: 5px; border: 1px solid #000; background: #e2e8f0; font-weight: bold; font-size: 10px;">${cat.category.replace(/\n/g, '<br/>')}</td></tr>`;
        cat.rows.forEach(row => {
            let dayCells = '';
            for (let d = 1; d <= 16; d++) {
                const val = gridData[`${row.id}_d${d}`] || '';
                let color = '#fff';
                if (val === 'P') color = '#dcfce7'; 
                if (val === 'X') color = '#fee2e2';
                dayCells += `<td style="padding: 5px; border: 1px solid #000; text-align: center; font-size: 10px; background: ${color};">${val}</td>`;
            }
            tableBody += `
                <tr>
                    <td style="padding: 5px; border: 1px solid #000; font-size: 9px; width: 30%;">${row.label.replace(/\n/g, '<br/>')}</td>
                    <td style="padding: 5px; border: 1px solid #000; text-align: center; font-size: 10px;">${row.weight}</td>
                    ${dayCells}
                    <td style="padding: 5px; border: 1px solid #000; text-align: center; font-size: 10px; background: #f8fafc;">${cat.target || ''}</td>
                </tr>
            `;
        });
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.4; color: #333; }
        .container { max-width: 900px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; margin-bottom: 20px; padding-bottom: 10px; }
        .info-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-row { display: table-row; }
        .info-cell { display: table-cell; padding: 5px; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #666; width: 150px; }
        .monitoring-table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 2px solid #000; }
        .actions { margin: 30px 0; text-align: center; }
        .btn { display: inline-block; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 0 10px; color: #fff !important; }
        .btn-verify { background-color: #10b981; }
        .btn-approve { background-color: #2563eb; }
        .footer { font-size: 12px; color: #999; text-align: center; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2563eb; margin: 0;">16-Day Monitoring Report</h1>
            <p style="margin: 5px 0;">Furukawa Learning Management System</p>
        </div>

        <div class="info-grid">
            <div class="info-row">
                <div class="info-cell label">Operator Name:</div>
                <div class="info-cell">${operatorName}</div>
                <div class="info-cell label">Employee Code:</div>
                <div class="info-cell">${employeeCode}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Department:</div>
                <div class="info-cell">${departmentName}</div>
                <div class="info-cell label">Process Name:</div>
                <div class="info-cell">${processName}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Handover Date:</div>
                <div class="info-cell">${headerInfo.handoverDate || 'N/A'}</div>
                <div class="info-cell label">Status:</div>
                <div class="info-cell"><strong style="color: #2563eb;">SUBMITTED</strong></div>
            </div>
        </div>

        <table class="monitoring-table">
            <thead>
                <tr>
                    <th style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-size: 10px;">Check Point / Criteria</th>
                    <th style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-size: 10px;">Wt</th>
                    ${dayHeaders}
                    <th style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-size: 10px;">Target</th>
                </tr>
            </thead>
            <tbody>
                ${tableBody}
            </tbody>
        </table>

        <div style="margin-top: 25px; border: 1px solid #eee; padding: 15px; background: #fbfbfb;">
            <p style="font-weight: bold; color: #d32f2f; margin-top: 0; margin-bottom: 15px;">Safety First!</p>
            <div class="info-grid" style="margin-bottom: 0;">
                <div class="info-row">
                    <div class="info-cell label">Checked By:</div>
                    <div class="info-cell">${headerInfo.checkedBy || 'N/A'}</div>
                </div>
                <div class="info-row">
                    <div class="info-cell label">Verified By:</div>
                    <div class="info-cell">${headerInfo.verifiedBy || '<em>Pending Verification</em>'}</div>
                </div>
                <div class="info-row">
                    <div class="info-cell label">Approved By:</div>
                    <div class="info-cell">${headerInfo.approvedBy || '<em>Pending Approval</em>'}</div>
                </div>
            </div>
        </div>

        <div class="actions">
            <a href="${portalUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
               Review & Approve Monitoring
            </a>
        </div>

        <div class="footer">
            <p>This is an automated report generated by the Furukawa LMS.</p>
            <p>&copy; ${new Date().getFullYear()} Furukawa . All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
};
export const generateThreeDayMonitoringEmail = ({ 
    operatorName, 
    employeeCode, 
    departmentName, 
    processName, 
    lineName,
    headerInfo, 
    gridData, 
    config, 
    portalUrl 
}) => {
    // Generate headers for Day 1 to Day 3
    const dayHeaders = Array.from({ length: 3 }, (_, i) => `<th style="padding: 10px; border: 1px solid #000; background: #f0f9ff; font-size: 10px;">Day ${i + 1}</th>`).join('');

    // Generate rows
    let tableBody = '';
    config.forEach(cat => {
        tableBody += `<tr><td colspan="6" style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-weight: bold; font-size: 11px;">${cat.category.replace(/\n/g, '<br/>')}</td></tr>`;
        cat.rows.forEach(row => {
            let dayCells = '';
            for (let d = 1; d <= 3; d++) {
                const dayKey = `day${d}`;
                const val = gridData[`${row.id}_${dayKey}`] || '';
                let color = '#fff';
                dayCells += `<td style="padding: 10px; border: 1px solid #000; text-align: center; font-size: 11px; background: ${color};">${val}</td>`;
            }

            // Eval column
            const evalVal = gridData[`${row.id}_eval`] || '';

            tableBody += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #000; font-size: 10px; width: 40%;">${row.label.replace(/\n/g, '<br/>')}</td>
                    <td style="padding: 10px; border: 1px solid #000; text-align: center; font-size: 11px;">${row.weight}</td>
                    ${dayCells}
                    <td style="padding: 10px; border: 1px solid #000; text-align: center; font-size: 11px; font-weight: bold; background: #f8fafc;">${evalVal}</td>
                </tr>
            `;
        });
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.4; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; margin-bottom: 20px; padding-bottom: 10px; }
        .info-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-row { display: table-row; }
        .info-cell { display: table-cell; padding: 5px; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #666; width: 150px; }
        .monitoring-table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 2px solid #000; }
        .actions { margin: 30px 0; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 0 10px; color: #fff !important; }
        .btn-portal { background-color: #2563eb; }
        .footer { font-size: 12px; color: #999; text-align: center; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2563eb; margin: 0;">3-Day Monitoring Report</h1>
            <p style="margin: 5px 0;">Furukawa Learning Management System</p>
        </div>

        <div class="info-grid">
            <div class="info-row">
                <div class="info-cell label">Operator Name:</div>
                <div class="info-cell">${operatorName}</div>
                <div class="info-cell label">Employee Code:</div>
                <div class="info-cell">${employeeCode}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Department:</div>
                <div class="info-cell">${departmentName}</div>
                <div class="info-cell label">Process Name:</div>
                <div class="info-cell">${processName} (Line: ${lineName})</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Status:</div>
                <div class="info-cell" colspan="3"><strong style="color: #2563eb;">SUBMITTED</strong></div>
            </div>
        </div>

        <table class="monitoring-table">
            <thead>
                <tr>
                    <th style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-size: 11px;">Criteria</th>
                    <th style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-size: 11px;">Wt</th>
                    ${dayHeaders}
                    <th style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-size: 11px;">Eval</th>
                </tr>
            </thead>
            <tbody>
                ${tableBody}
            </tbody>
        </table>

         <div style="margin-top: 25px; border: 1px solid #eee; padding: 15px; background: #fbfbfb;">
            <p style="font-weight: bold; color: #d32f2f; margin-top: 0; margin-bottom: 15px;">Safety First!</p>
            <div class="info-grid" style="margin-bottom: 0;">
                <div class="info-row">
                    <div class="info-cell label">Checked By:</div>
                    <div class="info-cell">${headerInfo.checkedBy || 'N/A'}</div>
                </div>
                <div class="info-row">
                    <div class="info-cell label">Verified By:</div>
                    <div class="info-cell">${headerInfo.verifiedBy || '<em>Pending</em>'}</div>
                </div>
                <div class="info-row">
                    <div class="info-cell label">Approved By:</div>
                    <div class="info-cell">${headerInfo.approvedBy || '<em>Pending</em>'}</div>
                </div>
            </div>
        </div>

        <div class="actions">
            <a href="${portalUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
               Review & Approve Monitoring
            </a>
        </div>

        <div class="footer">
            <p>This is an automated report generated by the Furukawa LMS.</p>
            <p>&copy; ${new Date().getFullYear()} Furukawa . All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
};

export const generateMenteeFeedbackEmail = ({
    operatorName,
    employeeCode,
    departmentName,
    topTableData,
    dailyLogs,
    portalUrl
}) => {
    const questions = [
        { id: 1, topic: "Have you got On Job training from Mentor?" },
        { id: 2, topic: "Has today training content helped you in your work?" },
        { id: 3, topic: "Have you face any misbehaviour on work station by any person?" },
        { id: 4, topic: "Has mentor given solution of your query/problem?" },
        { id: 5, topic: "Are required resources available on work station?" },
        { id: 6, topic: "Other Issue/problem" },
        { id: 7, topic: "Suggestion if any" },
    ];

    const dayHeaders = Array.from({ length: 16 }, (_, i) => `<th style="padding: 5px; border: 1px solid #000; background: #fef08a; font-size: 8px;">Day ${i + 1}</th>`).join('');

    let topTableRows = questions.map(q => {
        let cells = Array.from({ length: 16 }).map((_, i) => {
            const val = topTableData[q.id]?.[i] || '-';
            return `<td style="padding: 5px; border: 1px solid #000; text-align: center; font-size: 9px;">${val}</td>`;
        }).join('');
        return `<tr><td style="padding: 5px; border: 1px solid #000; font-size: 9px;">${q.topic}</td>${cells}</tr>`;
    }).join('');

    let logRows = dailyLogs.map((log, i) => `
        <tr>
            <td style="padding: 5px; border: 1px solid #000; text-align: center; font-weight: bold;">Day ${i + 1}</td>
            <td style="padding: 5px; border: 1px solid #000;">${log.associatesFeedback || '-'}</td>
            <td style="padding: 5px; border: 1px solid #000;">${log.mentorAction || '-'}</td>
            <td style="padding: 5px; border: 1px solid #000;">${log.status1 || '-'}</td>
            <td style="padding: 5px; border: 1px solid #000;">${log.areaEngineer || '-'}</td>
            <td style="padding: 5px; border: 1px solid #000;">${log.status2 || '-'}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.4; color: #333; }
        .container { max-width: 950px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; margin-bottom: 20px; padding-bottom: 10px; }
        .info-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-row { display: table-row; }
        .info-cell { display: table-cell; padding: 5px; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #666; width: 150px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #000; }
        .footer { font-size: 12px; color: #999; text-align: center; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2563eb; margin: 0;">Mentee Feedback Monitoring Report</h1>
            <p style="margin: 5px 0;">Furukawa Learning Management System</p>
        </div>

        <div class="info-grid">
            <div class="info-row">
                <div class="info-cell label">Operator Name:</div>
                <div class="info-cell">${operatorName}</div>
                <div class="info-cell label">Employee Code:</div>
                <div class="info-cell">${employeeCode}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Department:</div>
                <div class="info-cell">${departmentName}</div>
                <div class="info-cell label">Status:</div>
                <div class="info-cell"><strong style="color: #2563eb;">SUBMITTED</strong></div>
            </div>
        </div>

        <h3 style="background: #fef08a; padding: 8px; border: 1px solid #000; margin-bottom: 0;">Feedback Grid</h2>
        <table class="table">
            <thead>
                <tr>
                    <th style="padding: 10px; border: 1px solid #000; background: #e2e8f0; font-size: 10px; text-align: left;">Topic</th>
                    ${dayHeaders}
                </tr>
            </thead>
            <tbody>
                ${topTableRows}
            </tbody>
        </table>

        <h3 style="background: #f1f5f9; padding: 8px; border: 1px solid #000; margin-top: 30px; margin-bottom: 0;">Detailed Logs</h3>
        <table class="table" style="font-size: 10px;">
            <thead>
                <tr>
                    <th style="padding: 5px; border: 1px solid #000; background: #e2e8f0;">Day</th>
                    <th style="padding: 5px; border: 1px solid #000; background: #e2e8f0;">Associates Feedback</th>
                    <th style="padding: 5px; border: 1px solid #000; background: #e2e8f0;">Mentor Action Plan</th>
                    <th style="padding: 5px; border: 1px solid #000; background: #e2e8f0;">Status</th>
                    <th style="padding: 5px; border: 1px solid #000; background: #e2e8f0;">Verification</th>
                    <th style="padding: 5px; border: 1px solid #000; background: #e2e8f0;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${logRows}
            </tbody>
        </table>

        <div style="margin-top: 40px; text-align: center;">
            <a href="${portalUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
               View Full Report in LMS
            </a>
        </div>

        <div class="footer">
            <p>This is an automated report generated by the Furukawa LMS.</p>
            <p>&copy; ${new Date().getFullYear()} Furukawa . All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
};

export const generateMaxLevelNotificationEmail = ({ 
    instructorName, 
    studentName, 
    studentId, 
    level, 
    departmentName 
}) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; margin-bottom: 20px; padding-bottom: 10px; }
        .content { margin-bottom: 30px; }
        .footer { font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        .highlight { font-weight: bold; color: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2563eb; margin: 0;">Skill Level Milestone</h1>
            <p style="margin: 5px 0;">Furukawa Learning Management System</p>
        </div>
        <div class="content">
            <p>Dear ${instructorName},</p>
            <p>This is to inform you that an operator has reached the maximum skill level defined in the current training configuration.</p>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><span class="highlight">Operator:</span> ${studentName}</p>
                <p style="margin: 5px 0;"><span class="highlight">Employee ID:</span> ${studentId}</p>
                <p style="margin: 5px 0;"><span class="highlight">Department:</span> ${departmentName}</p>
                <p style="margin: 5px 0;"><span class="highlight">Level Reached:</span> ${level}</p>
            </div>

            <p>Please review the operator's progress and update the individual monitoring sheets if required.</p>
        </div>
        <div class="footer">
            <p>This is an automated notification from Furukawa LMS.</p>
            <p>&copy; ${new Date().getFullYear()} Furukawa . All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
};


/**
 * Generate handover sheet email template with table and review button
 * @param {Object} data - Data for the email
 * @returns {string} HTML email template
 */
export const generateHandoverSheetEmail = ({ 
    departmentName, 
    sectionName, 
    date, 
    entries, 
    portalUrl 
}) => {
    const entryRows = (entries || []).map((entry, index) => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.employeeName || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.empCode || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${entry.marks || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.process || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.mentor || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 11px; color: ${entry.interviewStatus === 'APPROVE' ? '#10b981' : entry.interviewStatus === 'REJECT' ? '#ef4444' : '#6b7280'}; font-weight: bold;">
                ${entry.interviewStatus || 'Pending'}
            </td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.4; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; margin-bottom: 20px; padding-bottom: 10px; }
        .info-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .info-row { display: table-row; }
        .info-cell { display: table-cell; padding: 8px; border: 1px solid #e2e8f0; }
        .label { font-weight: bold; color: #475569; width: 120px; font-size: 12px; }
        .value { color: #1e293b; font-size: 12px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; color: #334155; }
        .actions { margin: 30px 0; text-align: center; }
        .btn { background-color: #2563eb; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Handover Sheet Report</h1>
            <p style="margin: 5px 0; color: #64748b;">Furukawa Learning Management System</p>
        </div>

        <div style="margin-bottom: 20px;">
            <p style="font-weight: bold; color: #ef4444; margin-bottom: 10px;">Safety First!</p>
            <p style="font-size: 14px;">The <strong>Handover Sheet</strong> has been submitted. Please review the details below:</p>
        </div>

        <div class="info-grid">
            <div class="info-row">
                <div class="info-cell label">Department:</div>
                <div class="info-cell value">${departmentName}</div>
                <div class="info-cell label">Section:</div>
                <div class="info-cell value">${sectionName || 'All Sections'}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Date:</div>
                <div class="info-cell value">${date || 'N/A'}</div>
                <div class="info-cell label">Status:</div>
                <div class="info-cell value"><strong style="color: #2563eb;">SUBMITTED</strong></div>
            </div>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th>SN.</th>
                    <th>Employee Name</th>
                    <th>Emp. Code</th>
                    <th>Marks</th>
                    <th>Process</th>
                    <th>Mentor</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${entryRows}
            </tbody>
        </table>

        <div class="actions">
            <a href="${portalUrl}" class="btn">Review & Approve Handover</a>
        </div>

        <div class="footer">
            <p>This is an automated report generated by the Furukawa LMS.</p>
            <p>&copy; ${new Date().getFullYear()} Furukawa . All rights reserved.</p>
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
    generateHandoverNotificationEmail,
    generateSixteenDayMonitoringEmail,
    generateThreeDayMonitoringEmail,
    generateMenteeFeedbackEmail,
    generateMaxLevelNotificationEmail,
    generateHandoverSheetEmail
};
