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
        this.trainingLog = typeof data.trainingLog === 'string' ? JSON.parse(data.trainingLog) : (data.trainingLog || []);
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
                name NVARCHAR(255) DEFAULT 'Level-1 Practical Evaluation of On the Job Training',
                department VARCHAR(255) NOT NULL,
                section NVARCHAR(255),
                line NVARCHAR(255) NULL,
                subSection NVARCHAR(255),
                machine NVARCHAR(255) NULL,
                entries NVARCHAR(MAX),
                scoring NVARCHAR(MAX),
                totalMarks DECIMAL(10, 2) DEFAULT 36,
                totalMarksObtained DECIMAL(10, 2),
                totalPercentage DECIMAL(5, 2),
                result VARCHAR(50) DEFAULT 'Pending',
                guidelines NVARCHAR(MAX),
                remarks NVARCHAR(MAX),
                remarkImage NVARCHAR(MAX),
                
                areaLine NVARCHAR(255),
                trainingDate DATE,
                trainingGivenBy NVARCHAR(255),
                trainingTopic NVARCHAR(255),
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
                    ALTER TABLE on_job_trainings ADD section NVARCHAR(255);
                END
                IF COL_LENGTH('on_job_trainings', 'subSection') IS NULL
                BEGIN
                    ALTER TABLE on_job_trainings ADD subSection NVARCHAR(255);
                END
                IF COL_LENGTH('on_job_trainings', 'trainingLog') IS NULL
                BEGIN
                    ALTER TABLE on_job_trainings ADD trainingLog NVARCHAR(MAX);
                END
                
                -- Ensure student, line, and machine columns are nullable and updated to appropriate types
                ALTER TABLE on_job_trainings ALTER COLUMN student VARCHAR(255) NULL;
                
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'line' AND DATA_TYPE = 'varchar')
                    ALTER TABLE on_job_trainings ALTER COLUMN [line] NVARCHAR(255) NULL;
                
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'machine' AND DATA_TYPE = 'varchar')
                    ALTER TABLE on_job_trainings ALTER COLUMN machine NVARCHAR(255) NULL;

                -- Alter other existing columns to NVARCHAR to support Unicode (Hindi, etc.)
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'name' AND DATA_TYPE = 'varchar')
                BEGIN
                    DECLARE @ConstraintName nvarchar(200)
                    SELECT @ConstraintName = Name 
                    FROM sys.default_constraints 
                    WHERE parent_object_id = object_id('on_job_trainings') 
                      AND parent_column_id = Columnproperty(object_id('on_job_trainings'), 'name', 'ColumnId')

                    IF @ConstraintName IS NOT NULL
                        EXEC('ALTER TABLE on_job_trainings DROP CONSTRAINT ' + @ConstraintName)

                    ALTER TABLE on_job_trainings ALTER COLUMN name NVARCHAR(255) NULL;

                    ALTER TABLE on_job_trainings ADD CONSTRAINT DF_on_job_trainings_name DEFAULT 'Level-1 Practical Evaluation of On the Job Training' FOR name;
                END

                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'section' AND DATA_TYPE = 'varchar')
                    ALTER TABLE on_job_trainings ALTER COLUMN section NVARCHAR(255) NULL;

                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'subSection' AND DATA_TYPE = 'varchar')
                    ALTER TABLE on_job_trainings ALTER COLUMN subSection NVARCHAR(255) NULL;

                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'areaLine' AND DATA_TYPE = 'varchar')
                    ALTER TABLE on_job_trainings ALTER COLUMN areaLine NVARCHAR(255) NULL;

                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'trainingGivenBy' AND DATA_TYPE = 'varchar')
                    ALTER TABLE on_job_trainings ALTER COLUMN trainingGivenBy NVARCHAR(255) NULL;

                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'on_job_trainings' AND COLUMN_NAME = 'trainingTopic' AND DATA_TYPE = 'varchar')
                    ALTER TABLE on_job_trainings ALTER COLUMN trainingTopic NVARCHAR(255) NULL;
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
