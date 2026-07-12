import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { pool } from '../db/connectDB.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logAudit from '../utils/auditLogger.js';

const sendExcel = async (res, filename, columns, rows) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data');
  worksheet.columns = columns.map(col => ({ header: col.header, key: col.key, width: col.width || 20 }));
  rows.forEach(r => worksheet.addRow(r));
  worksheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.status(200).send(Buffer.from(buffer));
};

const sendPDF = (res, filename, title, columns, rows) => {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10);

  const colWidths = columns.map(c => c.width || 100);
  const colHeaders = columns.map(c => c.header);

  const drawRow = (vals, isHeader = false) => {
    const y = doc.y;
    let x = doc.page.margins.left;
    vals.forEach((val, idx) => {
      const w = colWidths[idx];
      const text = (val ?? '').toString();
      if (isHeader) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.text(text, x, y, { width: w, continued: false });
      x += w + 8;
    });
    doc.moveDown(0.5);
    if (isHeader) doc.moveDown(0.2);
  };

  drawRow(colHeaders, true);
  rows.forEach(r => drawRow(columns.map(c => r[c.key] ?? '')));

  doc.end();
};

export const exportCourses = asyncHandler(async (req, res) => {
  const { format = 'excel', search = '', status = '', category = '' } = req.query;

  let sql = `
    SELECT c.title, c.category, c.difficulty, c.status, c.totalEnrollments, c.createdAt, u.fullName as instructorName 
    FROM courses c 
    LEFT JOIN users u ON c.instructor = u.id 
    WHERE (c.isDeleted IS NULL OR c.isDeleted = 0)
  `;
  const params = [];

  if (search) {
    sql += " AND (c.title LIKE ? OR c.description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += " AND c.status = ?";
    params.push(status);
  }
  if (category) {
    sql += " AND c.category = ?";
    params.push(category);
  }

  sql += " ORDER BY c.createdAt DESC";

  const [courses] = await pool.query(sql, params);

  const columns = [
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Difficulty', key: 'difficulty', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Instructor', key: 'instructorName', width: 24 },
    { header: 'Enrollments', key: 'totalEnrollments', width: 12 },
    { header: 'Created At', key: 'createdAt', width: 22 },
  ];

  const rows = courses.map(c => ({
    title: c.title,
    category: c.category,
    difficulty: c.difficulty,
    status: c.status,
    instructorName: c.instructorName || '',
    totalEnrollments: c.totalEnrollments || 0,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : '',
  }));

  const filename = `courses_${new Date().toISOString().slice(0, 10)}`;
  if (format === 'pdf') return sendPDF(res, filename, 'Courses Export', columns, rows);
  return sendExcel(res, filename, columns, rows);
});

export const exportDepartments = asyncHandler(async (req, res) => {
  const { format = 'excel', search = '', status = '' } = req.query;

  let sql = `
    SELECT d.name, d.status, d.startDate, d.endDate, d.capacity, d.createdAt, d.students,
           c.title as courseTitle, u.fullName as instructorName
    FROM departments d
    LEFT JOIN courses c ON d.course = c.id
    LEFT JOIN users u ON d.instructor = u.id
    WHERE (d.isDeleted IS NULL OR d.isDeleted = 0)
  `;
  const params = [];

  if (search) {
    sql += " AND d.name LIKE ?";
    params.push(`%${search}%`);
  }
  if (status) {
    sql += " AND d.status = ?";
    params.push(status);
  }

  sql += " ORDER BY d.createdAt DESC";

  const [departments] = await pool.query(sql, params);

  const columns = [
    { header: 'Department Name', key: 'name', width: 28 },
    { header: 'Course', key: 'courseTitle', width: 28 },
    { header: 'Instructor', key: 'instructorName', width: 24 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Start Date', key: 'startDate', width: 18 },
    { header: 'End Date', key: 'endDate', width: 18 },
    { header: 'Capacity', key: 'capacity', width: 10 },
    { header: 'Students', key: 'studentCount', width: 10 },
    { header: 'Created At', key: 'createdAt', width: 22 },
  ];

  const rows = departments.map(b => {
    // Calculate student count from JSON array if string, or raw if handled by driver (usually string for JSON col in mysql2 unless cast)
    let studentCount = 0;
    if (b.students) {
      try {
        const parsed = typeof b.students === 'string' ? JSON.parse(b.students) : b.students;
        if (Array.isArray(parsed)) studentCount = parsed.length;
      } catch (e) { }
    }

    return {
      name: b.name,
      courseTitle: b.courseTitle || '',
      instructorName: b.instructorName || '',
      status: b.status,
      startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : '',
      endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : '',
      capacity: b.capacity || 0,
      studentCount: studentCount,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : '',
    };
  });

  const filename = `departments_${new Date().toISOString().slice(0, 10)}`;
  if (format === 'pdf') return sendPDF(res, filename, 'Departments Export', columns, rows);
  return sendExcel(res, filename, columns, rows);
});

export const exportStudents = asyncHandler(async (req, res) => {
  const { format = 'excel', search = '', status = '', departmentId = '' } = req.query;

  let sql = `
    SELECT u.fullName, u.userName, u.email, u.phoneNumber, u.status, u.createdAt, d.name as departmentName,
           COALESCE(c.name, u.contractor) as contractorName
    FROM users u
    LEFT JOIN departments d ON (u.department = CAST(d.id AS NVARCHAR(50)) OR u.department = d.name)
    LEFT JOIN contractors c ON u.contractorId = c.id
    WHERE u.role = 'STUDENT' AND (u.isTrainer = 0 OR u.isTrainer IS NULL) AND (u.isDeleted IS NULL OR u.isDeleted = 0)
  `;
  const params = [];

  if (search) {
    sql += " AND (u.fullName LIKE ? OR u.userName LIKE ? OR u.email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += " AND u.status = ?";
    params.push(status);
  }

  const isGlobalAdmin = req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN' || req.user?.isAdmin;
  const isAdminLayout = isGlobalAdmin ||
    (req.user.role === 'CUSTOM' && ['admin', 'superadmin'].includes(String(req.user.customRole?.targetLayout || '').toLowerCase()));

  if (!isAdminLayout) {
    if (req.user.role === 'INSTRUCTOR') {
      const { executeQuery } = await import("../db/mssqlHelper.js");
      const [iDepts] = await executeQuery("SELECT id FROM departments WHERE instructor = ?", [req.user.id]);
      if (!iDepts.length) {
        sql += " AND 1=0";
      } else {
        const ids = iDepts.map(d => d.id);
        sql += ` AND (u.departmentId IN (${ids.map(() => '?').join(',')}) OR u.department IN (${ids.map(() => '?').join(',')}))`;
        params.push(...ids, ...ids);
      }
    } else if (req.user.role === 'CUSTOM') {
      const allowedDepts = [...new Set([
        ...(Array.isArray(req.user.departments) ? req.user.departments : []),
        ...(req.user.departmentId ? [req.user.departmentId] : []),
      ].map(String).filter(Boolean))];

      if (!allowedDepts.length) {
        sql += " AND 1=0";
      } else {
        sql += ` AND (u.departmentId IN (${allowedDepts.map(() => '?').join(',')}) OR u.department IN (${allowedDepts.map(() => '?').join(',')}))`;
        params.push(...allowedDepts, ...allowedDepts);
      }
    } else if (departmentId) {
      sql += " AND u.department = ?";
      params.push(departmentId);
    }
  } else if (departmentId) {
    sql += " AND u.department = ?";
    params.push(departmentId);
  }

  sql += " ORDER BY u.createdAt DESC";

  const [students] = await pool.query(sql, params);

  const columns = [
    { header: 'Full Name', key: 'fullName', width: 26 },
    { header: 'Username', key: 'userName', width: 20 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phoneNumber', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Department', key: 'departmentName', width: 22 },
    { header: 'Contractor', key: 'contractorName', width: 22 },
    { header: 'Created At', key: 'createdAt', width: 22 },
  ];

  const rows = students.map(s => ({
    fullName: s.fullName,
    userName: s.userName,
    email: s.email,
    phoneNumber: s.phoneNumber,
    status: s.status,
    departmentName: s.departmentName || '',
    contractorName: s.contractorName || '',
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : '',
  }));

  logAudit(req.user?.id, "EXPORT_STUDENTS_LIST", { format, search, status, departmentId, count: rows.length }, { resourceType: "StudentsExport", req })
    .catch(err => console.error("logAudit(EXPORT_STUDENTS_LIST) failed:", err.message));

  const filename = `students_${new Date().toISOString().slice(0, 10)}`;
  if (format === 'pdf') return sendPDF(res, filename, 'Students Export', columns, rows);
  return sendExcel(res, filename, columns, rows);
});
