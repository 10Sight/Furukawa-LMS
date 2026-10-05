import { ClientSecretCredential } from "@azure/identity";
import { Client, ResponseType } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import logger from "../logger/winston.logger.js";

// 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, matching ExcelClone's own column letters.
const columnIndexToLetter = (index) => {
    let n = index + 1;
    let letters = "";
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
};

// Daemon-only (app-only) Graph access: files are created/edited "as the app",
// not as an individual signed-in user. That's fine for provisioning/backup,
// but co-authoring/edit-history won't reflect real LMS users until this app
// also does delegated (on-behalf-of) auth for each person — out of scope here.
class MicrosoftGraphService {
    constructor() {
        this.client = null;
    }

    get tenantId() { return process.env.AZURE_TENANT_ID; }
    get clientId() { return process.env.AZURE_CLIENT_ID; }
    get clientSecret() { return process.env.AZURE_CLIENT_SECRET; }
    get driveId() { return process.env.SHAREPOINT_DRIVE_ID; }

    // Lets callers check up front and fail with a clear message instead of a
    // confusing Graph SDK error the first time a request actually goes out.
    isConfigured() {
        return !!(this.tenantId && this.clientId && this.clientSecret && this.driveId);
    }

    getClient() {
        if (!this.isConfigured()) {
            throw new Error(
                "Microsoft 365 integration is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, " +
                "AZURE_CLIENT_SECRET and SHAREPOINT_DRIVE_ID in the server environment."
            );
        }
        if (!this.client) {
            const credential = new ClientSecretCredential(this.tenantId, this.clientId, this.clientSecret);
            const authProvider = new TokenCredentialAuthenticationProvider(credential, {
                scopes: ["https://graph.microsoft.com/.default"]
            });
            this.client = Client.initWithMiddleware({ authProvider });
        }
        return this.client;
    }

    async executeWithRetry(fn, maxRetries = 3) {
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                return await fn();
            } catch (error) {
                attempt++;
                const isRateLimited = error.statusCode === 429 || error.statusCode === 503;
                if (isRateLimited && attempt < maxRetries) {
                    const retryAfter = error.headers?.get?.("Retry-After") || Math.pow(2, attempt);
                    const delayMs = parseInt(retryAfter, 10) * 1000 + Math.random() * 200;
                    logger.warn(`Microsoft Graph rate-limited. Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                } else {
                    throw error;
                }
            }
        }
    }

    async ensureFolder(folderPath) {
        const client = this.getClient();
        const segments = folderPath.split("/").filter(Boolean);
        let builtPath = "";
        for (const segment of segments) {
            const parentPath = builtPath;
            builtPath = builtPath ? `${builtPath}/${segment}` : segment;
            try {
                await client.api(`/drives/${this.driveId}/root:/${builtPath}`).get();
            } catch (err) {
                if (err.statusCode !== 404) throw err;
                const parentApi = parentPath
                    ? `/drives/${this.driveId}/root:/${parentPath}:/children`
                    : `/drives/${this.driveId}/root/children`;
                await client.api(parentApi).post({
                    name: segment,
                    folder: {},
                    "@microsoft.graph.conflictBehavior": "replace"
                });
            }
        }
    }

    /**
     * Uploads a workbook buffer (already-built .xlsx) into SharePoint and returns
     * an editable embed link. Caller is responsible for building the buffer
     * (e.g. via exceljs from the meeting's existing sheetData).
     */
    async createMeetingWorkbook({ departmentName, sectionName, meetingId, fileBuffer }) {
        const cleanDept = (departmentName || "General").replace(/[^a-zA-Z0-9_-]/g, "_");
        const cleanSection = (sectionName || "Section").replace(/[^a-zA-Z0-9_-]/g, "_");
        const folderPath = `DailyMeetings/${cleanDept}/${cleanSection}`;
        const fileName = `DailyMeeting_${meetingId}_${Date.now()}.xlsx`;

        return this.executeWithRetry(async () => {
            const client = this.getClient();
            await this.ensureFolder(folderPath);

            const uploadRes = await client
                .api(`/drives/${this.driveId}/root:/${folderPath}/${fileName}:/content`)
                .put(fileBuffer);

            const itemId = uploadRes.id;
            const { webUrl, embedUrl } = await this.createShareLink(itemId, "edit");

            return { driveId: this.driveId, itemId, webUrl, embedUrl, fileName, folderPath };
        });
    }

    async getEmbedUrl(itemId) {
        return this.executeWithRetry(() => this.createShareLink(itemId, "edit"));
    }

    // Department-based access control (server/utils/dailyMeetingAccess.util.js)
    // maps to this "type": same department/admin get "edit", every other viewer
    // gets "view". Graph's createLink is idempotent per (type, scope) pair — it
    // reuses an existing link of that type instead of minting a new one each call.
    async getShareLink(itemId, type = "edit") {
        return this.executeWithRetry(() => this.createShareLink(itemId, type));
    }

    async createShareLink(itemId, type = "edit") {
        const client = this.getClient();
        const linkRes = await client
            .api(`/drives/${this.driveId}/items/${itemId}/createLink`)
            .post({ type, scope: "organization" });

        const webUrl = linkRes.link.webUrl;
        const embedUrl = `${webUrl}${webUrl.includes("?") ? "&" : "?"}action=embedview&wdbipreview=true`;
        return { webUrl, embedUrl };
    }

    /**
     * Reads the live computed values of a workbook's first worksheet (no session
     * needed for a plain read with app-only permissions). Used to feed charts from
     * a Microsoft-365-backed meeting without keeping a persistent connection open.
     */
    async getWorksheetSnapshot(itemId) {
        return this.executeWithRetry(async () => {
            const client = this.getClient();
            const worksheetsRes = await client.api(`/drives/${this.driveId}/items/${itemId}/workbook/worksheets`).get();
            const sheet = worksheetsRes.value?.[0];
            if (!sheet) return { sheetName: null, displayGrid: {}, rowCount: 0, columnCount: 0 };

            const rangeRes = await client
                .api(`/drives/${this.driveId}/items/${itemId}/workbook/worksheets/${sheet.id}/usedRange(valuesOnly=true)`)
                .get();

            const values = rangeRes.values || [];
            const rowCount = values.length;
            const columnCount = rowCount > 0 ? values[0].length : 0;
            const displayGrid = {};
            values.forEach((row, r) => {
                row.forEach((val, c) => {
                    if (val !== null && val !== "") {
                        displayGrid[`${columnIndexToLetter(c)}${r + 1}`] = val;
                    }
                });
            });

            return { sheetName: sheet.name, displayGrid, rowCount, columnCount };
        });
    }

    /**
     * Lists the .xlsx workbooks directly inside a section's SharePoint folder, so
     * the caller can reconcile them against what's already tracked in MSSQL (files
     * created or "Save a Copy"-d directly in Excel Online never touch the LMS API).
     * Returns [] for a section that has no folder yet, rather than throwing.
     */
    async getSectionFolderFiles({ departmentName, sectionName }) {
        const cleanDept = (departmentName || "General").replace(/[^a-zA-Z0-9_-]/g, "_");
        const cleanSection = (sectionName || "Section").replace(/[^a-zA-Z0-9_-]/g, "_");
        const folderPath = `DailyMeetings/${cleanDept}/${cleanSection}`;

        return this.executeWithRetry(async () => {
            const client = this.getClient();
            let children;
            try {
                const res = await client.api(`/drives/${this.driveId}/root:/${folderPath}:/children`).get();
                children = res.value || [];
            } catch (err) {
                if (err.statusCode === 404) return [];
                throw err;
            }

            return children
                .filter((item) => item.file && /\.xlsx$/i.test(item.name))
                .map((item) => ({
                    itemId: item.id,
                    name: item.name,
                    webUrl: item.webUrl,
                    eTag: item.eTag,
                    createdDateTime: item.createdDateTime,
                    lastModifiedDateTime: item.lastModifiedDateTime,
                    size: item.size,
                    createdBy: item.createdBy?.user?.displayName || null,
                }));
        });
    }

    /**
     * Fetches up-to-date metadata for a single tracked item — used to refresh
     * change-tracking fields (eTag/lastModifiedDateTime) without listing the
     * whole folder.
     */
    async getFileMetadata(itemId) {
        return this.executeWithRetry(async () => {
            const client = this.getClient();
            const item = await client.api(`/drives/${this.driveId}/items/${itemId}`).get();
            return {
                itemId: item.id,
                name: item.name,
                webUrl: item.webUrl,
                eTag: item.eTag,
                createdDateTime: item.createdDateTime,
                lastModifiedDateTime: item.lastModifiedDateTime,
                size: item.size,
            };
        });
    }

    /**
     * Duplicates an existing SharePoint workbook into a (possibly different)
     * section folder using Graph's native async copy — cheaper and more faithful
     * than downloading + re-uploading, and preserves things a buffer round-trip
     * through exceljs would drop (formatting, etc).
     */
    async copyWorkbookInSharePoint({ sourceItemId, targetDepartmentName, targetSectionName, newFileName }) {
        const cleanDept = (targetDepartmentName || "General").replace(/[^a-zA-Z0-9_-]/g, "_");
        const cleanSection = (targetSectionName || "Section").replace(/[^a-zA-Z0-9_-]/g, "_");
        const folderPath = `DailyMeetings/${cleanDept}/${cleanSection}`;
        const fileName = newFileName || `DailyMeeting_Copy_${Date.now()}.xlsx`;

        return this.executeWithRetry(async () => {
            const client = this.getClient();
            await this.ensureFolder(folderPath);
            const folderItem = await client.api(`/drives/${this.driveId}/root:/${folderPath}`).get();

            // Graph's copy action is async: it responds 202 with a Location header
            // pointing at a monitor URL rather than the new item itself.
            const copyResponse = await client
                .api(`/drives/${this.driveId}/items/${sourceItemId}/copy`)
                .responseType(ResponseType.RAW)
                .post({
                    parentReference: { driveId: this.driveId, id: folderItem.id },
                    name: fileName
                });

            const monitorUrl = copyResponse.headers.get("location");
            if (!monitorUrl) {
                throw new Error("Microsoft Graph did not return a monitor URL for the copy operation.");
            }
            const newItemId = await this._waitForCopyCompletion(monitorUrl);

            const newItem = await client.api(`/drives/${this.driveId}/items/${newItemId}`).get();
            const { webUrl, embedUrl } = await this.createShareLink(newItemId, "edit");

            return { driveId: this.driveId, itemId: newItemId, webUrl, embedUrl, fileName: newItem.name, folderPath };
        });
    }

    // The monitor URL is queried directly (no Authorization header, per Graph docs)
    // until it reports completion. Polls with mild backoff instead of a fixed
    // interval since most copies of small workbooks finish within a second or two.
    async _waitForCopyCompletion(monitorUrl, maxAttempts = 15) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const res = await fetch(monitorUrl);
            const body = await res.json().catch(() => ({}));

            if (res.status === 200 && (body.status === "completed" || body.resourceId)) {
                if (body.resourceId) return body.resourceId;
                if (body.id) return body.id;
            }
            if (body.status === "failed") {
                throw new Error(`Microsoft Graph copy operation failed: ${body.statusDescription || "unknown error"}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 + attempt * 500));
        }
        throw new Error("Timed out waiting for Microsoft Graph to finish copying the workbook.");
    }

    // Compensating action: called when the DB write after a successful upload
    // fails, so we don't leave an orphaned file with nothing pointing at it.
    async deleteWorkbook(itemId) {
        if (!itemId || !this.isConfigured()) return;
        try {
            await this.executeWithRetry(async () => {
                const client = this.getClient();
                await client.api(`/drives/${this.driveId}/items/${itemId}`).delete();
            });
        } catch (err) {
            logger.warn(`Failed to cleanup orphaned M365 file ${itemId}:`, err.message || err);
        }
    }
}

export const microsoftGraphService = new MicrosoftGraphService();
export default microsoftGraphService;
