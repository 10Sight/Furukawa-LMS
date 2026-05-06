import cron from "node-cron";
import Mail from "../models/mail.model.js";
import reportService from "./report.service.js";

const init = () => {
    console.log("Initializing Report Scheduler...");

    // ================= DAILY REPORT (8:00 PM) =================
    // Cron: 0 20 * * * (At 20:00)
    cron.schedule('0 20 * * *', async () => {
        console.log("Running Daily Report Job...");
        try {
            // Find users who want daily reports
            const mails = await Mail.findAll({ isDailyReport: 1 });
            const emails = mails.map(m => m.email);

            if (emails.length === 0) {
                console.log("Daily Report: No recipients found.");
                return;
            }

            console.log(`Sending Daily Report to ${emails.length} recipients...`);
            await reportService.generateAndSend(emails, "Daily");
            console.log("Daily Report Sent Successfully.");

        } catch (error) {
            console.error("Failed to run Daily Report Job:", error);
        }
    });

    // ================= MANAGEMENT DAILY REPORT (8:00 PM) =================
    // Cron: 0 20 * * * (At 20:00)
    cron.schedule('0 20 * * *', async () => {
        console.log("Running Management Daily Report Job...");
        try {
            // Find users who want management daily reports
            const mails = await Mail.findAll({ isManagementDailyReport: 1 });
            const emails = mails.map(m => m.email);

            if (emails.length === 0) {
                console.log("Management Daily Report: No recipients found.");
                return;
            }

            console.log(`Sending Management Daily Report to ${emails.length} recipients...`);
            await reportService.generateAndSendManagementDaily(emails);
            console.log("Management Daily Report Sent Successfully.");

        } catch (error) {
            console.error("Failed to run Management Daily Report Job:", error);
        }
    });
};

export default {
    init
};
