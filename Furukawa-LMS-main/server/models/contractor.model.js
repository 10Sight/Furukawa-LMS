import { executeQuery } from "../db/mssqlHelper.js";
import logger from "../logger/winston.logger.js";
import { formatLocalDate } from "../utils/istDate.util.js";

class Contractor {
    constructor(data) {
        this.id = data.id;
        this._id = data.id;
        this.name = data.name;
        this.location = data.location || null;
        this.phoneNumber = data.phoneNumber || null;
        this.email = data.email || null;
        this.startDate = data.startDate instanceof Date
            ? formatLocalDate(data.startDate)
            : (data.startDate || null);
        this.status = data.status || 'active';
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        this.userCount = data.userCount !== undefined ? data.userCount : 0;
    }

    static async init() {
        const createTable = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='contractors' and xtype='U')
            BEGIN
                CREATE TABLE contractors (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(255) NOT NULL,
                    location NVARCHAR(255) NULL,
                    phoneNumber NVARCHAR(50) NULL,
                    email NVARCHAR(255) NULL,
                    startDate DATE DEFAULT GETDATE(),
                    status NVARCHAR(50) DEFAULT 'active',
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                )
            END
        `;
        try {
            await executeQuery(createTable);
            logger.info("Checked/Created contractors table in MSSQL");
        } catch (error) {
            logger.error("Failed to initialize Contractor table", error);
        }
    }

    static async create(data) {
        const now = new Date();
        const fields = ['name', 'location', 'phoneNumber', 'email', 'startDate', 'status', 'createdAt', 'updatedAt'];
        const values = [
            data.name,
            data.location || null,
            data.phoneNumber || null,
            data.email || null,
            data.startDate || now,
            data.status || 'active',
            now,
            now,
        ];
        const placeholders = fields.map(() => '?').join(', ');
        const query = `INSERT INTO contractors (${fields.join(', ')}) OUTPUT INSERTED.id VALUES (${placeholders})`;
        const [result] = await executeQuery(query, values);
        return Contractor.findById(result[0].id);
    }

    static async findById(id) {
        if (!id || isNaN(id)) return null;
        const [rows] = await executeQuery('SELECT * FROM contractors WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return new Contractor(rows[0]);
    }

    static async findAll() {
        const [rows] = await executeQuery(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM users u WHERE u.contractorId = c.id AND (u.isDeleted = 0 OR u.isDeleted IS NULL)) AS userCount
            FROM contractors c
            ORDER BY c.createdAt DESC
        `);
        return rows.map(row => new Contractor(row));
    }

    static async update(id, data) {
        const allowed = ['name', 'location', 'phoneNumber', 'email', 'status'];
        const fields = allowed.filter(f => data[f] !== undefined);
        if (fields.length === 0) return Contractor.findById(id);

        fields.push('updatedAt');
        const values = [...fields.slice(0, -1).map(f => data[f]), new Date(), id];
        const setClause = fields.map(f => `${f} = ?`).join(', ');

        await executeQuery(`UPDATE contractors SET ${setClause} WHERE id = ?`, values);
        return Contractor.findById(id);
    }

    static async delete(id) {
        await executeQuery('DELETE FROM contractors WHERE id = ?', [id]);
    }

    static async getUsersByContractor(contractorId) {
        const [rows] = await executeQuery(`
            SELECT id, fullName, userName, empId, email, phoneNumber, avatar, status,
                   departmentId, joiningDate, createdAt
            FROM users
            WHERE contractorId = ?
              AND (isDeleted = 0 OR isDeleted IS NULL)
            ORDER BY fullName
        `, [contractorId]);
        return rows;
    }
}

Contractor.init();

export default Contractor;
