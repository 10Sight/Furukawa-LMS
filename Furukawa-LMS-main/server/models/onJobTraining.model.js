import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class OnJobTraining {
    constructor(data) {
        this.id = data.id;
        this._id = data.id; // Compatibility

        this.student = data.student;
        this.name = data.name || "Level-1 Practical Evaluation of On the Job Training";
        this.department = data.department;
        this.section = data.section;
        this.line = data.line;
        this.subSection = data.subSection;
        this.machine = data.machine;
        this.entries = typeof data.entries === 'string' ? JSON.parse(data.entries) : (data.entries || []);
        this.scoring = typeof data.scoring === 'string' ? JSON.parse(data.scoring) : (data.scoring || {});
        this.totalMarks = data.totalMarks !== undefined ? data.totalMarks : 36;
        this.totalMarksObtained = data.totalMarksObtained;
        this.totalPercentage = data.totalPercentage;
        this.result = data.result || "Pending";
        this.guidelines = data.guidelines;
        this.remarks = data.remarks;
        this.remarkImage = data.remarkImage;

        // Training Record Sheet Fields
        this.areaLine = data.areaLine;
        this.trainingDate = data.trainingDate;
        this.trainingGivenBy = data.trainingGivenBy;
        this.trainingTopic = data.trainingTopic;
        this.trainingStartTime = data.trainingStartTime;
        this.trainingEndTime = data.trainingEndTime;
        this.trainingDetail = data.trainingDetail;
        this.attendanceRecords = typeof data.attendanceRecords === 'string' ? JSON.parse(data.attendanceRecords) : (data.attendanceRecords || []);
        this.trainingDetailImage = data.trainingDetailImage;
        this.createdBy = data.createdBy;
        this.updatedBy = data.updatedBy;

        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='on_job_trainings' and xtype='U')
            BEGIN
            CREATE TABLE on_job_trainings (
                id INT IDENTITY(1,1) PRIMARY KEY,
                student VARCHAR(255) NULL,
                name VARCHAR(255) DEFAULT 'Level-1 Practical Evaluation of On the Job Training',
                department VARCHAR(255) NOT NULL,
                section VARCHAR(255),
                line VARCHAR(255) NULL,
                subSection VARCHAR(255),
                machine VARCHAR(255) NULL,
                entries NVARCHAR(MAX),
                scoring NVARCHAR(MAX),
                totalMarks DECIMAL(10, 2) DEFAULT 36,
                totalMarksObtained DECIMAL(10, 2),
                totalPercentage DECIMAL(5, 2),
                result VARCHAR(50) DEFAULT 'Pending',
                guidelines NVARCHAR(MAX),
                remarks NVARCHAR(MAX),
                remarkImage NVARCHAR(MAX),
                
                areaLine VARCHAR(255),
                trainingDate DATE,
                trainingGivenBy VARCHAR(255),
                trainingTopic VARCHAR(255),
                trainingStartTime VARCHAR(50),
                trainingEndTime VARCHAR(50),
                trainingDetail NVARCHAR(MAX),
                attendanceRecords NVARCHAR(MAX),
                trainingDetailImage NVARCHAR(MAX),
                trainingLog NVARCHAR(MAX),

                createdBy VARCHAR(255),
                updatedBy VARCHAR(255),
                createdAt DATETIME,
                updatedAt DATETIME DEFAULT GETDATE()
            );
            CREATE INDEX idx_student ON on_job_trainings(student);
            CREATE INDEX idx_department ON on_job_trainings(department);
            END
            ELSE
            BEGIN
                IF COL_LENGTH('on_job_trainings', 'section') IS NULL
                BEGIN
                    ALTER TABLE on_job_trainings ADD section VARCHAR(255);
                END
                IF COL_LENGTH('on_job_trainings', 'subSection') IS NULL
                BEGIN
                    ALTER TABLE on_job_trainings ADD subSection VARCHAR(255);
                END
                
                -- Ensure student, line, and machine columns are nullable
                ALTER TABLE on_job_trainings ALTER COLUMN student VARCHAR(255) NULL;
                ALTER TABLE on_job_trainings ALTER COLUMN [line] VARCHAR(255) NULL;
                ALTER TABLE on_job_trainings ALTER COLUMN machine VARCHAR(255) NULL;
            END
        `;
        try {
            await executeQuery(query);
            logger.info("Checked/Created on_job_trainings table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize OnJobTraining table", error);
        }
    }

    static async create(data) {
        const ojt = new OnJobTraining(data);

        const fields = [
            "student", "name", "department", "section", "line", "subSection", "machine",
            "entries", "scoring", "totalMarks", "totalMarksObtained",
            "totalPercentage", "result", "guidelines", "remarks", "remarkImage",
            "areaLine", "trainingDate", "trainingGivenBy", "trainingTopic",
            "trainingStartTime", "trainingEndTime", "trainingDetail", "attendanceRecords", "trainingDetailImage", "trainingLog",
            "createdBy", "updatedBy", "createdAt"
        ];

        if (!ojt.createdAt) ojt.createdAt = new Date();

        const values = fields.map(field => {
            let val = ojt[field];
            if (['entries', 'scoring'].includes(field)) {
                return JSON.stringify(val);
            }
            if (val === undefined) return null;
            return val;
        });

        const placeholders = fields.map(() => "?").join(",");
        const query = `INSERT INTO on_job_trainings (${fields.join(",")}) OUTPUT INSERTED.id VALUES (${placeholders})`;

        const [result] = await executeQuery(query, values);
        return OnJobTraining.findById(result[0]?.id);
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM on_job_trainings WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new OnJobTraining(rows[0]);
    }

    static async findOne(query) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        if (keys.length === 0) return null;

        const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
        const values = keys.map(key => query[key]);

        const [rows] = await executeQuery(`SELECT TOP 1 * FROM on_job_trainings WHERE ${whereClause}`, values);
        if (rows.length === 0) return null;
        return new OnJobTraining(rows[0]);
    }

    static async find(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT * FROM on_job_trainings";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows.map(row => new OnJobTraining(row));
    }

    static async countDocuments(query = {}) {
        const keys = Object.keys(query).filter(key => query[key] !== undefined);
        let sql = "SELECT COUNT(*) as count FROM on_job_trainings";
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map(key => `${key} = ?`).join(" AND ");
            sql += ` WHERE ${whereClause}`;
            values = keys.map(key => query[key]);
        }

        const [rows] = await executeQuery(sql, values);
        return rows[0].count;
    }

    async save() {
        const fields = [
            "student", "name", "department", "section", "line", "subSection", "machine",
            "entries", "scoring", "totalMarks", "totalMarksObtained",
            "totalPercentage", "result", "guidelines", "remarks", "remarkImage",
            "areaLine", "trainingDate", "trainingGivenBy", "trainingTopic",
            "trainingStartTime", "trainingEndTime", "trainingDetail", "attendanceRecords", "trainingDetailImage", "trainingLog",
            "createdBy", "updatedBy"
        ];

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = fields.map(field => {
            let val = this[field];
            if (['entries', 'scoring', 'attendanceRecords', 'trainingLog'].includes(field)) {
                return JSON.stringify(val);
            }
            return val;
        });
        values.push(this.id);

        await executeQuery(`UPDATE on_job_trainings SET ${setClause} WHERE id = ?`, values);
        return this;
    }
}

// Initialize table
OnJobTraining.init();

export default OnJobTraining;
