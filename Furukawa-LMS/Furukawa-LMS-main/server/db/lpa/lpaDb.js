import { executeQuery } from "../mssqlHelper.js";
import migrationHelper from "../migrationHelper.js";
import { poolPromise } from "../connectDB.js";
import logger from "../../logger/winston.logger.js";
import fs from "fs";
import path from "path";

export const LPA_STORE_PATH = path.join(process.cwd(), "db", "lpa", "lpa_persistence_store.json");

/**
 * Checks if central MSSQL pool is connected and active
 */
export async function isDbConnected() {
    try {
        const pool = await poolPromise;
        return Boolean(pool);
    } catch {
        return false;
    }
}

/**
 * Reads LPA persistent fallback store from disk
 */
export function readLpaStore() {
    try {
        if (fs.existsSync(LPA_STORE_PATH)) {
            const raw = fs.readFileSync(LPA_STORE_PATH, "utf-8");
            return JSON.parse(raw);
        }
    } catch (e) {
        logger.warn("Failed reading LPA persistence store:", e.message);
    }
    return {
        records: [],
        templates: [],
        revisions: [],
        auditors: [],
        observations: []
    };
}

/**
 * Writes LPA persistent fallback store to disk atomically
 */
export function writeLpaStore(store) {
    try {
        const dir = path.dirname(LPA_STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(LPA_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
    } catch (e) {
        logger.error("Failed writing LPA persistence store:", e.message);
    }
}

/**
 * Ensures all LPA relational tables exist in MSSQL
 */
export async function initLpaTables() {
    const connected = await isDbConnected();
    if (!connected) {
        logger.warn("MSSQL not connected; LPA module will use robust persistent disk store.");
        return;
    }

    try {
        // 1. lpa_templates
        if (!await migrationHelper.tableExists('lpa_templates')) {
            await executeQuery(`
                CREATE TABLE lpa_templates (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    section NVARCHAR(50) NOT NULL,
                    name NVARCHAR(255) NOT NULL,
                    docNo NVARCHAR(100) NULL,
                    revNo NVARCHAR(50) NULL,
                    issueDate NVARCHAR(50) NULL,
                    columnCount INT NOT NULL DEFAULT 7,
                    configJson NVARCHAR(MAX) NULL,
                    isActive BIT DEFAULT 1,
                    createdBy NVARCHAR(255) NULL,
                    updatedBy NVARCHAR(255) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            `);
            await migrationHelper.ensureIndexExists('lpa_templates', 'idx_lpa_templates_section',
                'CREATE INDEX idx_lpa_templates_section ON lpa_templates(section)');
        }

        // 2. lpa_template_items
        if (!await migrationHelper.tableExists('lpa_template_items')) {
            await executeQuery(`
                CREATE TABLE lpa_template_items (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    templateId INT NOT NULL,
                    itemIndex INT NOT NULL,
                    slNo NVARCHAR(50) NULL,
                    focus NVARCHAR(255) NULL,
                    checkPoint NVARCHAR(MAX) NOT NULL,
                    area NVARCHAR(255) NULL,
                    defaultMarks INT NOT NULL DEFAULT 3,
                    createdAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (templateId) REFERENCES lpa_templates(id) ON DELETE CASCADE
                )
            `);
            await migrationHelper.ensureIndexExists('lpa_template_items', 'idx_lpa_template_items_tpl',
                'CREATE INDEX idx_lpa_template_items_tpl ON lpa_template_items(templateId)');
        }

        // 3. lpa_records
        if (!await migrationHelper.tableExists('lpa_records')) {
            await executeQuery(`
                CREATE TABLE lpa_records (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    recordId NVARCHAR(100) NOT NULL UNIQUE,
                    section NVARCHAR(50) NOT NULL,
                    name NVARCHAR(255) NOT NULL,
                    unit NVARCHAR(100) NOT NULL,
                    level NVARCHAR(50) DEFAULT 'L1',
                    auditDate DATE NOT NULL,
                    shift NVARCHAR(20) NOT NULL,
                    department NVARCHAR(100) NOT NULL,
                    sectionName NVARCHAR(100) NULL,
                    line NVARCHAR(100) NULL,
                    status NVARCHAR(50) DEFAULT 'Draft',
                    totalMarks INT DEFAULT 0,
                    totalScore INT DEFAULT 0,
                    percentage NVARCHAR(50) DEFAULT '0.00%',
                    scorePercentage DECIMAL(5,2) DEFAULT 0.00,
                    version INT DEFAULT 1,
                    ownerId NVARCHAR(100) NULL,
                    createdBy NVARCHAR(255) NULL,
                    createdById NVARCHAR(100) NULL,
                    updatedBy NVARCHAR(255) NULL,
                    updatedById NVARCHAR(100) NULL,
                    fullWorkbookJson NVARCHAR(MAX) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            `);
            await migrationHelper.ensureIndexExists('lpa_records', 'idx_lpa_records_section',
                'CREATE INDEX idx_lpa_records_section ON lpa_records(section)');
            await migrationHelper.ensureIndexExists('lpa_records', 'idx_lpa_records_unit_date',
                'CREATE INDEX idx_lpa_records_unit_date ON lpa_records(unit, auditDate)');
            await migrationHelper.ensureIndexExists('lpa_records', 'idx_lpa_records_dept',
                'CREATE INDEX idx_lpa_records_dept ON lpa_records(department)');
        }

        // 4. lpa_record_auditors
        if (!await migrationHelper.tableExists('lpa_record_auditors')) {
            await executeQuery(`
                CREATE TABLE lpa_record_auditors (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    recordId INT NOT NULL,
                    auditorIndex INT NOT NULL DEFAULT 0,
                    auditorName NVARCHAR(255) NOT NULL,
                    auditorEmpId NVARCHAR(100) NULL,
                    auditorUserId INT NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (recordId) REFERENCES lpa_records(id) ON DELETE CASCADE
                )
            `);
            await migrationHelper.ensureIndexExists('lpa_record_auditors', 'idx_lpa_auditors_rec',
                'CREATE INDEX idx_lpa_auditors_rec ON lpa_record_auditors(recordId)');
        }

        // 5. lpa_record_observations
        if (!await migrationHelper.tableExists('lpa_record_observations')) {
            await executeQuery(`
                CREATE TABLE lpa_record_observations (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    recordId INT NOT NULL,
                    sheetIndex INT NOT NULL DEFAULT 0,
                    rowIndex INT NOT NULL,
                    slNo NVARCHAR(50) NULL,
                    focus NVARCHAR(255) NULL,
                    checkPoint NVARCHAR(MAX) NULL,
                    area NVARCHAR(255) NULL,
                    marks INT NOT NULL DEFAULT 0,
                    observation NVARCHAR(50) NULL,
                    score NVARCHAR(50) NULL,
                    calculatedScore INT NULL,
                    isApplicable BIT DEFAULT 1,
                    remarks NVARCHAR(MAX) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (recordId) REFERENCES lpa_records(id) ON DELETE CASCADE
                )
            `);
            await migrationHelper.ensureIndexExists('lpa_record_observations', 'idx_lpa_obs_rec',
                'CREATE INDEX idx_lpa_obs_rec ON lpa_record_observations(recordId)');
        }

        // 6. lpa_record_revisions
        if (!await migrationHelper.tableExists('lpa_record_revisions')) {
            await executeQuery(`
                CREATE TABLE lpa_record_revisions (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    recordId INT NOT NULL,
                    version INT NOT NULL,
                    changeType NVARCHAR(50) NOT NULL,
                    changedBy NVARCHAR(255) NULL,
                    changedById NVARCHAR(100) NULL,
                    summary NVARCHAR(MAX) NULL,
                    snapshotJson NVARCHAR(MAX) NULL,
                    createdAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (recordId) REFERENCES lpa_records(id) ON DELETE CASCADE
                )
            `);
            await migrationHelper.ensureIndexExists('lpa_record_revisions', 'idx_lpa_rev_rec',
                'CREATE INDEX idx_lpa_rev_rec ON lpa_record_revisions(recordId)');
        }

        logger.info("✅ LPA database tables initialized successfully.");
    } catch (error) {
        logger.error("Error during LPA tables initialization:", error.message);
    }
}

export { executeQuery, migrationHelper, poolPromise };
