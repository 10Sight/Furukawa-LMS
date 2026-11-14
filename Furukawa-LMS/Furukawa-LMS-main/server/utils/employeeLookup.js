/**
 * Employee Code lookups shared by the user-creating endpoints and quiz submission.
 */
import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "./ApiError.js";
import { normalizeEmpId } from "./employeeFields.js";

const ACTIVE = "ISNULL(isDeleted, 0) = 0";

/**
 * Throws a 400 when an active user already holds this Employee Code (as empId or userName).
 * Call with the normalised code before inserting a user.
 */
export const assertEmpIdAvailable = async (empId) => {
    const code = normalizeEmpId(empId);
    if (!code) return;
    const [rows] = await executeQuery(
        `SELECT TOP 1 fullName FROM users WHERE (empId = ? OR userName = ?) AND ${ACTIVE}`,
        [code, code]
    );
    if (rows.length > 0) {
        throw new ApiError(`Employee Code ${code} is already registered to ${rows[0].fullName || "another user"}.`, 400);
    }
};

/**
 * Resolves the candidate typed on a quiz paper (name + Employee Code) to an existing user.
 *
 * A quiz submission never creates users: candidates must be registered first (Dojo
 * registration, Add Employee or Excel import), so every user carries the mandatory
 * employee fields. Unknown or ambiguous candidates are rejected with a 400.
 *
 * @returns {Promise<number>} the id of the registered user.
 */
export const resolveQuizCandidate = async ({ candidateName, eCode }) => {
    const name = String(candidateName || "").trim();
    const code = normalizeEmpId(eCode);

    if (code) {
        // Default SQL Server collation is case-insensitive, so one comparison covers any casing.
        const [rows] = await executeQuery(
            `SELECT id FROM users WHERE (empId = ? OR userName = ?) AND ${ACTIVE}`,
            [code, code]
        );
        if (rows.length === 1) return rows[0].id;
        if (rows.length > 1) {
            throw new ApiError(
                `More than one user is registered with Employee Code '${code}'. Please ask an admin to fix the duplicate before submitting.`,
                409
            );
        }
        throw new ApiError(
            `Candidate '${name}' with Employee Code '${code}' is not registered in the system. Please register the candidate first before submitting the quiz.`,
            400
        );
    }

    const [rows] = await executeQuery(
        `SELECT id FROM users WHERE fullName = ? AND role = 'STUDENT' AND ${ACTIVE}`,
        [name]
    );
    if (rows.length === 1) return rows[0].id;
    if (rows.length > 1) {
        throw new ApiError(
            `More than one candidate is named '${name}'. Please enter the Employee Code.`,
            400
        );
    }
    throw new ApiError(
        `Candidate '${name}' is not registered in the system. Please enter the Employee Code of a registered candidate.`,
        400
    );
};
