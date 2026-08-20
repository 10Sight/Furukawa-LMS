import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class Privilege {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
    }

    static async init() {
        try {
            if (!await migrationHelper.tableExists('privileges')) {
                await executeQuery(`
                    CREATE TABLE privileges (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(100) NOT NULL
                    )
                `);
            }
            console.log("Privileges table verified/created in MSSQL.");
        } catch (error) {
            logger.error("Failed to initialize Privilege table", error);
        }
    }

    static async create(privilegeData) {
        const { name } = privilegeData;
        const query = `INSERT INTO privileges (name) OUTPUT INSERTED.id VALUES (?)`;
        const [result] = await executeQuery(query, [name]);
        return new Privilege({ id: result[0].id, ...privilegeData });
    }

    static async findById(id) {
        const [rows] = await executeQuery("SELECT * FROM privileges WHERE id = ?", [id]);
        if (rows.length === 0) return null;
        return new Privilege(rows[0]);
    }

    static async findAll() {
        const [rows] = await executeQuery("SELECT * FROM privileges");
        return rows.map(row => new Privilege(row));
    }
}

// Initialize table
Privilege.init().catch(err => console.error("Failed to initialize Privilege table:", err));

export default Privilege;
