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
};export const generateSixteenDayMonitoringEmail = ({ 
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
                <div class="info-row">
                    <div class="info-cell label">Verified By (Edu Cell):</div>
                    <div class="info-cell">${headerInfo.verifiedByEduCell || '<em>Pending Verification</em>'}</div>
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
                <div class="info-row">
                    <div class="info-cell label">Verified By (Edu Cell):</div>
                    <div class="info-cell">${headerInfo.verifiedByEduCell || '<em>Pending</em>'}</div>
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

export const generateCombinedMonitoringEmail = ({
    operatorName,
    employeeCode,
    departmentName,
    processName,
    headerInfo,
    gridData,
    sheetConfig,
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

    // --- Monitoring Sheet table ---
    const monitoringDayHeaders = Array.from({ length: 16 }, (_, i) =>
        `<th style="padding:4px;border:1px solid #000;background:#f0f9ff;font-size:8px;">D${i + 1}</th>`
    ).join('');

    let monitoringBody = '';
    (sheetConfig || []).forEach(cat => {
        monitoringBody += `<tr><td colspan="19" style="padding:5px;border:1px solid #000;background:#e2e8f0;font-weight:bold;font-size:10px;">${cat.category.replace(/\n/g, '<br/>')}</td></tr>`;
        cat.rows.forEach(row => {
            let dayCells = '';
            for (let d = 1; d <= 16; d++) {
                const val = gridData[`${row.id}_d${d}`] || '';
                const bg = val === 'P' ? '#dcfce7' : val === 'X' ? '#fee2e2' : '#fff';
                dayCells += `<td style="padding:4px;border:1px solid #000;text-align:center;font-size:9px;background:${bg};">${val}</td>`;
            }
            monitoringBody += `<tr>
                <td style="padding:4px;border:1px solid #000;font-size:9px;width:28%;">${row.label.replace(/\n/g, '<br/>')}</td>
                <td style="padding:4px;border:1px solid #000;text-align:center;font-size:9px;">${row.weight}</td>
                ${dayCells}
                <td style="padding:4px;border:1px solid #000;text-align:center;font-size:9px;background:#f8fafc;">${cat.target || ''}</td>
            </tr>`;
        });
    });

    // --- Feedback Sheet tables ---
    const feedbackDayHeaders = Array.from({ length: 16 }, (_, i) =>
        `<th style="padding:4px;border:1px solid #000;background:#fef08a;font-size:8px;">D${i + 1}</th>`
    ).join('');

    const feedbackTopRows = questions.map(q => {
        const cells = Array.from({ length: 16 }).map((_, i) => {
            const val = topTableData?.[q.id]?.[i] || '-';
            return `<td style="padding:4px;border:1px solid #000;text-align:center;font-size:9px;">${val}</td>`;
        }).join('');
        return `<tr><td style="padding:4px;border:1px solid #000;font-size:9px;">${q.topic}</td>${cells}</tr>`;
    }).join('');

    const feedbackLogRows = (dailyLogs || []).map((log, i) => `
        <tr>
            <td style="padding:4px;border:1px solid #000;text-align:center;font-weight:bold;">Day ${i + 1}</td>
            <td style="padding:4px;border:1px solid #000;">${log.associatesFeedback || '-'}</td>
            <td style="padding:4px;border:1px solid #000;">${log.mentorAction || '-'}</td>
            <td style="padding:4px;border:1px solid #000;">${log.status1 || '-'}</td>
            <td style="padding:4px;border:1px solid #000;">${log.areaEngineer || '-'}</td>
            <td style="padding:4px;border:1px solid #000;">${log.status2 || '-'}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
<style>
    body { font-family: Arial, sans-serif; line-height: 1.4; color: #333; }
    .container { max-width: 960px; margin: 0 auto; padding: 20px; }
    .section-title { font-size: 16px; font-weight: bold; color: #fff; padding: 10px 14px; margin: 30px 0 0 0; border-radius: 4px 4px 0 0; }
    .info-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .info-row { display: table-row; }
    .info-cell { display: table-cell; padding: 5px; border-bottom: 1px solid #eee; }
    .label { font-weight: bold; color: #666; width: 150px; }
    .sheet-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
    .footer { font-size: 11px; color: #999; text-align: center; margin-top: 40px; }
</style>
</head>
<body>
<div class="container">

    <div style="text-align:center;border-bottom:3px solid #2563eb;margin-bottom:20px;padding-bottom:10px;">
        <h1 style="color:#2563eb;margin:0;">16-Day Monitoring + Mentee Feedback Report</h1>
        <p style="margin:4px 0;color:#555;">Furukawa Learning Management System</p>
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
            <div class="info-cell">${processName || 'N/A'}</div>
        </div>
        <div class="info-row">
            <div class="info-cell label">Handover Date:</div>
            <div class="info-cell">${headerInfo?.handoverDate || 'N/A'}</div>
            <div class="info-cell label">Checked By:</div>
            <div class="info-cell">${headerInfo?.checkedBy || 'N/A'}</div>
        </div>
        <div class="info-row">
            <div class="info-cell label">Verified By:</div>
            <div class="info-cell">${headerInfo?.verifiedBy || 'Pending'}</div>
            <div class="info-cell label">Approved By:</div>
            <div class="info-cell">${headerInfo?.approvedBy || 'Pending'}</div>
        </div>
        <div class="info-row">
            <div class="info-cell label">Verified By (Edu Cell):</div>
            <div class="info-cell">${headerInfo?.verifiedByEduCell || 'Pending'}</div>
        </div>
    </div>

    <!-- SECTION 1: 16-Day Monitoring Sheet -->
    <div class="section-title" style="background:#2563eb;">Associate Performance Monitoring Check Sheet</div>
    <table class="sheet-table">
        <thead>
            <tr>
                <th style="padding:6px;border:1px solid #000;background:#e2e8f0;font-size:9px;">Check Point / Criteria</th>
                <th style="padding:6px;border:1px solid #000;background:#e2e8f0;font-size:9px;">Wt</th>
                ${monitoringDayHeaders}
                <th style="padding:6px;border:1px solid #000;background:#e2e8f0;font-size:9px;">Target</th>
            </tr>
        </thead>
        <tbody>${monitoringBody}</tbody>
    </table>

    <!-- SECTION 2: Mentee Feedback Sheet -->
    <div class="section-title" style="background:#854d0e;margin-top:40px;">Mentees Feedback Monitoring Sheet</div>
    <table class="sheet-table">
        <thead>
            <tr>
                <th style="padding:6px;border:1px solid #000;background:#fef9c3;font-size:9px;text-align:left;">Topic</th>
                ${feedbackDayHeaders}
            </tr>
        </thead>
        <tbody>${feedbackTopRows}</tbody>
    </table>

    <div style="margin-top:20px;">
        <p style="font-weight:bold;font-size:12px;margin-bottom:4px;">Detailed Logs</p>
        <table class="sheet-table" style="font-size:10px;">
            <thead>
                <tr>
                    <th style="padding:5px;border:1px solid #000;background:#e2e8f0;">Day</th>
                    <th style="padding:5px;border:1px solid #000;background:#e2e8f0;">Associates Feedback</th>
                    <th style="padding:5px;border:1px solid #000;background:#e2e8f0;">Mentor Action Plan</th>
                    <th style="padding:5px;border:1px solid #000;background:#e2e8f0;">Status</th>
                    <th style="padding:5px;border:1px solid #000;background:#e2e8f0;">Area Engineer Verification</th>
                    <th style="padding:5px;border:1px solid #000;background:#e2e8f0;">Status</th>
                </tr>
            </thead>
            <tbody>${feedbackLogRows}</tbody>
        </table>
    </div>

    <div style="margin-top:30px;text-align:center;">
        <a href="${portalUrl}"
           style="background-color:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">
            Review in LMS Portal
        </a>
    </div>

    <div class="footer">
        <p>This is an automated combined report generated by the Furukawa LMS.</p>
        <p>&copy; ${new Date().getFullYear()} Furukawa. All rights reserved.</p>
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
    const _interviewLabel = (val) => {
        if (val === 'OK') return '✓ OK';
        if (val === 'CROSS') return '✗ Cross';
        if (val === 'NA') return 'Not Required';
        return val || '—';
    };

    const entryRows = (entries || []).map((entry, index) => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.employeeName || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.empCode || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${entry.marks || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.process || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${entry.mentor || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${_interviewLabel(entry.interview1)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${_interviewLabel(entry.interview2)}</td>
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
                    <th>1st Interview</th>
                    <th>2nd Practical Interview</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${entryRows}
            </tbody>
        </table>

        <div class="actions">
            <a href="${portalUrl}" class="btn">Review &amp; Approve Handover</a>
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

/**
 * Generate 10 Cycle Sheet email template
 */
export const generateTenCycleSheetEmail = ({
    departmentName,
    sectionName,
    lineName,
    subSectionName,
    formType,
    date,
    entries,
    portalUrl
}) => {
    const formDisplayName = {
        'form1': '10-Cycle Checklist',
        'form2': '10-Cycle Observation',
        'form3': '10-Cycle Numerical'
    }[formType] || formType;

    const entryRows = (entries || []).map((entry, index) => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${entry.inspectorName || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${entry.empCode || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 11px; font-weight: bold; color: ${entry.overallResult === '✓' ? '#10b981' : entry.overallResult === 'X' ? '#ef4444' : '#6b7280'};">
                ${entry.overallResult || '-'}
            </td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${entry.passScore || '-'}</td>
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
        .table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 11px; color: #334155; }
        .actions { margin: 30px 0; text-align: center; }
        .btn { background-color: #2563eb; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">10-Cycle Sheet Report</h1>
            <p style="margin: 5px 0; color: #64748b;">Furukawa Learning Management System</p>
        </div>

        <div style="margin-bottom: 20px;">
            <p style="font-weight: bold; color: #ef4444; margin-bottom: 10px;">Safety First!</p>
            <p style="font-size: 14px;">A new <strong>10-Cycle Sheet (${formDisplayName})</strong> has been submitted. Summary of entries:</p>
        </div>

        <div class="info-grid">
            <div class="info-row">
                <div class="info-cell label">Department:</div>
                <div class="info-cell value">${departmentName}</div>
                <div class="info-cell label">Section:</div>
                <div class="info-cell value">${sectionName || '-'}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Line:</div>
                <div class="info-cell value">${lineName || '-'}</div>
                <div class="info-cell label">Sub Section:</div>
                <div class="info-cell value">${subSectionName || '-'}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Form Type:</div>
                <div class="info-cell value">${formDisplayName}</div>
                <div class="info-cell label">Date:</div>
                <div class="info-cell value">${date || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-cell label">Status:</div>
                <div class="info-cell value" colspan="3"><strong style="color: #2563eb;">SUBMITTED</strong></div>
            </div>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th>SN.</th>
                    <th>Operator Name</th>
                    <th>Emp. Code</th>
                    <th>Result</th>
                    <th>Score %</th>
                </tr>
            </thead>
            <tbody>
                ${entryRows}
            </tbody>
        </table>

        <div class="actions">
            <a href="${portalUrl}" class="btn">Review 10Cycle sheet</a>
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

/**
 * Generate Skill Matrix email template (Exact Same Format as UI)
 */
export const generateSkillMatrixEmail = ({
    departmentName,
    sectionName,
    lineName,
    subSectionName,
    month,
    entries,
    portalUrl,
    config = {}
}) => {
    const activeMachines = entries[0]?.stations || [];
    const machineCount = activeMachines.length;
    const totalCols = 5 + machineCount + 4; // SrNo, Name, Code, Exp, Pos + Stations + Plan, Actual, Status, %

    // Helper to format signatures
    const formatSign = (val) => {
        if (!val) return '<span style="color: #ccc;">-</span>';
        const parts = val.split(': ');
        if (parts.length > 1) {
            return `<strong style="color: ${parts[0] === 'Approved' ? '#10b981' : '#ef4444'};">${parts[0]}</strong><br/><small>${parts[1]}</small>`;
        }
        return val;
    };

    // Build Product/Revision Block
    const productsHtml = (config.products || []).map(p => `
        <td style="border: 1px solid black; padding: 2px; text-align: center; background: #f8fafc;">
            <div style="font-size: 9px; font-weight: bold; border-bottom: 1px solid black; background: #eee;">Product</div>
            <div style="font-size: 10px;">${p || '-'}</div>
        </td>
    `).join('');

    const revisionsHtml = (config.revisions || []).map(rev => `
        <td style="border: 1px solid black; padding: 0; text-align: center; background: #f8fafc;">
            <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                    <td style="font-size: 8px; border-bottom: 1px solid black; border-right: 1px solid black; padding: 1px; background: #eee;">Product</td>
                    <td style="font-size: 8px; border-bottom: 1px solid black; border-right: 1px solid black; padding: 1px; background: #eee;">Rev</td>
                    <td style="font-size: 8px; border-bottom: 1px solid black; padding: 1px; background: #eee;">Date</td>
                </tr>
                <tr>
                    <td style="font-size: 9px; border-right: 1px solid black; padding: 1px;">${rev.product || '-'}</td>
                    <td style="font-size: 9px; border-right: 1px solid black; padding: 1px;">${rev.revision || '-'}</td>
                    <td style="font-size: 9px; padding: 1px;">${rev.date || '-'}</td>
                </tr>
            </table>
        </td>
    `).join('');

    // Build Table Rows
    const entryRows = (entries || []).map((entry, index) => {
        const stationCells = (entry.stations || []).map(s => {
            // Simplified Skill Symbol for Email
            let levelColor = "#fff";
            let levelText = s.curr || "-";
            if (levelText === "L-0") levelColor = "#eee";
            else if (levelText.startsWith("L")) levelColor = "#fef08a";

            return `
                <td style="border: 1px solid black; text-align: center; font-size: 10px; padding: 2px; background: ${levelColor};">
                    ${levelText}
                </td>
            `;
        }).join('');

        return `
            <tr>
                <td style="border: 1px solid black; text-align: center; font-size: 10px; font-weight: bold;">${index + 1}</td>
                <td style="border: 1px solid black; text-align: left; font-size: 10px; padding-left: 4px; font-weight: bold;">${entry.manualName || entry.name || '-'}</td>
                <td style="border: 1px solid black; text-align: center; font-size: 10px;">${entry.cardNo || '-'}</td>
                <td style="border: 1px solid black; padding: 0;">
                    <div style="font-size: 8px; border-bottom: 1px solid black; text-align: center;">${entry.experience || '-'}</div>
                    <div style="font-size: 8px; text-align: center;">${entry.certDate || '-'}</div>
                </td>
                <td style="border: 1px solid black; text-align: center; font-size: 10px; font-weight: bold; background: #fef9c3;">${entry.position || '-'}</td>
                ${stationCells}
                <td style="border: 1px solid black; text-align: center; font-size: 10px;">${entry.plan || '-'}</td>
                <td style="border: 1px solid black; text-align: center; font-size: 10px; font-weight: bold; background: #f9fafb;">${entry.actual || '0'}</td>
                <td style="border: 1px solid black; text-align: center; font-size: 10px;">${entry.status || 'OK'}</td>
                <td style="border: 1px solid black; text-align: center; font-size: 10px; font-weight: bold; color: #2563eb;">
                    ${((entry.actual / (entry.plan || 1)) * 100).toFixed(0)}%
                </td>
            </tr>
        `;
    }).join('');

    // Footer Rows
    const buildFooterRow = (label, dataKey) => {
        const cells = activeMachines.map((_, i) => `
            <td style="border: 1px solid black; text-align: center; font-size: 10px; font-weight: bold; padding: 2px;">
                ${config.footerRows?.[dataKey]?.[i] || ''}
            </td>
        `).join('');
        return `
            <tr>
                <th colspan="5" style="border: 1px solid black; text-align: right; padding-right: 8px; font-size: 10px; background: #f8fafc;">${label}</th>
                ${cells}
                <td colspan="4" style="border: 1px solid black; background: #eee;"></td>
            </tr>
        `;
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 10px; background: #f1f5f9; }
        .wrapper { background: #ffffff; padding: 15px; border: 1px solid #cbd5e1; max-width: 1000px; margin: 0 auto; }
        .header-title { text-align: center; background: #1e293b; color: white; padding: 8px; margin-bottom: 5px; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 11px; }
        .meta-table td, .meta-table th { border: 1px solid black; padding: 4px; }
        .matrix-table { width: 100%; border-collapse: collapse; border: 1px solid black; }
        .matrix-table th { border: 1px solid black; background: #f1f5f9; font-size: 10px; padding: 4px; }
        .matrix-table td { border: 1px solid black; }
        .btn-container { text-align: center; margin: 20px 0; }
        .btn { background: #2563eb; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; display: inline-block; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="header-title">
            <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Skill Matrix Sheet</h2>
        </div>

        <!-- Top Metadata & Signatures -->
        <table class="meta-table">
            <tr>
                <th style="background: #f1f5f9; width: 80px;">Department</th>
                <td style="font-weight: bold; width: 120px;">${departmentName}</td>
                <th style="background: #f1f5f9; width: 80px;">Section</th>
                <td style="font-weight: bold; width: 100px;">${sectionName}</td>
                <th style="background: #f1f5f9; width: 80px;">Line</th>
                <td style="font-weight: bold; width: 100px;">${lineName}</td>
                <th style="background: #f1f5f9; width: 60px;">Shift</th>
                <td style="font-weight: bold; width: 50px; text-align: center;">${config.shift || 'A'}</td>
                <td style="padding: 0; border: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tr>
                            <td style="border: 1px solid black; font-size: 8px; text-align: center; background: #f8fafc;">QA In-charge</td>
                            <td style="border: 1px solid black; font-size: 8px; text-align: center; background: #f8fafc;">Safety In-charge</td>
                            <td style="border: 1px solid black; font-size: 8px; text-align: center; background: #f8fafc;">Process In-charge</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid black; text-align: center; height: 35px; vertical-align: middle;">${formatSign(config.signatures?.qa)}</td>
                            <td style="border: 1px solid black; text-align: center; height: 35px; vertical-align: middle;">${formatSign(config.signatures?.safety)}</td>
                            <td style="border: 1px solid black; text-align: center; height: 35px; vertical-align: middle;">${formatSign(config.signatures?.process)}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- Products & Revisions -->
        <table class="meta-table" style="width: auto;">
            <tr>
                ${productsHtml}
                ${revisionsHtml}
            </tr>
        </table>

        <!-- Legend -->
        <div style="border: 1px solid black; margin-bottom: 5px; padding: 4px; font-size: 10px; background: #fff;">
            <strong>Skill Symbol:</strong> 
            <span style="display: inline-block; margin-left: 10px;">(L-0) Under training</span>
            <span style="display: inline-block; margin-left: 10px;">(L-1) Basic Knowledge</span>
            <span style="display: inline-block; margin-left: 10px;">(L-2) Skilled</span>
            <span style="display: inline-block; margin-left: 10px;">(L-3) Highly Skilled</span>
            <span style="display: inline-block; margin-left: 10px;">(L-4) Expert/Trainer</span>
        </div>

        <!-- Main Matrix -->
        <div style="overflow-x: auto;">
            <table class="matrix-table">
                <thead>
                    <!-- Process Responsible -->
                    <tr>
                        <th colspan="5" style="text-align: right;">Process responsible person</th>
                        <th colspan="${machineCount}" style="text-align: left; background: #fff;">${config.processPersons?.responsible || '-'}</th>
                        <th colspan="4" style="background: #eee;"></th>
                    </tr>
                    <!-- Vice Process -->
                    <tr>
                        <th colspan="5" style="text-align: right;">Vice process responsible person</th>
                        <th colspan="${machineCount}" style="text-align: left; background: #fff;">${config.processPersons?.vice || '-'} ${config.processPersons?.vice2 ? '/ ' + config.processPersons.vice2 : ''}</th>
                        <th colspan="4" style="background: #eee;"></th>
                    </tr>
                    <!-- Process Name Header -->
                    <tr>
                        <th style="width: 30px;">SN</th>
                        <th style="width: 150px;">Employee Name</th>
                        <th style="width: 80px;">Code</th>
                        <th style="width: 70px;">Exp / Cert</th>
                        <th style="width: 60px;">Pos</th>
                        ${activeMachines.map(m => `
                            <th style="width: 35px; font-size: 8px;">
                                <div style="height: 100px; padding: 2px;">
                                    ${m.name}
                                </div>
                            </th>
                        `).join('')}
                        <th colspan="2" style="background: #fde047;">Process per person</th>
                        <th style="background: #fde047; width: 50px;">Status</th>
                        <th style="background: #fde047; width: 40px;">%</th>
                    </tr>
                    <!-- Min Skill Row -->
                    <tr>
                        <th colspan="5" style="text-align: right;">Min. Skill Required</th>
                        ${activeMachines.map((_, i) => `
                            <th style="background: #fff;">${config.minSkills?.[i] || 'L2'}</th>
                        `).join('')}
                        <th colspan="4" style="background: #eee;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${entryRows}
                </tbody>
                <tfoot>
                    ${buildFooterRow('Plan (Skilled Manpower)', 'plan')}
                    ${buildFooterRow('Actual', 'actual')}
                    ${buildFooterRow('% (Skilled Manpower)', 'percent')}
                </tfoot>
            </table>
        </div>

        <div class="btn-container">
            <a href="${portalUrl}" class="btn">Review & Approve</a>
        </div>

        <div style="font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px;">
            <p>Generated by Furukawa Minda Electric Pvt. Ltd. | ${new Date().toLocaleString()}</p>
            <p style="font-size: 8px;">${config.documentInfo?.docNo || 'FRM-WH-PR-009'} | Rev ${config.documentInfo?.revNo || '02'} | ${config.documentInfo?.revDate || '02.05.2022'}</p>
        </div>
    </div>
</body>
</html>
    `;
};


export const generateHandoverApprovalRequestEmail = ({ userName, empCode, departmentName, marks, process, date, portalUrl }) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Handover Approval Required</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="background:#1d4ed8;padding:24px 32px;">
            <div style="font-size:13px;color:#bfdbfe;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Furukawa Minda Electric Pvt. Ltd.</div>
            <div style="font-size:20px;color:#ffffff;font-weight:700;margin-top:6px;">Action Required: Handover Approval</div>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Dear HOD / Incharge,</p>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
                The following employee has been added to the <strong>Handover Sheet</strong> for
                <strong>${departmentName}</strong> and is awaiting your review and approval.
            </p>

            <!-- Details Card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;width:160px;">Employee Name</td>
                        <td style="padding:7px 0;color:#111827;font-weight:700;font-size:15px;">${userName}</td>
                    </tr>
                    ${empCode ? `<tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Emp. Code</td>
                        <td style="padding:7px 0;color:#111827;">${empCode}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Department</td>
                        <td style="padding:7px 0;color:#111827;">${departmentName}</td>
                    </tr>
                    ${marks ? `<tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Marks Secured</td>
                        <td style="padding:7px 0;color:#111827;">${marks}</td>
                    </tr>` : ''}
                    ${process ? `<tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Process / Sub-Section</td>
                        <td style="padding:7px 0;color:#111827;">${process}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Date</td>
                        <td style="padding:7px 0;color:#111827;">${date}</td>
                    </tr>
                </table>
            </div>

            <!-- Action Steps -->
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:#1e40af;font-weight:700;font-size:13px;">Action Required</p>
                <ol style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.8;">
                    <li>Open the Handover Sheet using the button below</li>
                    <li>Review the employee entry for <strong>${userName}</strong></li>
                    <li>Click <strong>Approve</strong> or <strong>Reject</strong> on that row</li>
                    <li>Once approved, please initiate the <strong>16-Day Monitoring</strong> for this employee</li>
                </ol>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin:28px 0;">
                <a href="${portalUrl}"
                   style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.5px;">
                    Open Handover Sheet
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
                This is an automated notification from the FME Digital Portal. &nbsp;|&nbsp; ${new Date().toLocaleString()}
            </p>
        </div>
    </div>
</body>
</html>`;
};

/**
 * Generate a consolidated warning email for associates whose planned
 * skill upgradation or multi-skilling date falls on today.
 */
export const generatePlanUpdationWarningEmail = ({
    formName,
    departmentName,
    sectionName,
    date,
    dueRows,
    portalUrl,
}) => {
    const planLabel = formName === 'Multi Skill Sheet' ? 'Multi-Skilling Plan' : 'Skill Upgradation Plan';

    const tableRows = (dueRows || []).map((row, index) => `
        <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px;">${row.userName}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${row.cardNo}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${row.shift}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px;">${row.modelLine}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px;">${row.station}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${row.quarter}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: center; font-weight: bold; color: #2563eb;">${row.targetSkill}</td>
            <td style="padding: 9px 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${row.plannedDate}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${planLabel} — Due Today</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:800px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1d4ed8;padding:24px 32px;">
        <div style="font-size:13px;color:#bfdbfe;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Furukawa Minda Electric Pvt. Ltd.</div>
        <div style="font-size:20px;color:#ffffff;font-weight:700;margin-top:6px;">${planLabel} — Planned Dates Due Today</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
        <p style="margin:0 0 16px;color:#374151;font-size:14px;">Dear HOD / Incharge,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
            The following associates have a planned skill date scheduled for today
            (<strong>${date}</strong>) that has not yet been actualized. Please take necessary action.
        </p>

        <!-- Info block -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr>
                    <td style="padding:5px 0;color:#6b7280;font-weight:600;width:140px;">Plan Type</td>
                    <td style="padding:5px 0;color:#111827;font-weight:700;">${planLabel}</td>
                </tr>
                <tr>
                    <td style="padding:5px 0;color:#6b7280;font-weight:600;">Department</td>
                    <td style="padding:5px 0;color:#111827;">${departmentName}</td>
                </tr>
                ${sectionName ? `<tr>
                    <td style="padding:5px 0;color:#6b7280;font-weight:600;">Section</td>
                    <td style="padding:5px 0;color:#111827;">${sectionName}</td>
                </tr>` : ''}
                <tr>
                    <td style="padding:5px 0;color:#6b7280;font-weight:600;">Date</td>
                    <td style="padding:5px 0;color:#111827;">${date}</td>
                </tr>
                <tr>
                    <td style="padding:5px 0;color:#6b7280;font-weight:600;">Due Associates</td>
                    <td style="padding:5px 0;color:#dc2626;font-weight:700;">${dueRows.length}</td>
                </tr>
            </table>
        </div>

        <!-- Due associates table -->
        <div style="overflow-x:auto;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
                <thead>
                    <tr style="background:#1e293b;">
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:left;">Associate Name</th>
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:center;">Card No.</th>
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:center;">Shift</th>
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:left;">Model &amp; Line</th>
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:left;">Station</th>
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:center;">Target Quarter</th>
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:center;">Target Skill</th>
                        <th style="padding:10px;border:1px solid #334155;color:#f1f5f9;font-size:12px;text-align:center;">Planned Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>

        <!-- Action note -->
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
            <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.6;">
                Please open the plan sheet, update the actual completion date for each associate listed above,
                and set the status to <strong>Completed</strong> once the upgradation is done.
            </p>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin:28px 0;">
            <a href="${portalUrl}"
               style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.5px;">
                Open ${planLabel}
            </a>
        </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:11px;">
            This is an automated notification from the FME Digital Portal. &nbsp;|&nbsp; ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </p>
    </div>
</div>
</body>
</html>`;
};

/**
 * Generate Operator Observance Check Sheet status email.
 * Summary-only (no observance grid) — operator info, sign-off status, and a review link.
 */
export const generateObservanceStatusEmail = ({
    operatorName,
    employeeCode,
    departmentName,
    lineName,
    processName,
    level1Date,
    preparedBy,
    checkedBy,
    verifiedBy,
    status,
    portalUrl
}) => {
    const formatSignOff = (val) => {
        if (!val) return '<span style="color:#94a3b8;font-weight:600;">Pending</span>';
        const isApproved = String(val).startsWith('Approved');
        const name = String(val).replace('Approved By: ', '').replace('Rejected By: ', '');
        return `<span style="color:${isApproved ? '#059669' : '#dc2626'};font-weight:700;">${isApproved ? 'Approved' : 'Rejected'}</span>
                <span style="color:#111827;"> — ${name}</span>`;
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Operator Observance Check Sheet</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="background:#1d4ed8;padding:24px 32px;">
            <div style="font-size:13px;color:#bfdbfe;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Furukawa Minda Electric Pvt. Ltd.</div>
            <div style="font-size:20px;color:#ffffff;font-weight:700;margin-top:6px;">Operator Observance Check Sheet Submitted</div>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Dear Reviewer,</p>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
                The Operator Observance Check Sheet for <strong>${operatorName}</strong> has been submitted and requires your review.
            </p>

            <!-- Details Card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;width:160px;">Operator</td>
                        <td style="padding:7px 0;color:#111827;font-weight:700;font-size:15px;">${operatorName}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Emp. Code</td>
                        <td style="padding:7px 0;color:#111827;">${employeeCode || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Department</td>
                        <td style="padding:7px 0;color:#111827;">${departmentName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Line</td>
                        <td style="padding:7px 0;color:#111827;">${lineName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Process</td>
                        <td style="padding:7px 0;color:#111827;">${processName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Level-1 Complete Date</td>
                        <td style="padding:7px 0;color:#111827;">${level1Date || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Status</td>
                        <td style="padding:7px 0;color:#2563eb;font-weight:700;">${status || 'Submitted'}</td>
                    </tr>
                </table>
            </div>

            <!-- Sign-off Card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;width:160px;">Prepared By</td>
                        <td style="padding:7px 0;color:#111827;">${preparedBy || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Checked By</td>
                        <td style="padding:7px 0;">${formatSignOff(checkedBy)}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6b7280;font-weight:600;">Verified By</td>
                        <td style="padding:7px 0;">${formatSignOff(verifiedBy)}</td>
                    </tr>
                </table>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin:28px 0;">
                <a href="${portalUrl}"
                   style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.5px;">
                    Review & Approve
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
                This is an automated notification from the FME Digital Portal. &nbsp;|&nbsp; ${new Date().toLocaleString()}
            </p>
        </div>
    </div>
</body>
</html>`;
};

export default {
    generateWelcomeEmail,
    generateInstructorWelcomeEmail,
    generateStudentWelcomeEmail,
    generateHandoverNotificationEmail,
    generateSixteenDayMonitoringEmail,
    generateThreeDayMonitoringEmail,
    generateMenteeFeedbackEmail,
    generateCombinedMonitoringEmail,
    generateMaxLevelNotificationEmail,
    generateHandoverSheetEmail,
    generateTenCycleSheetEmail,
    generateSkillMatrixEmail,
    generateHandoverApprovalRequestEmail,
    generatePlanUpdationWarningEmail,
    generateObservanceStatusEmail,
};
