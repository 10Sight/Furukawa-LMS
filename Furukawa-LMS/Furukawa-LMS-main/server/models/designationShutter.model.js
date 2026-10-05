import { executeQuery } from "../db/mssqlHelper.js";
import migrationHelper from "../db/migrationHelper.js";
import logger from "../logger/winston.logger.js";

class DesignationShutter {
  static async init() {
    try {
      if (!await migrationHelper.tableExists('designation_shutters')) {
        await executeQuery(`
          CREATE TABLE designation_shutters (
            id INT IDENTITY(1,1) PRIMARY KEY,
            designation NVARCHAR(255) NOT NULL UNIQUE,
            createdAt DATETIME DEFAULT GETDATE()
          )
        `);
      }
      logger.info("Checked/Created designation_shutters table");
    } catch (error) {
      logger.error("Failed to initialize designation_shutters table", error);
    }
  }

  static async shutter(designation) {
    try {
      await executeQuery(
        `INSERT INTO designation_shutters (designation) VALUES (?)`,
        [designation]
      );
    } catch (error) {
      // UNIQUE constraint violation means it's already shuttered — treat as success
      if (!error.message?.includes("UNIQUE") && !error.message?.includes("duplicate")) throw error;
    }
    return true;
  }

  static async unshutter(designation) {
    await executeQuery(
      `DELETE FROM designation_shutters WHERE designation = ?`,
      [designation]
    );
    return true;
  }
}

export default DesignationShutter;
