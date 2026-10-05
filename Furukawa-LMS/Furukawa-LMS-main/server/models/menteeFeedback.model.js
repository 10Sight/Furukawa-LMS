import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";

class MenteeFeedback {
    constructor(data) {
        this.id = data.id;
        this.studentId = data.studentId;

        // JSON data for top table (questions and Y/N responses)
        this.topTableData = typeof data.topTableData === 'string'
            ? JSON.parse(data.topTableData)
            : (data.topTableData || {});

        // JSON data for daily detailed logs
        this.dailyLogs = typeof data.dailyLogs === 'string'
            ? JSON.parse(data.dailyLogs)
            : (data.dailyLogs || []);

        this.createdBy = data.createdBy;
        this.updatedBy = data.updatedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        this.status = data.status || "Draft";

        this.docNo = data.docNo;
        this.revNo = data.revNo;
        this.revDate = data.revDate;
    }

    static async init() {
        if (!await migrationHelper.tableExists('mentee_feedbacks')) {
            await executeQuery(`
                CREATE TABLE mentee_feedbacks (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    studentId INT NOT NULL,
                    topTableData NVARCHAR(MAX),
                    dailyLogs NVARCHAR(MAX),
                    status VARCHAR(50) DEFAULT 'Draft',
                    createdBy VARCHAR(255),
                    updatedBy VARCHAR(255),
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT fk_student_mentee_feedback FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
        } else {
            // Doc/revision snapshot: frozen at creation from the Revision Table.
            await migrationHelper.ensureColumnExists('mentee_feedbacks', 'docNo', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('mentee_feedbacks', 'revNo', 'VARCHAR(255) NULL');
            await migrationHelper.ensureColumnExists('mentee_feedbacks', 'revDate', 'VARCHAR(255) NULL');
        }
    }

    static async findByStudentId(studentId) {
        const [rows] = await executeQuery("SELECT * FROM mentee_feedbacks WHERE studentId = ?", [studentId]);
        if (rows.length === 0) return null;
        return new MenteeFeedback(rows[0]);
    }

    static async create(data) {
        const {
            studentId, topTableData, dailyLogs, createdBy, status, docNo, revNo, revDate
        } = data;

        const query = `
            INSERT INTO mentee_feedbacks
            (studentId, topTableData, dailyLogs, createdBy, status, docNo, revNo, revDate)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            studentId,
            JSON.stringify(topTableData || {}),
            JSON.stringify(dailyLogs || []),
            createdBy,
            status || "Draft",
            docNo || null,
            revNo || null,
            revDate || null
        ];

        const [rows] = await executeQuery(query, values);
        return { id: rows[0].id, ...data };
    }

    async save() {
        const query = `
            UPDATE mentee_feedbacks SET
            topTableData = ?, dailyLogs = ?, status = ?, updatedBy = ?, updatedAt = GETDATE()
            WHERE id = ?
        `;

        const values = [
            JSON.stringify(this.topTableData),
            JSON.stringify(this.dailyLogs),
            this.status || "Draft",
            this.updatedBy,
            this.id
        ];

        await executeQuery(query, values);
        return this;
    }
}

export default MenteeFeedback;
