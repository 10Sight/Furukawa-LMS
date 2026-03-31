import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";

class EmailConfiguration {
    constructor(data) {
        this.id = data.id;
        this.formName = data.formName;
        this.departmentId = data.departmentId;
        this.toEmails = data.toEmails;
        this.ccEmails = data.ccEmails;
        this.includeTrainer = data.includeTrainer !== undefined ? !!data.includeTrainer : false;
        this.isActive = data.isActive !== undefined ? !!data.isActive : true;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        const query = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='email_configurations' and xtype='U')
      BEGIN
        CREATE TABLE email_configurations (
          id INT IDENTITY(1,1) PRIMARY KEY,
          formName VARCHAR(150) NOT NULL,
          departmentId INT NULL,
          toEmails NVARCHAR(MAX),
          ccEmails NVARCHAR(MAX),
          includeTrainer BIT DEFAULT 0,
          isActive BIT DEFAULT 1,
          createdAt DATETIME DEFAULT GETDATE(),
          updatedAt DATETIME DEFAULT GETDATE(),
          CONSTRAINT fk_email_config_dept FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
        )
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('email_configurations') AND name = 'includeTrainer')
        BEGIN
          ALTER TABLE email_configurations ADD includeTrainer BIT DEFAULT 0;
        END
      END
    `;
        try {
            await executeQuery(query);
        } catch (error) {
            logger.error("Failed to initialize email_configurations table", error);
        }
    }

    static async create(data) {
        const { formName, departmentId, toEmails, ccEmails, includeTrainer, isActive } = data;
        const active = isActive !== undefined ? (isActive ? 1 : 0) : 1;
        const trainer = includeTrainer !== undefined ? (includeTrainer ? 1 : 0) : 0;

        const query = `
      INSERT INTO email_configurations (formName, departmentId, toEmails, ccEmails, includeTrainer, isActive, updatedAt)
      OUTPUT INSERTED.*
      VALUES (?, ?, ?, ?, ?, ?, GETDATE())
    `;

        const [rows] = await executeQuery(query, [formName, departmentId || null, toEmails, ccEmails, trainer, active]);
        return new EmailConfiguration(rows[0]);
    }

    static async findByFormAndDept(formName, departmentId) {
        const query = `
      SELECT * FROM email_configurations 
      WHERE formName = ? AND (departmentId = ? OR departmentId IS NULL) 
      AND isActive = 1
      ORDER BY departmentId DESC
    `;
        const [rows] = await executeQuery(query, [formName, departmentId]);
        if (rows.length === 0) return null;
        return new EmailConfiguration(rows[0]);
    }

    static async findAll() {
        const query = `
      SELECT ec.*, d.name as departmentName 
      FROM email_configurations ec
      LEFT JOIN departments d ON ec.departmentId = d.id
      ORDER BY ec.formName ASC
    `;
        const [rows] = await executeQuery(query);
        return rows.map(row => ({
            ...new EmailConfiguration(row),
            departmentName: row.departmentName
        }));
    }

    static async findById(id) {
        const query = `SELECT * FROM email_configurations WHERE id = ?`;
        const [rows] = await executeQuery(query, [id]);
        if (rows.length === 0) return null;
        return new EmailConfiguration(rows[0]);
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        if (data.formName !== undefined) { fields.push("formName = ?"); values.push(data.formName); }
        if (data.departmentId !== undefined) { fields.push("departmentId = ?"); values.push(data.departmentId || null); }
        if (data.toEmails !== undefined) { fields.push("toEmails = ?"); values.push(data.toEmails); }
        if (data.ccEmails !== undefined) { fields.push("ccEmails = ?"); values.push(data.ccEmails); }
        if (data.includeTrainer !== undefined) { fields.push("includeTrainer = ?"); values.push(data.includeTrainer ? 1 : 0); }
        if (data.isActive !== undefined) { fields.push("isActive = ?"); values.push(data.isActive ? 1 : 0); }

        if (fields.length === 0) return null;

        fields.push("updatedAt = GETDATE()");
        const query = `UPDATE email_configurations SET ${fields.join(", ")} WHERE id = ?`;
        values.push(id);

        await executeQuery(query, values);
        return this.findById(id);
    }

    static async delete(id) {
        const query = `DELETE FROM email_configurations WHERE id = ?`;
        await executeQuery(query, [id]);
        return true;
    }
}

// Initialize
EmailConfiguration.init();

export default EmailConfiguration;
