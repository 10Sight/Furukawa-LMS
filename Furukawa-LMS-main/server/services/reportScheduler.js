import cron from "node-cron";
import Mail from "../models/mail.model.js";
import reportService from "./report.service.js";

const init = () => {
    console.log("Initializing Report Scheduler...");

    // ================= COMBINED DAILY REPORTS (8:30 AM) =================
    // Cron: 30 8 * * * (Every morning at 8:30 AM)
    cron.schedule('30 8 * * *', async () => {
        console.log("Running Scheduled Combined Daily Reports Job at 8:30 AM...");
        try {
            const mails = await Mail.findAll();

            // Get all unique emails of recipients subscribed to either or both daily reports
            const emails = Array.from(new Set(
                mails.filter(m => m.isDailyReport || m.isManagementDailyReport).map(m => m.email)
            ));

            if (emails.length === 0) {
                console.log("Combined Daily Reports: No recipients found.");
                return;
            }

            console.log(`Sending Combined Daily Reports to ${emails.length} recipients...`);
            await reportService.sendBothReports(emails);
            console.log("Combined Daily Reports Sent Successfully.");

        } catch (error) {
            console.error("Failed to run Combined Daily Reports Job:", error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
};

export default {
    init
};
